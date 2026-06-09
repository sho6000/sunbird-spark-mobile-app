import { getClient, ApiResponse } from '../lib/http-client';
import { buildOfflineResponse } from '../lib/http-client/offlineResponse';
import type { ContentSearchRequest, ContentSearchResponse } from '../types/contentTypes';
import { contentDbService } from './db/ContentDbService';
import { networkService } from './network/networkService';

const DEFAULT_CONTENT_FIELDS = [
  'transcripts', 'ageGroup', 'appIcon', 'artifactUrl', 'attributions', 'audience',
  'author', 'badgeAssertions', 'body', 'channel', 'code', 'concepts', 'contentCredits',
  'contentType', 'contributors', 'copyright', 'copyrightYear', 'createdBy', 'createdOn',
  'creator', 'creators', 'description', 'displayScore', 'domain', 'editorState',
  'flagReasons', 'flaggedBy', 'flags', 'framework', 'identifier', 'itemSetPreviewUrl',
  'keywords', 'language', 'languageCode', 'lastUpdatedOn', 'license', 'mediaType',
  'mimeType', 'name', 'originData', 'osId', 'owner', 'pkgVersion', 'publisher',
  'questions', 'resourceType', 'scoreDisplayConfig', 'status', 'streamingUrl',
  'template', 'templateId', 'totalQuestions', 'totalScore', 'versionKey', 'visibility',
  'year', 'primaryCategory', 'additionalCategories', 'interceptionPoints', 'interceptionType', 'downloadUrl',
  'launchFile','scoList'
];

export class ContentService {
  public async getContent<T = any>(payload: any): Promise<ApiResponse<T>> {
    try {
      const response = await getClient().post<T>('/content/v1/search', payload, {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      });
      return response;
    } catch (error) {
      console.error('ContentService API Error:', error);
      throw error;
    }
  }

  public async contentRead<T = any>(contentId: string, fields?: string[], mode?: string): Promise<ApiResponse<T>> {
    if (!networkService.isConnected()) {
      return this.readContentFromDb<T>(contentId);
    }

    try {
      const resolvedFields = fields ?? DEFAULT_CONTENT_FIELDS;
      const params = new URLSearchParams();
      if (resolvedFields.length) params.set('fields', resolvedFields.join(','));
      if (mode) params.set('mode', mode);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await getClient().get<T>(`/content/v1/read/${contentId}${queryString}`);

      try {
        const content = (response.data as any)?.content;
        if (content?.identifier) {
          // Only refresh server_data on rows that already exist (placed there by
          // the download/import pipeline). Never create new rows here — the content
          // table is owned exclusively by the download manager.
          const existing = await contentDbService.getByIdentifier(content.identifier);
          if (existing) {
            await contentDbService.update(content.identifier, {
              server_data: JSON.stringify(content),
              server_last_updated_on: content.lastUpdatedOn ?? null,
              audience: Array.isArray(content.audience)
                ? content.audience.join(',')
                : (content.audience ?? existing.audience),
            });
          }
        }
      } catch (err) {
        console.warn('[ContentService] Failed to refresh server_data in SQLite:', err);
      }

      return response;
    } catch {
      return this.readContentFromDb<T>(contentId);
    }
  }

  private async readContentFromDb<T>(contentId: string): Promise<ApiResponse<T>> {
    const entry = await contentDbService.getByIdentifier(contentId);
    if (!entry) return buildOfflineResponse<T>({ content: null } as T);

    // Prefer local_data ONLY if Visibility is 'Default'.
    // If Visibility is 'Parent', it belongs to a collection and shouldn't
    // be resolved locally in a standalone context (force network metadata).
    const raw = (entry.visibility === 'Default')
      ? (entry.local_data || entry.server_data)
      : entry.server_data;

    const content = raw ? JSON.parse(raw) : null;

    // URL resolution for offline playback is handled by contentPlaybackResolver
    // in ContentPlayerPage. Keep raw metadata here to avoid double resolution.

    return buildOfflineResponse<T>({ content } as T);
  }

  public async contentSearch(
    request: ContentSearchRequest = {}
  ): Promise<ApiResponse<ContentSearchResponse>> {
    return getClient().post<ContentSearchResponse>('/composite/v1/search', {
      request: {
        filters: request.filters ?? {},
        facets: request.facets,
        limit: request.limit ?? 9,
        offset: request.offset ?? 0,
        query: request.query ?? '',
        sort_by: request.sort_by ?? { lastUpdatedOn: 'desc' },
      },
    });
  }
}