import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentService } from './ContentService';
import { getClient } from '../lib/http-client';
import { mockContentResponse, mockApiError } from '../__mocks__/apiMocks';

// Mock the HTTP client
vi.mock('../lib/http-client', () => ({
  getClient: vi.fn()
}));

vi.mock('./db/ContentDbService', () => ({
  contentDbService: {
    upsert: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    getByIdentifier: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('./network/networkService', () => ({
  networkService: { isConnected: vi.fn().mockReturnValue(true), subscribe: vi.fn() },
}));

import { networkService } from './network/networkService';
import { contentDbService } from './db/ContentDbService';

describe('ContentService', () => {
  let contentService: ContentService;
  let mockHttpClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    contentService = new ContentService();
    mockHttpClient = {
      post: vi.fn(),
      get: vi.fn(),
    };
    (getClient as any).mockReturnValue(mockHttpClient);
    (networkService.isConnected as any).mockReturnValue(true);
    (contentDbService.getByIdentifier as any).mockResolvedValue(null);
    (contentDbService.upsert as any).mockResolvedValue(undefined);
    (contentDbService.update as any).mockResolvedValue(undefined);
  });

  describe('getContent', () => {
    it('should successfully search for content', async () => {
      // Arrange
      const payload = {
        request: {
          filters: {
            contentType: ['Course'],
            status: ['Live']
          },
          limit: 10
        }
      };
      mockHttpClient.post.mockResolvedValue(mockContentResponse);

      // Act
      const result = await contentService.getContent(payload);

      // Assert
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        '/content/v1/search',
        payload,
        {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      );
      expect(result).toEqual(mockContentResponse);
      expect(result.data.result.content).toHaveLength(2);
      expect(result.data.result.content[0].contentType).toBe('Course');
    });

    it('should handle API errors', async () => {
      // Arrange
      const payload = { request: { filters: {}, limit: 5 } };
      mockHttpClient.post.mockRejectedValue(mockApiError);

      // Act & Assert
      await expect(contentService.getContent(payload)).rejects.toThrow('API Error');
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        '/content/v1/search',
        payload,
        expect.any(Object)
      );
    });

    it('should pass custom request payload', async () => {
      // Arrange
      const customPayload = {
        request: {
          filters: {
            contentType: ['TextBook'],
            status: ['Draft']
          },
          limit: 20
        }
      };
      mockHttpClient.post.mockResolvedValue(mockContentResponse);

      // Act
      await contentService.getContent(customPayload);

      // Assert
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        '/content/v1/search',
        customPayload,
        expect.any(Object)
      );
    });

    it('should pass correct headers', async () => {
      // Arrange
      const payload = { request: { filters: {} } };
      mockHttpClient.post.mockResolvedValue(mockContentResponse);

      // Act
      await contentService.getContent(payload);

      // Assert
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        })
      );
    });

    it('should return content with correct structure', async () => {
      // Arrange
      const payload = { request: { filters: {} } };
      mockHttpClient.post.mockResolvedValue(mockContentResponse);

      // Act
      const result = await contentService.getContent(payload);

      // Assert
      expect(result.data.result.count).toBe(2);
      expect(result.data.result.content[0]).toHaveProperty('identifier');
      expect(result.data.result.content[0]).toHaveProperty('name');
      expect(result.data.result.content[0]).toHaveProperty('contentType');
      expect(result.data.result.content[0]).toHaveProperty('status');
    });

    it('should handle empty content results', async () => {
      // Arrange
      const payload = { request: { filters: {} } };
      const emptyResponse = {
        ...mockContentResponse,
        data: {
          ...mockContentResponse.data,
          result: {
            count: 0,
            content: []
          }
        }
      };
      mockHttpClient.post.mockResolvedValue(emptyResponse);

      // Act
      const result = await contentService.getContent(payload);

      // Assert
      expect(result.data.result.content).toHaveLength(0);
      expect(result.data.result.count).toBe(0);
    });
  });

  describe('contentSearch', () => {
    const mockSearchResponse = {
      data: { count: 1, content: [{ identifier: 'do_1', name: 'Item' }] },
      status: 200,
      headers: {},
    };

    it('should call composite search endpoint with default values', async () => {
      mockHttpClient.post.mockResolvedValue(mockSearchResponse);

      const result = await contentService.contentSearch();

      expect(mockHttpClient.post).toHaveBeenCalledWith('/composite/v1/search', {
        request: {
          filters: {},
          facets: undefined,
          limit: 9,
          offset: 0,
          query: '',
          sort_by: { lastUpdatedOn: 'desc' },
        },
      });
      expect(result).toEqual(mockSearchResponse);
    });

    it('should pass custom filters', async () => {
      mockHttpClient.post.mockResolvedValue(mockSearchResponse);

      await contentService.contentSearch({
        filters: { primaryCategory: ['Course'] },
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith('/composite/v1/search', {
        request: expect.objectContaining({
          filters: { primaryCategory: ['Course'] },
        }),
      });
    });

    it('should pass custom limit and offset', async () => {
      mockHttpClient.post.mockResolvedValue(mockSearchResponse);

      await contentService.contentSearch({ limit: 20, offset: 10 });

      expect(mockHttpClient.post).toHaveBeenCalledWith('/composite/v1/search', {
        request: expect.objectContaining({
          limit: 20,
          offset: 10,
        }),
      });
    });

    it('should pass query and sort_by', async () => {
      mockHttpClient.post.mockResolvedValue(mockSearchResponse);

      await contentService.contentSearch({
        query: 'math',
        sort_by: { lastUpdatedOn: 'asc' },
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith('/composite/v1/search', {
        request: expect.objectContaining({
          query: 'math',
          sort_by: { lastUpdatedOn: 'asc' },
        }),
      });
    });

    it('should pass facets when provided', async () => {
      mockHttpClient.post.mockResolvedValue(mockSearchResponse);

      await contentService.contentSearch({ facets: ['primaryCategory', 'medium'] });

      expect(mockHttpClient.post).toHaveBeenCalledWith('/composite/v1/search', {
        request: expect.objectContaining({
          facets: ['primaryCategory', 'medium'],
        }),
      });
    });

    it('should propagate errors from the HTTP client', async () => {
      mockHttpClient.post.mockRejectedValue(new Error('Network error'));

      await expect(contentService.contentSearch()).rejects.toThrow('Network error');
    });
  });

  describe('semanticSearch', () => {
    const mockSearchResponse = {
      data: { count: 1, content: [{ identifier: 'do_1', name: 'Item' }] },
      status: 200,
      headers: {},
    };

    it('should call composite search with search_mode semantic and default semantic config', async () => {
      mockHttpClient.post.mockResolvedValue(mockSearchResponse);

      const result = await contentService.semanticSearch({ query: 'fractions' });

      expect(mockHttpClient.post).toHaveBeenCalledWith('/composite/v1/search', {
        request: {
          filters: {},
          facets: undefined,
          limit: 9,
          offset: 0,
          query: 'fractions',
          search_mode: 'semantic',
          semantic: { k: 50, min_score: 0.6 },
        },
      });
      expect(result).toEqual(mockSearchResponse);
    });

    it('should not send sort_by (semantic is relevance-ordered)', async () => {
      mockHttpClient.post.mockResolvedValue(mockSearchResponse);

      await contentService.semanticSearch({ query: 'science', sort_by: { lastUpdatedOn: 'asc' } });

      const body = mockHttpClient.post.mock.calls[0][1];
      expect(body.request).not.toHaveProperty('sort_by');
    });

    it('should pass custom filters, limit and offset', async () => {
      mockHttpClient.post.mockResolvedValue(mockSearchResponse);

      await contentService.semanticSearch({
        query: 'q',
        filters: { primaryCategory: ['Course'] },
        limit: 20,
        offset: 10,
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith('/composite/v1/search', {
        request: expect.objectContaining({
          filters: { primaryCategory: ['Course'] },
          limit: 20,
          offset: 10,
        }),
      });
    });

    it('should pass a custom semantic config when provided', async () => {
      mockHttpClient.post.mockResolvedValue(mockSearchResponse);

      await contentService.semanticSearch({ query: 'q', semantic: { k: 10, min_score: 0.9 } });

      expect(mockHttpClient.post).toHaveBeenCalledWith('/composite/v1/search', {
        request: expect.objectContaining({
          semantic: { k: 10, min_score: 0.9 },
        }),
      });
    });

    it('should return an empty offline response and skip the network when offline', async () => {
      (networkService.isConnected as any).mockReturnValue(false);

      const result = await contentService.semanticSearch({ query: 'q' });

      expect(mockHttpClient.post).not.toHaveBeenCalled();
      expect(result.status).toBe(200);
      expect((result.data as any).content).toEqual([]);
      expect((result.data as any).count).toBe(0);
    });

    it('should propagate errors from the HTTP client', async () => {
      mockHttpClient.post.mockRejectedValue(new Error('Network error'));

      await expect(contentService.semanticSearch({ query: 'q' })).rejects.toThrow('Network error');
    });
  });

  describe('contentRead', () => {
    const mockContent = {
      identifier: 'do_content_001',
      name: 'Test Content',
      contentType: 'Resource',
      mimeType: 'video/mp4',
      visibility: 'Default',
      lastUpdatedOn: '2026-01-01',
      pkgVersion: 2,
      audience: ['Learner'],
      dialcodes: ['D1'],
      childNodes: ['child-1'],
      primaryCategory: 'Explanation Content',
    };

    const mockReadResponse = {
      data: { content: mockContent },
      status: 200,
      headers: {},
    };

    it('should call GET with default fields when none provided', async () => {
      mockHttpClient.get.mockResolvedValue(mockReadResponse);

      await contentService.contentRead('do_content_001');

      const calledUrl: string = mockHttpClient.get.mock.calls[0][0];
      expect(calledUrl).toMatch(/^\/content\/v1\/read\/do_content_001/);
      expect(calledUrl).toContain('fields=');
    });

    it('should call GET with custom fields when provided', async () => {
      mockHttpClient.get.mockResolvedValue(mockReadResponse);

      await contentService.contentRead('do_content_001', ['name', 'mimeType']);

      const calledUrl: string = mockHttpClient.get.mock.calls[0][0];
      expect(calledUrl).toContain('fields=name%2CmimeType');
    });

    it('should include mode param when provided', async () => {
      mockHttpClient.get.mockResolvedValue(mockReadResponse);

      await contentService.contentRead('do_content_001', undefined, 'edit');

      const calledUrl: string = mockHttpClient.get.mock.calls[0][0];
      expect(calledUrl).toContain('mode=edit');
    });

    it('should refresh server_data in DB when row already exists', async () => {
      mockHttpClient.get.mockResolvedValue(mockReadResponse);
      (contentDbService.getByIdentifier as any).mockResolvedValue({ identifier: 'do_content_001', audience: 'Learner' });

      await contentService.contentRead('do_content_001');

      expect(contentDbService.update).toHaveBeenCalledWith(
        'do_content_001',
        expect.objectContaining({ server_data: expect.any(String) })
      );
    });

    it('should map array audience to comma-separated string', async () => {
      mockHttpClient.get.mockResolvedValue(mockReadResponse);
      (contentDbService.getByIdentifier as any).mockResolvedValue({ identifier: 'do_content_001', audience: 'Learner' });

      await contentService.contentRead('do_content_001');

      expect(contentDbService.update).toHaveBeenCalledWith(
        'do_content_001',
        expect.objectContaining({ audience: 'Learner' })
      );
    });

    it('should store content fields in server_data JSON blob', async () => {
      mockHttpClient.get.mockResolvedValue(mockReadResponse);
      (contentDbService.getByIdentifier as any).mockResolvedValue({ identifier: 'do_content_001', audience: 'Learner' });

      await contentService.contentRead('do_content_001');

      const updateCall = (contentDbService.update as any).mock.calls[0];
      const serverData = JSON.parse(updateCall[1].server_data);
      expect(serverData.identifier).toBe('do_content_001');
      expect(serverData.mimeType).toBe('video/mp4');
    });

    it('should not crash if DB update fails (swallows cache error)', async () => {
      mockHttpClient.get.mockResolvedValue(mockReadResponse);
      (contentDbService.getByIdentifier as any).mockResolvedValue({ identifier: 'do_content_001', audience: 'Learner' });
      (contentDbService.update as any).mockRejectedValueOnce(new Error('DB error'));

      const result = await contentService.contentRead('do_content_001');

      expect(result).toEqual(mockReadResponse);
    });

    it('should skip DB update when row does not exist in content table', async () => {
      mockHttpClient.get.mockResolvedValue(mockReadResponse);
      (contentDbService.getByIdentifier as any).mockResolvedValue(null);

      await contentService.contentRead('do_content_001');

      expect(contentDbService.update).not.toHaveBeenCalled();
    });

    it('should return offline DB content when offline', async () => {
      (networkService.isConnected as any).mockReturnValue(false);
      (contentDbService.getByIdentifier as any).mockResolvedValue({
        server_data: JSON.stringify(mockContent),
      });

      const result = await contentService.contentRead('do_content_001');

      expect(mockHttpClient.get).not.toHaveBeenCalled();
      expect((result.data as any).content.identifier).toBe('do_content_001');
    });

    it('should return null content when offline and no DB entry', async () => {
      (networkService.isConnected as any).mockReturnValue(false);
      (contentDbService.getByIdentifier as any).mockResolvedValue(null);

      const result = await contentService.contentRead('do_content_001');

      expect((result.data as any).content).toBeNull();
    });

    it('should fall back to DB when API throws', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('Network error'));
      (contentDbService.getByIdentifier as any).mockResolvedValue({
        server_data: JSON.stringify(mockContent),
      });

      const result = await contentService.contentRead('do_content_001');

      expect((result.data as any).content).toBeDefined();
    });

    it('should return null content when API fails and DB has no entry', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('Network error'));

      const result = await contentService.contentRead('do_content_001');

      expect((result.data as any).content).toBeNull();
      expect(result.status).toBe(200);
    });
  });
});