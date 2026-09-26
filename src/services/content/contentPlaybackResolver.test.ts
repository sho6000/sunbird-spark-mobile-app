import { resolveContentForPlayer } from './contentPlaybackResolver';
import { Filesystem } from '@capacitor/filesystem';

vi.mock('../db/ContentDbService', () => ({
  contentDbService: { getByIdentifier: vi.fn() },
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { readFile: vi.fn(), stat: vi.fn(), readdir: vi.fn() },
  Encoding: { UTF8: 'utf8' },
}));

import { contentDbService } from '../db/ContentDbService';

const mockGetByIdentifier = vi.mocked(contentDbService.getByIdentifier);
const mockReadFile = vi.mocked(Filesystem.readFile);
const mockStat = vi.mocked(Filesystem.stat);
const mockReaddir = vi.mocked(Filesystem.readdir);

describe('resolveContentForPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default stat: file not found (safe default for H5P/HTML index.html check)
    mockStat.mockRejectedValue(new Error('not found'));
    // Default readdir: empty (safe default for filename resolution)
    mockReaddir.mockResolvedValue({ files: [] } as any);
  });

  const metadata: Record<string, any> = {
    identifier: 'do_123',
    name: 'Test Video',
    mimeType: 'video/mp4',
    artifactUrl: 'https://cdn.example.com/content/do_123/video.mp4',
    streamingUrl: 'https://cdn.example.com/content/do_123/video.mp4',
  };

  it('returns original metadata when content is not local', async () => {
    mockGetByIdentifier.mockResolvedValue(null);
    const result = await resolveContentForPlayer('do_123', metadata);
    expect(result).toBe(metadata);
  });

  it('returns original metadata when content_state is not 2', async () => {
    mockGetByIdentifier.mockResolvedValue({ content_state: 1, path: '/some/path' } as any);
    const result = await resolveContentForPlayer('do_123', metadata);
    expect(result).toBe(metadata);
  });

  it('returns original metadata when path is null', async () => {
    mockGetByIdentifier.mockResolvedValue({ content_state: 2, path: null } as any);
    const result = await resolveContentForPlayer('do_123', metadata);
    expect(result).toBe(metadata);
  });

  it('resolves artifactUrl to basename and sets basePath + isAvailableLocally', async () => {
    mockGetByIdentifier.mockResolvedValue({
      content_state: 2,
      path: 'file:///data/content/do_123',
    } as any);
    const result = await resolveContentForPlayer('do_123', metadata);
    // artifactUrl becomes just the basename (players concat basePath + artifactUrl)
    expect(result.artifactUrl).toBe('video.mp4');
    // streamingUrl is resolved to the base directory for video content
    expect(result.streamingUrl).toBe('file:///data/content/do_123');
    expect(result.isAvailableLocally).toBe(true);
    expect(result.basePath).toBeDefined();
  });

  it('sets streamingUrl for video content even when no streamingUrl exists', async () => {
    mockGetByIdentifier.mockResolvedValue({
      content_state: 2,
      path: 'file:///data/content/do_vid',
    } as any);
    const videoMeta: Record<string, any> = {
      identifier: 'do_vid',
      artifactUrl: 'https://cdn.example.com/do_vid/clip.mp4',
      mimeType: 'video/mp4',
    };
    const result = await resolveContentForPlayer('do_vid', videoMeta);
    expect(result.artifactUrl).toBe('clip.mp4');
    // streamingUrl auto-set to directory for video content
    expect(result.streamingUrl).toBe('file:///data/content/do_vid');
  });

  it('does not set streamingUrl for non-video content without streamingUrl', async () => {
    mockGetByIdentifier.mockResolvedValue({
      content_state: 2,
      path: 'file:///data/content/do_pdf',
    } as any);
    const pdfMeta: Record<string, any> = {
      identifier: 'do_pdf',
      artifactUrl: 'https://cdn.example.com/do_pdf/doc.pdf',
      mimeType: 'application/pdf',
    };
    const result = await resolveContentForPlayer('do_pdf', pdfMeta);
    expect(result.artifactUrl).toBe('doc.pdf');
    // Non-video content without streamingUrl stays undefined
    expect(result.streamingUrl).toBeUndefined();
    expect(result.basePath).toBeDefined();
  });

  it('falls back to artifactUrl for HLS streams (.m3u8)', async () => {
    mockGetByIdentifier.mockResolvedValue({
      content_state: 2,
      path: 'file:///data/content/do_123',
    } as any);
    const hlsMeta = {
      ...metadata,
      streamingUrl: 'https://cdn.example.com/content/do_123/master.m3u8',
    };
    const result = await resolveContentForPlayer('do_123', hlsMeta);
    // HLS can't play offline — streamingUrl falls back to local base directory for videos
    expect(result.streamingUrl).toBe('file:///data/content/do_123');
  });

  it('returns original metadata on error', async () => {
    mockGetByIdentifier.mockRejectedValue(new Error('DB error'));
    const result = await resolveContentForPlayer('do_123', metadata);
    expect(result).toBe(metadata);
  });

  describe('transcript resolution for video content', () => {
    const remoteTranscripts = [
      { language: 'English', identifier: 'do_123_en', languageCode: 'en', artifactUrl: 'https://cdn.example.com/do_123/en/captions.vtt' },
    ];
    const localTranscripts = [
      { language: 'English', identifier: 'do_123_en', languageCode: 'en', artifactUrl: 'transcripts/en/captions.vtt', wordByWordUrl: 'transcripts/en/captions.vtt' },
    ];

    it('overrides caller-supplied (remote) transcripts with the local ones from local_data', async () => {
      mockGetByIdentifier.mockResolvedValue({
        content_state: 2,
        path: 'file:///data/content/do_123',
        visibility: 'Default',
        local_data: JSON.stringify({ identifier: 'do_123', transcripts: localTranscripts }),
        server_data: JSON.stringify({ identifier: 'do_123', transcripts: remoteTranscripts }),
      } as any);

      const result = await resolveContentForPlayer('do_123', { ...metadata, transcripts: remoteTranscripts });

      expect((result as any).transcripts).toEqual(localTranscripts);
    });

    it('defers to server_data (ignoring local_data) for Parent-visibility content', async () => {
      const staleLocalTranscripts = [
        { language: 'English', identifier: 'do_123_en', languageCode: 'en', artifactUrl: 'transcripts/en/stale.vtt' },
      ];
      mockGetByIdentifier.mockResolvedValue({
        content_state: 2,
        path: 'file:///data/content/do_123',
        visibility: 'Parent',
        local_data: JSON.stringify({ identifier: 'do_123', transcripts: staleLocalTranscripts }),
        server_data: JSON.stringify({ identifier: 'do_123', transcripts: localTranscripts }),
      } as any);

      const result = await resolveContentForPlayer('do_123', { ...metadata, transcripts: remoteTranscripts });

      expect((result as any).transcripts).toEqual(localTranscripts);
    });

    it('merges local transcripts from server_data when local_data has none', async () => {
      mockGetByIdentifier.mockResolvedValue({
        content_state: 2,
        path: 'file:///data/content/do_123',
        local_data: JSON.stringify({ identifier: 'do_123' }),
        server_data: JSON.stringify({ identifier: 'do_123', transcripts: localTranscripts }),
      } as any);

      const result = await resolveContentForPlayer('do_123', { ...metadata, transcripts: remoteTranscripts });

      expect((result as any).transcripts).toEqual(localTranscripts);
    });

    it('falls back to caller-supplied transcripts when no local transcripts exist yet', async () => {
      mockGetByIdentifier.mockResolvedValue({
        content_state: 2,
        path: 'file:///data/content/do_123',
        local_data: JSON.stringify({ identifier: 'do_123' }),
        server_data: JSON.stringify({ identifier: 'do_123' }),
      } as any);

      const result = await resolveContentForPlayer('do_123', { ...metadata, transcripts: remoteTranscripts });

      expect((result as any).transcripts).toEqual(remoteTranscripts);
    });

    it('does not touch transcripts for non-video content', async () => {
      mockGetByIdentifier.mockResolvedValue({
        content_state: 2,
        path: 'file:///data/content/do_pdf',
        local_data: JSON.stringify({ identifier: 'do_pdf', transcripts: localTranscripts }),
        server_data: JSON.stringify({ identifier: 'do_pdf' }),
      } as any);

      const pdfMeta = {
        identifier: 'do_pdf',
        mimeType: 'application/pdf',
        artifactUrl: 'https://cdn.example.com/do_pdf/doc.pdf',
        transcripts: remoteTranscripts,
      };
      const result = await resolveContentForPlayer('do_pdf', pdfMeta);

      expect((result as any).transcripts).toEqual(remoteTranscripts);
    });

    it('falls back to caller-supplied transcripts when local_data/server_data are malformed', async () => {
      mockGetByIdentifier.mockResolvedValue({
        content_state: 2,
        path: 'file:///data/content/do_123',
        local_data: 'not json',
        server_data: 'also not json',
      } as any);

      const result = await resolveContentForPlayer('do_123', { ...metadata, transcripts: remoteTranscripts });

      expect((result as any).transcripts).toEqual(remoteTranscripts);
    });
  });

  describe('loadLocalBody for ECML', () => {
    const ecmlMeta = {
      identifier: 'do_ecml',
      mimeType: 'application/vnd.ekstep.ecml-archive',
    };

    it('loads body from index.json when available', async () => {
      mockGetByIdentifier.mockResolvedValue({
        content_state: 2,
        path: 'file:///data/content/do_ecml',
      } as any);
      mockReadFile.mockResolvedValueOnce({ data: '{"theme": "json"}' } as any);

      const result = await resolveContentForPlayer('do_ecml', ecmlMeta);

      expect(mockReadFile).toHaveBeenCalledWith(expect.objectContaining({
        path: expect.stringContaining('index.json'),
      }));
      expect((result as any).body).toEqual({ theme: 'json' });
    });

    it('falls back to index.ecml when index.json is missing', async () => {
      mockGetByIdentifier.mockResolvedValue({
        content_state: 2,
        path: 'file:///data/content/do_ecml',
      } as any);
      // index.json fails, index.ecml succeeds
      mockReadFile
        .mockRejectedValueOnce(new Error('no json'))
        .mockResolvedValueOnce({ data: '{"theme": "ecml"}' } as any);

      const result = await resolveContentForPlayer('do_ecml', ecmlMeta);

      expect(mockReadFile).toHaveBeenCalledTimes(2);
      expect((result as any).body).toEqual({ theme: 'ecml' });
    });

    it('sets body to null when both files are missing', async () => {
      mockGetByIdentifier.mockResolvedValue({
        content_state: 2,
        path: 'file:///data/content/do_ecml',
      } as any);
      mockReadFile.mockRejectedValue(new Error('missing files'));

      const result = await resolveContentForPlayer('do_ecml', ecmlMeta);

      expect((result as any).body).toBeNull();
    });
  });

  describe('H5P/HTML offline resolution', () => {
    beforeEach(() => {
      mockGetByIdentifier.mockResolvedValue({
        content_state: 2,
        path: 'file:///data/content/do_h5p',
      } as any);
    });

    it('sets streamingUrl to the restructured h5p subdirectory for Live H5P content', async () => {
      const h5pMeta = {
        identifier: 'do_h5p',
        mimeType: 'application/vnd.ekstep.h5p-archive',
        status: 'Live',
        streamingUrl: 'https://cdn.example.com/container/content/h5p/do_h5p-latest',
      };
      const result = await resolveContentForPlayer('do_h5p', h5pMeta);
      // streamingUrl must point to the subdirectory where restructureForRenderer placed files
      expect((result as any).streamingUrl).toBe(
        'file:///data/content/do_h5p/assets/public/content/h5p/do_h5p-latest',
      );
    });

    it('sets streamingUrl to the snapshot subdirectory for Draft H5P content', async () => {
      const h5pMeta = {
        identifier: 'do_h5p',
        mimeType: 'application/vnd.ekstep.h5p-archive',
        status: 'Draft',
        streamingUrl: 'https://cdn.example.com/container/content/h5p/do_h5p-snapshot'
      };
      const result = await resolveContentForPlayer('do_h5p', h5pMeta);
      expect((result as any).streamingUrl).toBe(
        'file:///data/content/do_h5p/assets/public/content/h5p/do_h5p-snapshot',
      );
    });

    it('sets streamingUrl to the restructured html subdirectory for HTML archive content', async () => {
      mockGetByIdentifier.mockResolvedValue({
        content_state: 2,
        path: 'file:///data/content/do_html',
      } as any);
      const htmlMeta = {
        identifier: 'do_html',
        mimeType: 'application/vnd.ekstep.html-archive',
        status: 'Live',
        streamingUrl: 'https://cdn.example.com/container/content/html/do_html-latest',
      };
      const result = await resolveContentForPlayer('do_html', htmlMeta);
      expect((result as any).streamingUrl).toBe(
        'file:///data/content/do_html/assets/public/content/html/do_html-latest',
      );
    });

    it('does NOT call readFile (loadLocalBody) for H5P content', async () => {
      const h5pMeta = {
        identifier: 'do_h5p',
        mimeType: 'application/vnd.ekstep.h5p-archive',
        status: 'Live',
      };
      await resolveContentForPlayer('do_h5p', h5pMeta);
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('does NOT call readFile (loadLocalBody) for HTML archive content', async () => {
      mockGetByIdentifier.mockResolvedValue({
        content_state: 2,
        path: 'file:///data/content/do_html',
      } as any);
      const htmlMeta = {
        identifier: 'do_html',
        mimeType: 'application/vnd.ekstep.html-archive',
        status: 'Live',
      };
      await resolveContentForPlayer('do_html', htmlMeta);
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('falls back to basePath when streamingUrl has no /content/ segment', async () => {
      const h5pMeta = {
        identifier: 'do_h5p',
        mimeType: 'application/vnd.ekstep.h5p-archive',
        // streamingUrl without /content/ path — fallback
        streamingUrl: 'https://cdn.example.com/some-other-path',
      };
      const result = await resolveContentForPlayer('do_h5p', h5pMeta);
      expect((result as any).streamingUrl).toBe(
        'file:///data/content/do_h5p',
      );
    });
  });
});
