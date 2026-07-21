import _ from 'lodash';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Encoding } from '@capacitor/filesystem';
import { contentDbService } from '../db/ContentDbService';
import {
  collectQuestionIds,
  replaceQuestionsInHierarchy,
  ensureMaxScore,
} from './qumlHierarchyUtils';

/**
 * Read and parse a JSON file from a content directory. `basePath` is a full
 * file:// URI (from ContentDb `path`), so no `directory` parameter is needed.
 */
async function readLocalJson(basePath: string, filename: string): Promise<any | null> {
  try {
    const result = await Filesystem.readFile({
      path: `${basePath}/${filename}`,
      encoding: Encoding.UTF8,
    });
    return JSON.parse(result.data as string);
  } catch {
    return null;
  }
}

/** Lists the file names directly under a directory URI (best-effort). */
async function listDirFiles(dirUri: string): Promise<string[]> {
  try {
    const res = await Filesystem.readdir({ path: dirUri });
    return res.files.map((f: any) => (typeof f === 'string' ? f : f.name));
  } catch {
    return [];
  }
}

/**
 * Builds a webview-servable URL for a media file on disk.
 *
 * `convertFileSrc` only swaps the scheme — it does NOT percent-escape the path.
 * Most published assets have plain filenames, so we keep the proven direct call.
 * But some ecars store path-encoded asset names containing literal "%2F"
 * (e.g. "content%2Fdo_..%2Fartifact%2F..jpg"); the file server would decode that
 * back to "/" and fail to find the file. For those we escape the filename so it
 * survives one round of decoding.
 */
function localMediaUrl(dirUri: string, fileName: string): string {
  if (fileName.includes('%')) {
    const base = Capacitor.convertFileSrc(dirUri).replace(/\/$/, '');
    return `${base}/${encodeURIComponent(fileName)}`;
  }
  return Capacitor.convertFileSrc(`${dirUri}/${fileName}`);
}

/** Media tags the player renders directly from body HTML. */
const MEDIA_TAG_RE = /<(img|audio|video|source)\b[^>]*>/gi;

/**
 * Rewrites the `src` of every media tag (`<img>`, `<audio>`, `<video>`,
 * `<source>`) in a chunk of body HTML to the local file URL.
 *
 * The QuML player renders the question/option body HTML directly and only
 * substitutes a base path into `src`s that are NOT already full URLs (it leaves
 * "https://..." alone). So pointing each tag at a full
 * `https://localhost/_capacitor_file_/...` URL makes it load straight from disk
 * — for audio/video exactly as for images.
 *
 * Two keying strategies, because AV markup varies by content:
 *  1. By `data-asset-variable` → asset id (how the player tags images, and
 *     often the wrapping `<video>`/`<audio>` element too).
 *  2. By the literal relative `src` string (e.g. a `<source src="do_<id>/clip.mp4">`
 *     that carries the path instead of an asset id) → its resolved URL.
 */
function rewriteBodyMedia(
  html: string,
  idToUrl: Map<string, string>,
  srcToUrl: Map<string, string>
): string {
  if (typeof html !== 'string') return html;
  if (!/<(img|audio|video|source)\b/i.test(html)) return html;

  return html.replace(MEDIA_TAG_RE, (tag, tagName) => {
    // Resolve the target URL for this tag, confined to the tag itself so we
    // never corrupt a URL we already inserted (a resolved URL contains the
    // original relative src as a substring).
    let url: string | undefined;

    // Prefer the asset id (how the player tags images, often AV wrappers too).
    // Attributes may use single or double quotes.
    const id = tag.match(/data-asset-variable\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (id && idToUrl.has(id)) {
      url = idToUrl.get(id);
    }

    // Else match the tag's own src against a known relative media src
    // (e.g. <source src="do_<id>/clip.mp4">).
    if (!url) {
      const curSrc = tag.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2];
      if (curSrc && srcToUrl.has(curSrc)) {
        url = srcToUrl.get(curSrc);
      }
    }

    if (!url) return tag;

    if (/\bsrc\s*=\s*["']/i.test(tag)) {
      return tag.replace(/(\bsrc\s*=\s*)(["'])[^"']*\2/i, `$1$2${url}$2`);
    }
    return tag.replace(new RegExp(`<${tagName}\\b`, 'i'), `<${tagName} src="${url}"`);
  });
}

/**
 * Walks a question object and rewrites media `src`s in every string field
 * (body, interaction option labels, editorState, answer, …) so we don't have to
 * know which exact fields carry HTML.
 */
function deepRewriteBodies(
  node: any,
  idToUrl: Map<string, string>,
  srcToUrl: Map<string, string>
): void {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const v = node[i];
      if (typeof v === 'string') node[i] = rewriteBodyMedia(v, idToUrl, srcToUrl);
      else if (v && typeof v === 'object') deepRewriteBodies(v, idToUrl, srcToUrl);
    }
  } else if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (typeof v === 'string') node[k] = rewriteBodyMedia(v, idToUrl, srcToUrl);
      else if (v && typeof v === 'object') deepRewriteBodies(v, idToUrl, srcToUrl);
    }
  }
}

/**
 * Resolves a downloaded question's images to local webview URLs.
 *
 * Two things are rewritten:
 *  1. `media[].src` — each relative src is pointed at the extracted file on disk.
 *  2. The body/option HTML `<img src>`s — keyed by `data-asset-variable` → asset
 *     id — which is what the player actually renders.
 *
 * Resolution is resilient: if the filename in `media[].src` isn't present on disk
 * (some published ecars mangle it — e.g. stripping the "%2F" from a path-encoded
 * asset name), we locate the real file by matching the asset's `id`, which is
 * embedded in the on-disk filename.
 */
async function resolveQuestionMedia(question: any, baseDir: string): Promise<any> {
  const media = _.get(question, 'media');
  if (!Array.isArray(media)) return question;

  const dirCache = new Map<string, string[]>();
  const idToUrl = new Map<string, string>();
  // Original relative src → resolved URL, for media tags that carry the path
  // (e.g. <source src>) rather than a data-asset-variable id.
  const srcToUrl = new Map<string, string>();
  const resolved: any[] = [];

  for (const m of media) {
    if (!m?.src || /^https?:\/\//i.test(m.src)) {
      resolved.push(m);
      if (m?.id && m?.src) idToUrl.set(m.id, m.src); // already a full URL
      continue;
    }

    const originalSrc = m.src;

    // media src is relative to baseDir (e.g. "do_<id>/image.png")
    const slash = m.src.lastIndexOf('/');
    const subDir = slash >= 0 ? m.src.slice(0, slash) : '';
    const wantedName = slash >= 0 ? m.src.slice(slash + 1) : m.src;
    const dirUri = subDir ? `${baseDir}/${subDir}` : baseDir;

    if (!dirCache.has(dirUri)) {
      dirCache.set(dirUri, await listDirFiles(dirUri));
    }
    const files = dirCache.get(dirUri) as string[];

    // Prefer the exact filename; otherwise repair by finding the file carrying
    // this asset's id (published ecars sometimes mangle media[].src).
    let actualName = wantedName;
    let found = files.includes(wantedName);
    if (!found) {
      const byId = m.id && files.find((f) => f.includes(m.id));
      if (byId) { actualName = byId; found = true; }
    }

    const finalUrl = localMediaUrl(dirUri, actualName);
    resolved.push({ ...m, src: finalUrl, baseUrl: '' });
    if (m.id && found) idToUrl.set(m.id, finalUrl);
    if (found) srcToUrl.set(originalSrc, finalUrl);
  }

  question.media = resolved;

  // Rewrite the media tags (img/audio/video/source) the player renders.
  deepRewriteBodies(question, idToUrl, srcToUrl);

  return question;
}

/**
 * Loads a single downloaded question (a child of a questionset) and resolves its
 * media to local webview URLs.
 *
 * Each question's ecar artifact zip is extracted to its own content dir, giving:
 *   content/{qid}/index.json          (full question: body, interactions, answer)
 *   content/{qid}/{qid}/<image files> (referenced by media[].src)
 */
async function loadLocalQuestion(questionId: string): Promise<any | null> {
  const entry = await contentDbService.getByIdentifier(questionId);
  if (!entry?.path) return null;

  const qDir = entry.path.replace(/\/$/, '');
  const indexJson = await readLocalJson(qDir, 'index.json');
  const question = _.get(indexJson, 'archive.items[0]');
  if (!question) return null;

  return resolveQuestionMedia(question, qDir);
}

/**
 * Builds the QuML player metadata (questionset hierarchy with full, media-resolved
 * questions merged in) from a downloaded ecar's stored files.
 *
 * Mirrors the online {@link useQumlContent} pipeline, but sources everything from
 * disk so the player runs with no network:
 * - Tree comes from hierarchy.json (`questionset`); question nodes are stubs there.
 * - Each question's full body + media comes from its own extracted index.json.
 *
 * Returns null if the content isn't downloaded or no questionset can be built,
 * so callers fall back to the API path.
 */
export async function loadLocalQumlContent(contentId: string): Promise<any | null> {
  const entry = await contentDbService.getByIdentifier(contentId);
  if (!entry || entry.content_state !== 2 || !entry.path) {
    return null;
  }

  const basePath = entry.path.replace(/\/$/, '');

  // The manifest is copied into the content dir during import; it carries the
  // root item (questionset OR a standalone question) with full inline data.
  const manifestJson = await readLocalJson(basePath, 'manifest.json');
  const manifestItems: any[] = _.get(manifestJson, 'archive.items', []);
  const rootItem = manifestItems.find((it) => it?.identifier === contentId);

  // ── Questionset: merge each question's full data into the hierarchy tree ──
  const hierarchyJson = await readLocalJson(basePath, 'hierarchy.json');
  let metadata = _.get(hierarchyJson, 'questionset') || _.get(hierarchyJson, 'questionSet');
  if (!metadata && rootItem && String(rootItem.mimeType).includes('questionset')) {
    metadata = rootItem; // tree only, question bodies filled in below
  }

  if (metadata) {
    const questionIds = collectQuestionIds(metadata);
    const questionMap = new Map<string, any>();
    for (const qid of questionIds) {
      const question = await loadLocalQuestion(qid);
      if (question) questionMap.set(qid, question);
    }

    metadata = replaceQuestionsInHierarchy(metadata, questionMap);
    metadata = ensureMaxScore(metadata);
    return metadata;
  }

  // ── Standalone question: the manifest item IS the full question. Its media
  //    files were extracted to content/{id}/<media src>; rewrite to local URLs.
  if (rootItem && (String(rootItem.mimeType).includes('question') || _.has(rootItem, 'body'))) {
    return resolveQuestionMedia(rootItem, basePath);
  }

  return null;
}
