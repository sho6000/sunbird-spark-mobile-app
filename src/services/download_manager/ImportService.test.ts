import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportService } from './ImportService';
import { DatabaseService } from '../db/DatabaseService';
import { ContentDbService } from '../db/ContentDbService';
import type { ContentEntry } from './types';

// ImportService instantiates `new ContentService()` once at module load, so
// per-test mockImplementation() on the constructor wouldn't reach that
// already-constructed singleton. Share one mock function instead (vi.hoisted
// so it's available inside the vi.mock factory below).
const { mockContentRead } = vi.hoisted(() => ({ mockContentRead: vi.fn() }));

vi.mock('../ContentService', () => ({
  ContentService: vi.fn().mockImplementation(function ContentServiceMock(this: any) {
    this.contentRead = mockContentRead;
  }),
}));

// Mock all native dependencies
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    getUri: vi.fn().mockResolvedValue({ uri: 'file:///tmp/test' }),
    rmdir: vi.fn().mockResolvedValue(undefined),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    // Use valid empty object base64 to avoid atob errors in tests that reach it
    readFile: vi.fn().mockResolvedValue({ data: 'e30=' }),
    copy: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 1024 }),
    readdir: vi.fn().mockResolvedValue({ files: [] }),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
  },
  Directory: { Data: 'DATA', Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));

vi.mock('capa-zip', () => ({
  Zip: {
    unzip: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../db/DatabaseService', () => ({ DatabaseService: vi.fn(), databaseService: {} }));
vi.mock('../db/ContentDbService', () => ({ ContentDbService: vi.fn(), contentDbService: {} }));
vi.mock('@capacitor/core', async () => {
  const actual = await vi.importActual('@capacitor/core');
  return {
    ...actual,
    CapacitorHttp: {
      get: vi.fn(),
    },
  };
});
// Mock Web Workers
class MockWorker {
  onmessage: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn().mockImplementation(function (this: MockWorker, data: any) {
    // Simulate async response
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({
          data: {
            status: 'success',
            files: { 'index.ecml': new Uint8Array([1, 2, 3]) }
          }
        });
      }
    }, 0);
  });
}

vi.stubGlobal('Worker', vi.fn().mockImplementation(function () {
  return new MockWorker();
}));

function makeMockDb() {
  return {
    transaction: vi.fn().mockImplementation(async (fn: () => Promise<any>) => fn()),
  } as unknown as DatabaseService;
}

function makeMockContentDb() {
  return {
    getByIdentifiers: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue(undefined),
    getByIdentifier: vi.fn().mockResolvedValue(null),
    updateSizeOnDevice: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  } as unknown as ContentDbService;
}

describe('ImportService', () => {
  let db: DatabaseService;
  let contentDb: ContentDbService;
  let svc: ImportService;

  beforeEach(() => {
    vi.clearAllMocks();
    db = makeMockDb();
    contentDb = makeMockContentDb();
    svc = new ImportService(db, contentDb);
    mockContentRead.mockReset().mockResolvedValue({ data: { content: {} } });
  });

  // ── import — manifest not found ──

  describe('import — manifest not found', () => {
    it('returns FAILED when neither hierarchy.json nor manifest.json exists', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      vi.mocked(Filesystem.readFile).mockRejectedValue(new Error('not found'));

      const result = await svc.import('do_123', '/path/to/file.ecar');
      expect(result.status).toBe('FAILED');
      expect(result.errors?.[0]).toBe('IMPORT_FAILED_MANIFEST_NOT_FOUND');
    });

    it('falls back to hierarchy.json if manifest.json is missing', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      vi.mocked(Filesystem.readFile).mockImplementation(async (options) => {
        if (options.path.endsWith('manifest.json')) throw new Error('not found');
        return { data: JSON.stringify({ ver: '1.1', archive: { items: [{ identifier: 'do_123', mimeType: 'collection' }] } }) };
      });

      const result = await svc.import('do_123', '/path/to/file.ecar');
      expect(result.status).toBe('SUCCESS');
    });
  });

  // ── import — unsupported manifest ──

  describe('import — unsupported manifest version', () => {
    it('returns FAILED for ver 1.0 manifest', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({ ver: 1.0, archive: { items: [] } }),
      } as any);

      const result = await svc.import('do_123', '/path/to/file.ecar');
      expect(result.status).toBe('FAILED');
      expect(result.errors?.[0]).toBe('IMPORT_FAILED_UNSUPPORTED_MANIFEST');
    });
  });

  // ── import — empty items ──

  describe('import — no items in manifest', () => {
    it('returns FAILED when archive.items is missing', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({ ver: '1.1', archive: {} }),
      } as any);

      const result = await svc.import('do_123', '/path/to/file.ecar');
      expect(result.status).toBe('FAILED');
      expect(result.errors?.[0]).toBe('IMPORT_FAILED_NO_CONTENT_METADATA');
    });
  });

  // ── import — all items already exist ──

  describe('import — all items already imported', () => {
    it('returns ALREADY_EXIST when all items are duplicates', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');

      const existingContent: ContentEntry = {
        identifier: 'do_item1',
        server_data: '',
        local_data: JSON.stringify({ pkgVersion: 5 }),
        mime_type: 'application/pdf',
        path: '/content/do_item1',
        visibility: 'Default',
        server_last_updated_on: null,
        local_last_updated_on: '',
        ref_count: 1,
        content_state: 2,
        content_type: 'resource',
        audience: 'Learner',
        size_on_device: 1024,
        pragma: '',
        manifest_version: '1.1',
        dialcodes: '',
        child_nodes: '',
        primary_category: '',
      };

      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({
          ver: '1.1',
          archive: {
            items: [{ identifier: 'do_item1', pkgVersion: 3, mimeType: 'application/pdf' }],
          },
        }),
      } as any);

      vi.mocked(contentDb.getByIdentifiers).mockResolvedValue([existingContent]);

      const result = await svc.import('do_123', '/path/to/file.ecar');
      expect(result.status).toBe('ALREADY_EXIST');
    });
  });

  // ── import — successful import ──

  describe('import — success', () => {
    it('imports new items and writes to content DB', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({
          ver: '1.1',
          archive: {
            items: [
              {
                identifier: 'do_new',
                mimeType: 'application/pdf',
                contentDisposition: 'inline',
                contentEncoding: 'identity',
                artifactUrl: 'do_new/artifact.pdf',
                contentType: 'resource',
                visibility: 'Default',
                primaryCategory: 'teacher resource',
              },
            ],
          },
        }),
      } as any);

      vi.mocked(contentDb.getByIdentifiers).mockResolvedValue([]);

      const onProgress = vi.fn();
      const result = await svc.import('do_123', '/path/to/file.ecar', undefined, undefined, onProgress);

      expect(result.status).toBe('SUCCESS');
      expect(result.identifiers).toContain('do_new');
      expect(contentDb.upsert).toHaveBeenCalledOnce();

      // Verify progress callbacks were called in order
      const phases = onProgress.mock.calls.map(([phase]: [string]) => phase);
      expect(phases).toContain('EXTRACTING');
      expect(phases).toContain('VALIDATING');
      expect(phases).toContain('IMPORTING_CONTENT');
      expect(phases).toContain('CREATING_MANIFEST');
      expect(phases).toContain('CLEANING_UP');
      expect(phases).toContain('COMPLETED');
    });
  });

  // ── import — cancellation ──

  describe('import — cancellation', () => {
    it('returns CANCELLED when isCancelled returns true', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({
          ver: '1.1',
          archive: {
            items: [{ identifier: 'do_item', mimeType: 'application/pdf', artifactUrl: 'x' }],
          },
        }),
      } as any);

      vi.mocked(contentDb.getByIdentifiers).mockResolvedValue([]);

      // Cancel on the import content step
      let callCount = 0;
      const isCancelled = vi.fn().mockImplementation(async () => {
        callCount++;
        return callCount >= 3; // cancel on third check
      });

      const result = await svc.import('do_123', '/path/to/file.ecar', undefined, isCancelled);
      expect(result.status).toBe('CANCELLED');
    });
  });

  // ── import — cleanup on failure ──

  describe('import — cleanup on failure', () => {
    it('cleans up temp dir on unexpected error', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      const { Zip } = await import('capa-zip');

      // Fail on the very first unzip (.ecar stage)
      vi.mocked(Zip.unzip).mockRejectedValueOnce(new Error('unzip failed'));

      const result = await svc.import('do_123', '/path/to/file.ecar');
      expect(result.status).toBe('FAILED');
      // rmdir should be called in the finally block
      expect(Filesystem.rmdir).toHaveBeenCalled();
    });
  });

  // ── import — expired draft filtering ──

  describe('import — expired drafts are skipped', () => {
    it('skips items with status=Draft and past expires date', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({
          ver: '1.1',
          archive: {
            items: [
              {
                identifier: 'do_expired',
                mimeType: 'application/pdf',
                status: 'Draft',
                expires: '2020-01-01T00:00:00Z',
                artifactUrl: 'do_expired/artifact.pdf',
              },
            ],
          },
        }),
      } as any);

      vi.mocked(contentDb.getByIdentifiers).mockResolvedValue([]);

      const result = await svc.import('do_123', '/path/to/file.ecar');
      expect(result.status).toBe('ALREADY_EXIST'); // all items filtered out
      expect(contentDb.upsert).not.toHaveBeenCalled();
    });
  });

  // ── server_data preservation ──

  describe('import — preserves existing server_data', () => {
    it('keeps existing server_data when re-importing content', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({
          ver: '1.1',
          archive: {
            items: [
              {
                identifier: 'do_existing',
                mimeType: 'application/pdf',
                contentDisposition: 'inline',
                contentEncoding: 'identity',
                artifactUrl: 'do_existing/artifact.pdf',
                contentType: 'resource',
                pkgVersion: 10,
                visibility: 'Default',
              },
            ],
          },
        }),
      } as any);

      const existing: ContentEntry = {
        identifier: 'do_existing',
        server_data: JSON.stringify({ hierarchy: { children: [] }, name: 'Course' }),
        local_data: JSON.stringify({ pkgVersion: 5 }),
        mime_type: 'application/pdf',
        path: '/content/do_existing',
        visibility: 'Default',
        server_last_updated_on: null,
        local_last_updated_on: '',
        ref_count: 1,
        content_state: 0, // ONLY_SPINE — allows re-import
        content_type: 'resource',
        audience: 'Learner',
        size_on_device: 1024,
        pragma: '',
        manifest_version: '1.1',
        dialcodes: '',
        child_nodes: '',
        primary_category: '',
      };

      vi.mocked(contentDb.getByIdentifiers).mockResolvedValue([existing]);

      const result = await svc.import('do_123', '/path/to/file.ecar');
      expect(result.status).toBe('SUCCESS');

      const upsertedRow = vi.mocked(contentDb.upsert).mock.calls[0][0] as ContentEntry;
      expect(upsertedRow.server_data).toBe(existing.server_data);
    });
  });

  // ── constructContentRow (tested via import) ──

  describe('import — content_state never downgrades', () => {
    it('keeps ARTIFACT_AVAILABLE when existing has higher state', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({
          ver: '1.1',
          archive: {
            items: [
              {
                identifier: 'do_existing',
                mimeType: 'application/pdf',
                contentDisposition: 'online', // would normally be no file op
                artifactUrl: '',              // no artifact → ONLY_SPINE (0)
                contentType: 'resource',
                pkgVersion: 10,
                visibility: 'Default',
              },
            ],
          },
        }),
      } as any);

      // Existing content has ARTIFACT_AVAILABLE (2) with lower pkgVersion
      const existing: ContentEntry = {
        identifier: 'do_existing',
        server_data: '',
        local_data: JSON.stringify({ pkgVersion: 5 }),
        mime_type: 'application/pdf',
        path: '/content/do_existing',
        visibility: 'Default',
        server_last_updated_on: null,
        local_last_updated_on: '',
        ref_count: 1,
        content_state: 2, // ARTIFACT_AVAILABLE
        content_type: 'resource',
        audience: 'Learner',
        size_on_device: 1024,
        pragma: '',
        manifest_version: '1.1',
        dialcodes: '',
        child_nodes: '',
        primary_category: '',
      };

      vi.mocked(contentDb.getByIdentifiers).mockResolvedValue([existing]);

      const result = await svc.import('do_123', '/path/to/file.ecar');
      expect(result.status).toBe('SUCCESS');

      // Verify the upserted row keeps content_state = 2
      const upsertedRow = vi.mocked(contentDb.upsert).mock.calls[0][0] as ContentEntry;
      expect(upsertedRow.content_state).toBe(2);
      // ref_count incremented
      expect(upsertedRow.ref_count).toBe(2);
    });
  });

  // ── import — ECML fallback ──

  describe('import — ECML fallback', () => {
    it('falls back to worker extraction when capa-zip throws path errors', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      const { Zip } = await import('capa-zip');

      // 1. Mock capa-zip: 
      // First call (ECAR unzip) -> Success
      // Second call (ECML item unzip) -> Fail with path error
      vi.mocked(Zip.unzip)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Invalid zip entry path: /assets/index.html'));

      // 2. Mock manifest read + artifact read
      // First call (manifest.json) -> JSON string
      // Subsequent calls (artifact or others) -> valid Base64
      vi.mocked(Filesystem.readFile).mockImplementation(async (options) => {
        if (options.path.endsWith('manifest.json')) {
          return {
            data: JSON.stringify({
              ver: '1.1',
              archive: {
                items: [{
                  identifier: 'do_ecml',
                  mimeType: 'application/vnd.ekstep.ecml-archive',
                  artifactUrl: 'do_ecml/artifact.zip',
                  visibility: 'Default'
                }]
              }
            })
          } as any;
        }
        return { data: 'e30=' } as any; // valid base64 for {}
      });

      const result = await svc.import('do_ecml', '/p.ecar');
      expect(result.status).toBe('SUCCESS');
      // Verify worker was "instantiated" (via global Worker stub)
      expect(vi.mocked(Worker)).toHaveBeenCalled();
    });
  });

  // ── import — H5P/HTML fallback ──

  describe('import — H5P/HTML fallback', () => {
    it('falls back to worker extraction when H5P zip has absolute entry paths', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      const { Zip } = await import('capa-zip');

      // First call (ECAR unzip) -> Success
      // Second call (H5P item unzip) -> Fail with path error
      vi.mocked(Zip.unzip)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Error unzipping file: Invalid zip entry path: /content/H5P.Question-1.2/scripts/question.js'));

      vi.mocked(Filesystem.readFile).mockImplementation(async (options) => {
        if (options.path.endsWith('manifest.json')) {
          return {
            data: JSON.stringify({
              ver: '1.1',
              archive: {
                items: [{
                  identifier: 'do_h5p',
                  mimeType: 'application/vnd.ekstep.h5p-archive',
                  artifactUrl: 'do_h5p/artifact.zip',
                  status: 'Live',
                  visibility: 'Default',
                }]
              }
            })
          } as any;
        }
        return { data: 'e30=' } as any;
      });

      vi.mocked(Filesystem.readdir).mockResolvedValue({
        files: [{ name: 'index.html' }, { name: 'assets' }],
      } as any);

      const result = await svc.import('do_h5p', '/p.ecar');
      expect(result.status).toBe('SUCCESS');
      expect(vi.mocked(Worker)).toHaveBeenCalled();
    });
  });

  // ── import — QuML question artifact (unzipArtifact fallback) ──

  describe('import — QuML question artifact fallback', () => {
    const qumlManifest = (artifactUrl = 'do_q/artifact.zip') => ({
      ver: '1.1',
      archive: {
        items: [{
          identifier: 'do_q',
          mimeType: 'application/vnd.sunbird.question',
          artifactUrl,
          visibility: 'Default',
        }],
      },
    });

    it('falls back to worker extraction when capa-zip rejects absolute entry paths', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      const { Zip } = await import('capa-zip');

      // 1st call (ECAR unzip) succeeds; 2nd call (question artifact) hits absolute paths
      vi.mocked(Zip.unzip)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Invalid zip entry path: /index.json'));

      vi.mocked(Filesystem.readFile).mockImplementation(async (options) => {
        if (options.path.endsWith('manifest.json')) {
          return { data: JSON.stringify(qumlManifest()) } as any;
        }
        return { data: 'e30=' } as any;
      });

      const result = await svc.import('do_q', '/p.ecar');
      expect(result.status).toBe('SUCCESS');
      expect(vi.mocked(Worker)).toHaveBeenCalled();
    });

    it('re-throws non-zip errors instead of attempting worker extraction', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      const { Zip } = await import('capa-zip');

      // ECAR unzip succeeds; question artifact fails with an unrelated (non-zip) error
      vi.mocked(Zip.unzip)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));

      vi.mocked(Filesystem.readFile).mockImplementation(async (options) => {
        if (options.path.endsWith('manifest.json')) {
          return { data: JSON.stringify(qumlManifest()) } as any;
        }
        return { data: 'e30=' } as any;
      });

      const result = await svc.import('do_q', '/p.ecar');
      expect(result.status).toBe('FAILED');
      expect(result.errors?.[0]).toContain('ENOSPC');
      expect(vi.mocked(Worker)).not.toHaveBeenCalled();
    });
  });

  // ── import — visibility upgrade (standalone import) ──

  describe('import — visibility upgrade', () => {
    it('upgrades visibility from Parent to Default for standalone imports', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({
          ver: '1.1',
          archive: {
            items: [
              {
                identifier: 'do_item1',
                mimeType: 'application/pdf',
                contentDisposition: 'inline',
                contentEncoding: 'identity',
                artifactUrl: 'do_item1/artifact.pdf',
                visibility: 'Default',
              },
            ],
          },
        }),
      } as any);

      const existing: ContentEntry = {
        identifier: 'do_item1',
        server_data: '',
        local_data: JSON.stringify({ pkgVersion: 5 }),
        mime_type: 'application/pdf',
        path: '/content/do_item1',
        visibility: 'Parent',
        server_last_updated_on: null,
        local_last_updated_on: '',
        ref_count: 1,
        content_state: 2,
        content_type: 'resource',
        audience: 'Learner',
        size_on_device: 1024,
        pragma: '',
        manifest_version: '1.1',
        dialcodes: '',
        child_nodes: '',
        primary_category: '',
      };

      vi.mocked(contentDb.getByIdentifiers).mockResolvedValue([existing]);

      const result = await svc.import('do_item1', '/path/to/file.ecar');
      expect(result.status).toBe('SUCCESS');

      const upsertedRow = vi.mocked(contentDb.upsert).mock.calls[0][0] as ContentEntry;
      expect(upsertedRow.visibility).toBe('Default');
    });
  });

  // ── Helpers / Edge Cases ──

  describe('restructureForRenderer', () => {
    it('restructures H5P content correctly', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({
          ver: '1.1',
          archive: {
            items: [
              {
                identifier: 'do_h5p',
                mimeType: 'application/vnd.ekstep.h5p-archive',
                status: 'Live',
                artifactUrl: 'do_h5p/artifact.h5p',
              },
            ],
          },
        }),
      } as any);

      vi.mocked(Filesystem.readdir).mockResolvedValue({
        files: [{ name: 'index.html' }, { name: 'assets' }], // assets should be skipped
      } as any);

      const result = await svc.import('do_h5p', '/path/to/file.ecar');
      expect(result.status).toBe('SUCCESS');
      expect(Filesystem.rename).toHaveBeenCalledWith(expect.objectContaining({
        from: expect.stringContaining('index.html'),
        to: expect.stringContaining('assets/public/content/h5p/do_h5p-latest/index.html'),
      }));
    });
  });

  describe('downloadIcon', () => {
    it('downloads and saves application icon', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');

      const { CapacitorHttp } = await import('@capacitor/core');

      vi.mocked(CapacitorHttp.get).mockResolvedValue({
        status: 200,
        data: 'base64iconbytes',
      } as any);

      vi.mocked(contentDb.getByIdentifier).mockResolvedValue({
        identifier: 'do_123',
        local_data: JSON.stringify({ name: 'Test' }),
      } as any);

      // Trigger via import with contentMeta
      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({ ver: '1.1', archive: { items: [{ identifier: 'do_123', mimeType: 'pdf' }] } }),
      } as any);

      await svc.import('do_123', '/p.ecar', { appIcon: 'http://example.com/icon.png' });

      expect(CapacitorHttp.get).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://example.com/icon.png' }));
      expect(Filesystem.writeFile).toHaveBeenCalledWith(expect.objectContaining({
        path: expect.stringContaining('appIcon.png'),
        data: 'base64iconbytes',
      }));
      expect(contentDb.update).toHaveBeenCalledWith('do_123', expect.objectContaining({
        local_data: expect.stringContaining('appIconLocal'),
      }));
    });
  });

  describe('downloadTranscripts', () => {
    it('downloads, extracts, and rewrites transcript URLs to relative local paths', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      const { CapacitorHttp } = await import('@capacitor/core');
      const { Zip } = await import('capa-zip');

      vi.mocked(CapacitorHttp.get).mockResolvedValue({ status: 200, data: 'base64ecarbytes' } as any);

      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({ ver: '1.1', archive: { items: [{ identifier: 'do_123', mimeType: 'video/mp4' }] } }),
      } as any);

      vi.mocked(Filesystem.readdir).mockResolvedValue({
        files: [
          { name: 'en', type: 'directory' },
          { name: 'fr', type: 'directory' },
        ],
      } as any);

      vi.mocked(contentDb.getByIdentifier).mockResolvedValue({
        identifier: 'do_123',
        local_data: JSON.stringify({
          identifier: 'do_123',
          transcripts: [
            { language: 'English', identifier: 'c_en', languageCode: 'en', artifactUrl: 'https://cdn/en.vtt', wordByWordUrl: 'https://cdn/en.vtt' },
            { language: 'French', identifier: 'c_fr', languageCode: 'fr', artifactUrl: 'https://cdn/fr.vtt', wordByWordUrl: 'https://cdn/fr.vtt' },
          ],
        }),
        server_data: JSON.stringify({
          identifier: 'do_123',
          transcripts: [
            { language: 'English', identifier: 'c_en', languageCode: 'en', artifactUrl: 'https://cdn/en.vtt', wordByWordUrl: 'https://cdn/en.vtt' },
          ],
        }),
      } as any);

      await svc.import('do_123', '/p.ecar', {
        enrichment: { transcriptUrl: 'https://cdn/do_123_transcripts.ecar' },
      });

      expect(CapacitorHttp.get).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://cdn/do_123_transcripts.ecar' }));
      expect(Zip.unzip).toHaveBeenCalled();
      expect(Filesystem.copy).toHaveBeenCalledWith(expect.objectContaining({
        from: expect.stringContaining('en/captions.vtt'),
      }));
      expect(Filesystem.copy).toHaveBeenCalledWith(expect.objectContaining({
        from: expect.stringContaining('fr/captions.vtt'),
      }));

      const updateCall = vi.mocked(contentDb.update).mock.calls.find((c) => c[0] === 'do_123');
      expect(updateCall).toBeDefined();
      const updatedLocalData = JSON.parse((updateCall![1] as any).local_data);
      expect(updatedLocalData.transcripts).toEqual([
        { language: 'English', identifier: 'c_en', languageCode: 'en', artifactUrl: 'transcripts/en/captions.vtt', wordByWordUrl: 'transcripts/en/captions.vtt' },
        { language: 'French', identifier: 'c_fr', languageCode: 'fr', artifactUrl: 'transcripts/fr/captions.vtt', wordByWordUrl: 'transcripts/fr/captions.vtt' },
      ]);
      const updatedServerData = JSON.parse((updateCall![1] as any).server_data);
      expect(updatedServerData.transcripts).toEqual([
        { language: 'English', identifier: 'c_en', languageCode: 'en', artifactUrl: 'transcripts/en/captions.vtt', wordByWordUrl: 'transcripts/en/captions.vtt' },
      ]);
    });

    it('seeds local_data/server_data from contentMeta.transcripts when neither field has a transcripts array yet', async () => {
      // Regression test: this is the exact scenario that broke offline captions in
      // production - the content row exists (upserted during this same import) but
      // neither local_data nor server_data has a transcripts array yet, because the
      // ContentService.contentRead side effect that normally seeds server_data never
      // ran for this row. Without rawTranscripts being passed through explicitly,
      // downloadTranscripts had nothing to rewrite and silently did nothing useful
      // despite successfully downloading and extracting the caption ECAR.
      const { Filesystem } = await import('@capacitor/filesystem');
      const { CapacitorHttp } = await import('@capacitor/core');
      const { Zip } = await import('capa-zip');

      vi.mocked(CapacitorHttp.get).mockResolvedValue({ status: 200, data: 'base64ecarbytes' } as any);
      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({ ver: '1.1', archive: { items: [{ identifier: 'do_seed', mimeType: 'video/mp4' }] } }),
      } as any);
      vi.mocked(Filesystem.readdir).mockResolvedValue({
        files: [{ name: 'en', type: 'directory' }],
      } as any);
      vi.mocked(contentDb.getByIdentifier).mockResolvedValue({
        identifier: 'do_seed',
        local_data: JSON.stringify({ identifier: 'do_seed' }), // no transcripts field
        server_data: JSON.stringify({ identifier: 'do_seed' }), // no transcripts field
      } as any);

      await svc.import('do_seed', '/p.ecar', {
        enrichment: { transcriptUrl: 'https://cdn/do_seed_transcripts.ecar' },
        transcripts: [
          { language: 'English', identifier: 'c_en', languageCode: 'en', artifactUrl: 'https://cdn/en.vtt', wordByWordUrl: 'https://cdn/en.vtt' },
        ],
      });

      const updateCall = vi.mocked(contentDb.update).mock.calls.find((c) => c[0] === 'do_seed');
      expect(updateCall).toBeDefined();
      const updatedLocalData = JSON.parse((updateCall![1] as any).local_data);
      expect(updatedLocalData.transcripts).toEqual([
        { language: 'English', identifier: 'c_en', languageCode: 'en', artifactUrl: 'transcripts/en/captions.vtt', wordByWordUrl: 'transcripts/en/captions.vtt' },
      ]);
      const updatedServerData = JSON.parse((updateCall![1] as any).server_data);
      expect(updatedServerData.transcripts).toEqual([
        { language: 'English', identifier: 'c_en', languageCode: 'en', artifactUrl: 'transcripts/en/captions.vtt', wordByWordUrl: 'transcripts/en/captions.vtt' },
      ]);
    });

    it('does not attempt a transcript download when contentMeta has no enrichment.transcriptUrl', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      const { CapacitorHttp } = await import('@capacitor/core');

      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({ ver: '1.1', archive: { items: [{ identifier: 'do_456', mimeType: 'application/pdf' }] } }),
      } as any);

      await svc.import('do_456', '/p.ecar', { name: 'PDF content' });

      expect(CapacitorHttp.get).not.toHaveBeenCalled();
    });

    it('does not fail the import when the transcript ECAR download fails', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      const { CapacitorHttp } = await import('@capacitor/core');

      vi.mocked(CapacitorHttp.get).mockRejectedValue(new Error('network error'));

      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({ ver: '1.1', archive: { items: [{ identifier: 'do_789', mimeType: 'video/mp4' }] } }),
      } as any);

      const result = await svc.import('do_789', '/p.ecar', {
        enrichment: { transcriptUrl: 'https://cdn/do_789_transcripts.ecar' },
      });

      expect(result.status).toBe('SUCCESS');
    });

    it('does not let a hung ECAR download block the import queue', async () => {
      vi.useFakeTimers();
      try {
        const { Filesystem } = await import('@capacitor/filesystem');
        const { CapacitorHttp } = await import('@capacitor/core');

        vi.mocked(Filesystem.readFile).mockResolvedValue({
          data: JSON.stringify({ ver: '1.1', archive: { items: [{ identifier: 'do_ecar_hang', mimeType: 'video/mp4' }] } }),
        } as any);
        // Never resolves - simulates a hung download against an http-client with
        // no built-in timeout. import() awaits downloadTranscripts() directly, so
        // without a timeout here this would stall the whole import indefinitely.
        vi.mocked(CapacitorHttp.get).mockReturnValue(new Promise(() => { }));

        const resultPromise = svc.import('do_ecar_hang', '/p.ecar', {
          enrichment: { transcriptUrl: 'https://cdn/do_ecar_hang_transcripts.ecar' },
        });
        await vi.advanceTimersByTimeAsync(10_000);
        const result = await resultPromise;

        expect(result.status).toBe('SUCCESS');
      } finally {
        vi.useRealTimers();
      }
    });

    describe('transcriptUrl fallback fetch (contentMeta lacks enrichment)', () => {
      it('fetches transcriptUrl for video content when contentMeta has no enrichment', async () => {
        const { Filesystem } = await import('@capacitor/filesystem');
        const { CapacitorHttp } = await import('@capacitor/core');

        vi.mocked(CapacitorHttp.get).mockResolvedValue({ status: 200, data: 'base64ecarbytes' } as any);
        vi.mocked(Filesystem.readFile).mockResolvedValue({
          data: JSON.stringify({ ver: '1.1', archive: { items: [{ identifier: 'do_999', mimeType: 'video/mp4' }] } }),
        } as any);
        vi.mocked(Filesystem.readdir).mockResolvedValue({
          files: [{ name: 'en', type: 'directory' }],
        } as any);
        vi.mocked(contentDb.getByIdentifier).mockResolvedValue({
          identifier: 'do_999',
          local_data: JSON.stringify({ identifier: 'do_999' }), // no transcripts field yet
          server_data: JSON.stringify({ identifier: 'do_999' }), // no transcripts field yet
        } as any);
        mockContentRead.mockResolvedValue({
          data: {
            content: {
              enrichment: { transcriptUrl: 'https://cdn/do_999_transcripts.ecar' },
              transcripts: [
                { language: 'English', identifier: 'c_en', languageCode: 'en', artifactUrl: 'https://cdn/en.vtt', wordByWordUrl: 'https://cdn/en.vtt' },
              ],
            },
          },
        });

        await svc.import('do_999', '/p.ecar', { identifier: 'do_999', mimeType: 'video/mp4' });

        expect(mockContentRead).toHaveBeenCalledWith('do_999', undefined, undefined, true);
        expect(CapacitorHttp.get).toHaveBeenCalledWith(
          expect.objectContaining({ url: 'https://cdn/do_999_transcripts.ecar' }),
        );

        // The fetched `transcripts` (not just transcriptUrl) must be forwarded to
        // downloadTranscripts so it has something to localize, even though neither
        // local_data nor server_data had a transcripts array of their own.
        const updateCall = vi.mocked(contentDb.update).mock.calls.find((c) => c[0] === 'do_999');
        expect(updateCall).toBeDefined();
        const updatedLocalData = JSON.parse((updateCall![1] as any).local_data);
        expect(updatedLocalData.transcripts).toEqual([
          { language: 'English', identifier: 'c_en', languageCode: 'en', artifactUrl: 'transcripts/en/captions.vtt', wordByWordUrl: 'transcripts/en/captions.vtt' },
        ]);
      });

      it('does not fetch transcriptUrl for non-video content even when enrichment is missing', async () => {
        const { Filesystem } = await import('@capacitor/filesystem');
        const { CapacitorHttp } = await import('@capacitor/core');

        vi.mocked(Filesystem.readFile).mockResolvedValue({
          data: JSON.stringify({ ver: '1.1', archive: { items: [{ identifier: 'do_pdf', mimeType: 'application/pdf' }] } }),
        } as any);

        await svc.import('do_pdf', '/p.ecar', { identifier: 'do_pdf', mimeType: 'application/pdf' });

        expect(mockContentRead).not.toHaveBeenCalled();
        expect(CapacitorHttp.get).not.toHaveBeenCalled();
      });

      it('does not fail the import when the fallback fetch itself fails', async () => {
        const { Filesystem } = await import('@capacitor/filesystem');

        vi.mocked(Filesystem.readFile).mockResolvedValue({
          data: JSON.stringify({ ver: '1.1', archive: { items: [{ identifier: 'do_fail', mimeType: 'video/mp4' }] } }),
        } as any);
        mockContentRead.mockRejectedValue(new Error('network error'));

        const result = await svc.import('do_fail', '/p.ecar', { identifier: 'do_fail', mimeType: 'video/mp4' });

        expect(result.status).toBe('SUCCESS');
      });

      it('does not let a hung fallback fetch block the import', async () => {
        vi.useFakeTimers();
        try {
          const { Filesystem } = await import('@capacitor/filesystem');
          vi.mocked(Filesystem.readFile).mockResolvedValue({
            data: JSON.stringify({ ver: '1.1', archive: { items: [{ identifier: 'do_hang', mimeType: 'video/mp4' }] } }),
          } as any);
          // Never resolves - simulates a hung request against an http-client with
          // no built-in timeout. The internal 10s race should still let import finish.
          mockContentRead.mockReturnValue(new Promise(() => { }));

          const resultPromise = svc.import('do_hang', '/p.ecar', { identifier: 'do_hang', mimeType: 'video/mp4' });
          await vi.advanceTimersByTimeAsync(10_000);
          const result = await resultPromise;

          expect(result.status).toBe('SUCCESS');
        } finally {
          vi.useRealTimers();
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('skips item if pkgVersion in DB is higher', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({ ver: '1.1', archive: { items: [{ identifier: 'do_old', pkgVersion: 2, mimeType: 'pdf' }] } })
      } as any);

      vi.mocked(contentDb.getByIdentifiers).mockResolvedValue([{
        identifier: 'do_old',
        local_data: JSON.stringify({ pkgVersion: 5 }),
        content_state: 2,
      } as any]);

      const result = await svc.import('do_old', '/p.ecar');
      expect(result.status).toBe('ALREADY_EXIST');
    });

    it('handles non-array audience/pragma/dialcodes', async () => {
      const { Filesystem } = await import('@capacitor/filesystem');
      vi.mocked(Filesystem.readFile).mockResolvedValue({
        data: JSON.stringify({
          ver: '1.1',
          archive: {
            items: [{
              identifier: 'do_str',
              mimeType: 'pdf',
              audience: 'Instructor',
              pragma: 'test',
            }]
          }
        })
      } as any);

      await svc.import('do_str', '/p.ecar');
      const upserted = vi.mocked(contentDb.upsert).mock.calls[0][0] as ContentEntry;
      expect(upserted.audience).toBe('Instructor');
    });
  });
});
