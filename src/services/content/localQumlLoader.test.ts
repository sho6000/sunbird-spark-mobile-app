import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

vi.mock('../db/ContentDbService', () => ({
  contentDbService: { getByIdentifier: vi.fn() },
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { readFile: vi.fn(), readdir: vi.fn() },
  Encoding: { UTF8: 'utf8' },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { convertFileSrc: vi.fn((p: string) => `https://localhost/_capacitor_file_${p}`) },
}));

import { contentDbService } from '../db/ContentDbService';
import { loadLocalQumlContent } from './localQumlLoader';

const mockGetByIdentifier = vi.mocked(contentDbService.getByIdentifier);
const mockReadFile = vi.mocked(Filesystem.readFile);
const mockReaddir = vi.mocked(Filesystem.readdir);

/** Builds a readFile mock that returns JSON keyed by the filename in the path. */
function readFileByPath(map: Record<string, unknown>) {
  return vi.fn(async ({ path }: { path: string }) => {
    const match = Object.keys(map).find((suffix) => path.endsWith(suffix));
    if (!match) throw new Error(`not found: ${path}`);
    return { data: JSON.stringify(map[match]) } as any;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReaddir.mockResolvedValue({ files: [] } as any);
});

describe('loadLocalQumlContent — not downloaded', () => {
  it('returns null when there is no DB entry', async () => {
    mockGetByIdentifier.mockResolvedValue(null as any);
    expect(await loadLocalQumlContent('do_x')).toBeNull();
  });

  it('returns null when content_state is not 2', async () => {
    mockGetByIdentifier.mockResolvedValue({ content_state: 0, path: 'file:///c/do_x' } as any);
    expect(await loadLocalQumlContent('do_x')).toBeNull();
  });
});

describe('loadLocalQumlContent — standalone question', () => {
  it('returns the question with media and body <img> rewritten to local URLs', async () => {
    mockGetByIdentifier.mockResolvedValue({
      content_state: 2,
      path: 'file:///c/do_q/',
      mime_type: 'application/vnd.sunbird.question',
    } as any);

    mockReadFile.mockImplementation(
      readFileByPath({
        'manifest.json': {
          archive: {
            items: [
              {
                identifier: 'do_q',
                mimeType: 'application/vnd.sunbird.question',
                body: '<img data-asset-variable="a1" src="/assets/public/content/x.png" />',
                media: [{ id: 'a1', type: 'image', src: 'do_q/a1_img.png' }],
              },
            ],
          },
        },
      }),
    );
    mockReaddir.mockResolvedValue({ files: [{ name: 'a1_img.png' }] } as any);

    const result = await loadLocalQumlContent('do_q');

    const expectedUrl = 'https://localhost/_capacitor_file_file:///c/do_q/do_q/a1_img.png';
    expect(result.media[0].src).toBe(expectedUrl);
    expect(result.body).toContain(`src="${expectedUrl}"`);
    expect(result.body).not.toContain('/assets/public/content/x.png');
  });

  it('rewrites <video> body tags keyed by data-asset-variable', async () => {
    mockGetByIdentifier.mockResolvedValue({
      content_state: 2,
      path: 'file:///c/do_q/',
      mime_type: 'application/vnd.sunbird.question',
    } as any);

    mockReadFile.mockImplementation(
      readFileByPath({
        'manifest.json': {
          archive: {
            items: [
              {
                identifier: 'do_q',
                mimeType: 'application/vnd.sunbird.question',
                body: '<video data-asset-variable="v1" src="do_q/clip.mp4" controls></video>',
                media: [{ id: 'v1', type: 'video', src: 'do_q/clip.mp4' }],
              },
            ],
          },
        },
      }),
    );
    mockReaddir.mockResolvedValue({ files: [{ name: 'clip.mp4' }] } as any);

    const result = await loadLocalQumlContent('do_q');

    const expectedUrl = 'https://localhost/_capacitor_file_file:///c/do_q/do_q/clip.mp4';
    expect(result.media[0].src).toBe(expectedUrl);
    expect(result.body).toContain(`src="${expectedUrl}"`);
    expect(result.body).not.toContain('src="do_q/clip.mp4"');
  });

  it('rewrites <source> tags by literal relative src (no data-asset-variable)', async () => {
    mockGetByIdentifier.mockResolvedValue({
      content_state: 2,
      path: 'file:///c/do_q/',
      mime_type: 'application/vnd.sunbird.question',
    } as any);

    mockReadFile.mockImplementation(
      readFileByPath({
        'manifest.json': {
          archive: {
            items: [
              {
                identifier: 'do_q',
                mimeType: 'application/vnd.sunbird.question',
                body: '<audio controls><source src="do_q/sound.mp3" type="audio/mpeg"></audio>',
                media: [{ id: 'a1', type: 'audio', src: 'do_q/sound.mp3' }],
              },
            ],
          },
        },
      }),
    );
    mockReaddir.mockResolvedValue({ files: [{ name: 'sound.mp3' }] } as any);

    const result = await loadLocalQumlContent('do_q');

    const expectedUrl = 'https://localhost/_capacitor_file_file:///c/do_q/do_q/sound.mp3';
    expect(result.media[0].src).toBe(expectedUrl);
    expect(result.body).toContain(`src="${expectedUrl}"`);
    expect(result.body).not.toContain('src="do_q/sound.mp3"');
  });

  it('handles single-quoted src attributes', async () => {
    mockGetByIdentifier.mockResolvedValue({
      content_state: 2,
      path: 'file:///c/do_q/',
      mime_type: 'application/vnd.sunbird.question',
    } as any);

    mockReadFile.mockImplementation(
      readFileByPath({
        'manifest.json': {
          archive: {
            items: [
              {
                identifier: 'do_q',
                mimeType: 'application/vnd.sunbird.question',
                body: "<img data-asset-variable='a1' src='/old.png' />",
                media: [{ id: 'a1', type: 'image', src: 'do_q/a1.png' }],
              },
            ],
          },
        },
      }),
    );
    mockReaddir.mockResolvedValue({ files: [{ name: 'a1.png' }] } as any);

    const result = await loadLocalQumlContent('do_q');

    const expectedUrl = 'https://localhost/_capacitor_file_file:///c/do_q/do_q/a1.png';
    expect(result.media[0].src).toBe(expectedUrl);
    // a single src is present, pointed at the local URL (no duplicate src inserted)
    expect(result.body).toContain(expectedUrl);
    expect(result.body).not.toContain("src='/old.png'");
    expect((result.body.match(/\bsrc\s*=/g) || []).length).toBe(1);
  });

  it('repairs mangled "%2F" filenames via asset-id match and percent-escapes the URL', async () => {
    mockGetByIdentifier.mockResolvedValue({
      content_state: 2,
      path: 'file:///c/do_q/',
      mime_type: 'application/vnd.sunbird.question',
    } as any);

    mockReadFile.mockImplementation(
      readFileByPath({
        'manifest.json': {
          archive: {
            items: [
              {
                identifier: 'do_q',
                mimeType: 'application/vnd.sunbird.question',
                body: '<img data-asset-variable="do_a1" src="/assets/public/content%2Fx.jpg" />',
                // src is mangled (slashes stripped) — won't match the disk file
                media: [{ id: 'do_a1', type: 'image', src: 'do_q/contentdo_a1artifact.jpg' }],
              },
            ],
          },
        },
      }),
    );
    // The real file on disk keeps the path-encoded name and contains the asset id
    mockReaddir.mockResolvedValue({
      files: [{ name: 'content%2Fdo_a1%2Fartifact%2Fimg.jpg' }],
    } as any);

    const result = await loadLocalQumlContent('do_q');

    // %2F must be escaped to %252F so the file server decodes it back correctly
    expect(result.media[0].src).toContain('%252F');
    expect(result.body).toContain(result.media[0].src);
  });
});

describe('loadLocalQumlContent — questionset', () => {
  it('merges each child question (full body + local media) into the hierarchy', async () => {
    mockGetByIdentifier.mockImplementation(async (id: string) => {
      if (id === 'do_qs') {
        return { content_state: 2, path: 'file:///c/do_qs/', mime_type: 'application/vnd.sunbird.questionset' } as any;
      }
      if (id === 'q1') {
        return { content_state: 2, path: 'file:///c/q1' } as any;
      }
      return null as any;
    });

    mockReadFile.mockImplementation(
      readFileByPath({
        'do_qs/hierarchy.json': {
          questionset: {
            identifier: 'do_qs',
            mimeType: 'application/vnd.sunbird.questionset',
            outcomeDeclaration: { maxScore: { defaultValue: 1 } },
            children: [{ identifier: 'q1', mimeType: 'application/vnd.sunbird.question' }],
          },
        },
        'q1/index.json': {
          archive: {
            items: [
              {
                identifier: 'q1',
                mimeType: 'application/vnd.sunbird.question',
                body: '<img data-asset-variable="m1" src="/old.png" />',
                media: [{ id: 'm1', type: 'image', src: 'do_q1/m1.png' }],
              },
            ],
          },
        },
      }),
    );
    mockReaddir.mockResolvedValue({ files: [{ name: 'm1.png' }] } as any);

    const result = await loadLocalQumlContent('do_qs');

    const child = result.children[0];
    expect(child.identifier).toBe('q1');
    // stub was replaced by the full question, with media + body rewritten locally
    expect(child.media[0].src).toContain('_capacitor_file_');
    expect(child.body).toContain(child.media[0].src);
    expect(child.body).not.toContain('/old.png');
  });
});
