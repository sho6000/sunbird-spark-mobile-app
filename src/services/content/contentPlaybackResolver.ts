import { Capacitor } from '@capacitor/core';
import { Filesystem, Encoding } from '@capacitor/filesystem';
import { contentDbService } from '../db/ContentDbService';

const TAG = '[contentPlaybackResolver]';

/**
 * Extract the `/content/...` suffix from a streamingUrl and prepend `/assets/public`.
 *
 * Extracts the exact suffix from the API's streaming URL to dynamically resolve 
 * the local restructuring folder path.
 *
 * Returns null if the streamingUrl doesn't contain `/content/`.
 */
export function toAssetsPublicPath(streamingUrl: string): string | null {
  try {
    const url = new URL(streamingUrl);
    const idx = url.pathname.indexOf('/content/');
    if (idx !== -1) {
      return `/assets/public${url.pathname.slice(idx)}`;
    }
  } catch {
    console.warn("Invalid URL", streamingUrl);
  }
  return null;
}


/**
 * Resolves content metadata URLs to local filesystem paths when the content
 * has been downloaded (content_state === 2). This enables offline playback
 * across all player types.
 *
 * Players use different URL fields:
 * - Video: prefers `streamingUrl`, falls back to `artifactUrl`
 * - PDF/ePub: uses `artifactUrl`
 * - ECML/H5P: uses `streamingUrl` as the base directory
 * - QuML: uses hierarchy JSON (no URL resolution needed)
 *
 * Capacitor.convertFileSrc() converts native file:// paths to webview-accessible
 * URLs (e.g. capacitor://localhost/_capacitor_file_/...).
 */
export async function resolveContentForPlayer<T extends Record<string, any>>(
  contentId: string,
  metadata: T,
): Promise<T> {
  try {
    const entry = await contentDbService.getByIdentifier(contentId);

    if (!entry || entry.content_state !== 2 || !entry.path) {
      return metadata;
    }

    const resolved: Record<string, any> = { ...metadata };

    // entry.path is the content DIRECTORY (file:///…/content/<id>/).
    // Defensive: if it looks like a file path (has extension), use parent dir.
    let basePath = entry.path.replace(/\/$/, '');
    if (/\.\w{2,5}$/.test(basePath)) {
      basePath = basePath.substring(0, basePath.lastIndexOf('/'));
    }

    console.debug(TAG, 'resolving', {
      contentId,
      entryPath: entry.path,
      basePath,
      artifactUrl: resolved.artifactUrl,
      streamingUrl: resolved.streamingUrl,
      mimeType: resolved.mimeType,
    });

    // Capacitor.convertFileSrc converts file:// → https://localhost/_capacitor_file_/...
    // This absolute URL is required for <video>, <img>, etc. to load local files
    // through the Capacitor webview's asset handler.
    const toWebviewUrl = (path: string) => Capacitor.convertFileSrc(path);

    let localBasename = '';

    // Extract basename from artifactUrl
    if (resolved.artifactUrl) {
      const basename = String(resolved.artifactUrl).split('/').pop();
      if (basename) {
        localBasename = basename;
        // PDF and ePub players concatenate basePath + '/' + artifactUrl internally.
        // Giving them a full absolute path would result in a duplicate URL.
        resolved.artifactUrl = basename;
      }
    }

    // The CDN artifactUrl basename (e.g. "do_xxx_timestamp_video.mp4") often differs
    // from the actual extracted filename (e.g. "video.mp4") because ECAR artifact zips
    // store the file under its original name without the content-ID prefix.
    // Verify the file exists; if not, scan the directory for a file with the same
    // extension so the player can locate it.
    const mime = String(resolved.mimeType);
    const needsFileResolution = mime.startsWith('video/')
      || mime === 'application/pdf'
      || mime === 'application/epub'
      || mime === 'application/epub+zip';
    if (localBasename && needsFileResolution) {
      localBasename = await resolveActualFilename(basePath, localBasename);
      resolved.artifactUrl = localBasename;
    }

    // Resolve streamingUrl for local playback.
    // IMPORTANT: The sunbird-video-player, when isAvailableLocally=true, constructs
    // the final URL as `streamingUrl + '/' + artifactUrl`. So streamingUrl must be
    // the DIRECTORY path, not the full file URL — otherwise the filename gets doubled
    // (e.g. .../bunny.webm/bunny.webm).
    const isH5pOrHtml = mime === 'application/vnd.ekstep.h5p-archive'
      || mime === 'application/vnd.ekstep.html-archive';
    const isScorm = mime === 'application/vnd.ekstep.scorm-archive';
    const isEcml = mime === 'application/vnd.ekstep.ecml-archive';

    if (String(resolved.mimeType).startsWith('video/')) {
      // Video player: set streamingUrl to directory so player appends artifactUrl
      resolved.streamingUrl = toWebviewUrl(basePath);
    } else if (isH5pOrHtml || isScorm) {
      // H5P/HTML: The renderer sets globalConfig.basepath = streamingUrl and the
      // htmlrenderer plugin uses basepath + "/index.html" as the iframe src.
      // After import, restructureForRenderer places files at:
      //   content/{id}/assets/public/content/{h5p|html}/{id}-{suffix}/
      const assetsPath = toAssetsPublicPath(String(resolved.streamingUrl || ''));
      if (assetsPath) {
        resolved.streamingUrl = toWebviewUrl(`${basePath}${assetsPath}`);
      } else {
        resolved.streamingUrl = toWebviewUrl(basePath);
      }
    } else if (isEcml) {
      // ECML: The renderer sets globalConfig.basepath = e.streamingUrl.
      // The CDN streamingUrl typically points to a versioned subdirectory
      // (e.g. .../do_xxx-latest) but the local artifact ZIP extracts all files
      // with absolute paths (e.g. /index.json, /widgets/…) directly to the
      // content root — NOT into a subdirectory. Set streamingUrl to the content
      // root so the renderer's initByJSON fetches {contentRoot}/index.json which
      // is where our jszip extraction places it.
      resolved.streamingUrl = toWebviewUrl(basePath);
    } else if (resolved.streamingUrl) {
      const basename = String(resolved.streamingUrl).split('/').pop();
      if (basename && !basename.includes('.m3u8')) {
        resolved.streamingUrl = toWebviewUrl(`${basePath}/${basename}`);
      } else if (localBasename) {
        resolved.streamingUrl = toWebviewUrl(`${basePath}/${localBasename}`);
      }
    }

    // Resolve appIcon / posterImage to local file if downloaded
    if (resolved.appIconLocal) {
      resolved.appIcon = toWebviewUrl(`${basePath}/${resolved.appIconLocal}`);
      if (resolved.posterImage) {
        resolved.posterImage = resolved.appIcon;
      }
    }

    // For ECML content: load body from local filesystem if not already present.
    // The renderer needs the body JSON (index.json/index.ecml) to render stages.
    // Without it, the renderer fetches from the API — which fails offline.
    if (!resolved.body && String(resolved.mimeType) === 'application/vnd.ekstep.ecml-archive') {
      resolved.body = await loadLocalBody(basePath);
    }

    // Set absolute basePath for all players (PDF/ECML use this as the root dir)
    resolved.basePath = toWebviewUrl(basePath);
    resolved.isAvailableLocally = true;

    console.debug(TAG, 'resolved', {
      contentId,
      artifactUrl: resolved.artifactUrl,
      streamingUrl: resolved.streamingUrl,
      basePath: resolved.basePath,
    });

    return resolved as T;
  } catch (error) {
    console.warn(
      TAG,
      'offline playback resolution failed; falling back to original metadata',
      { contentId, error },
    );
    // If resolution fails, return original metadata (online playback still works)
    return metadata;
  }
}

/**
 * Verify the expected filename exists in the content directory.
 * If not found, scan the directory for a file with the same extension.
 *
 * This handles the common case where the CDN artifactUrl has an ID-prefixed
 * name (e.g. "do_xxx_timestamp_video.mp4") but the ECAR artifact zip stores
 * the file under its original name (e.g. "video.mp4").
 */
async function resolveActualFilename(dirPath: string, expectedName: string): Promise<string> {
  try {
    await Filesystem.stat({ path: `${dirPath}/${expectedName}` });
    return expectedName;
  } catch {
    // Expected file not found — scan directory for a file with the same extension
    try {
      const ext = expectedName.split('.').pop()?.toLowerCase();
      if (!ext) return expectedName;
      const { files } = await Filesystem.readdir({ path: dirPath });
      const match = files.find(
        (f) => f.type === 'file' && f.name.toLowerCase().endsWith(`.${ext}`),
      );
      if (match) {
        console.debug(TAG, `Filename remapped: ${expectedName} → ${match.name}`);
        return match.name;
      }
    } catch { /* readdir failed — fall through */ }
    return expectedName;
  }
}

/**
 * Try to read the ECML body from the extracted content directory.
 * Checks for index.json first, then index.ecml (JSON-encoded).
 */
async function loadLocalBody(basePath: string): Promise<Record<string, unknown> | null> {
  for (const filename of ['index.json', 'index.ecml']) {
    try {
      const result = await Filesystem.readFile({
        path: `${basePath}/${filename}`,
        encoding: Encoding.UTF8,
      });
      const parsed = JSON.parse(result.data as string);
      console.debug(TAG, 'loaded local body from', filename);
      return parsed;
    } catch {
      // File doesn't exist or isn't valid JSON — try next
    }
  }
  return null;
}