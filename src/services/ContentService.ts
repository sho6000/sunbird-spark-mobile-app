import { getClient, ApiResponse } from '../lib/http-client';
import { buildOfflineResponse } from '../lib/http-client/offlineResponse';
import type { ContentSearchRequest, ContentSearchResponse, RawTranscript, PlayerTranscript } from '../types/contentTypes';
import { contentDbService } from './db/ContentDbService';
import { networkService } from './network/networkService';

// Maps the raw enrichment.transcripts shape (artifactUrl = transcript.json,
// captionsUrl = the actual VTT) to what sunbird-video-player's Transcript
// interface expects - artifactUrl must be the VTT. wordByWordUrl is set to
// the same VTT for every language: the overlay's accumulation logic handles
// both word-level and sentence-level VTTs correctly on its own (a full cue is
// never truncated, only additional cues appended to a non-empty line are
// capped), so there's no need to know a given language's granularity here.
function mapRawTranscripts(raw: RawTranscript[] | undefined): PlayerTranscript[] {
  return (raw || [])
    .filter((entry): entry is RawTranscript & { captionsUrl: string } =>
      !!entry.captionsUrl && entry.status === 'Live')
    .map((entry) => ({
      language: entry.language || (entry.languageCode || 'Unknown').toUpperCase(),
      identifier: entry.code,
      languageCode: entry.languageCode || '',
      artifactUrl: entry.captionsUrl,
      wordByWordUrl: entry.captionsUrl,
      sourceLanguage: !!entry.sourceLanguage,
    }));
}

// local_data (the ECAR manifest item) never carries transcripts - they aren't
// part of the download bundle. Any offline metadata path (ContentService's
// own DB fallback, or a component-level fallback that reads contentDbService
// directly when React Query pauses queries offline) should call this to pull
// transcripts back in from server_data, which does get them via a prior
// online enrich=all read.
export function mergeTranscriptsFromServerData(content: any, serverDataRaw?: string | null): void {
  if (!content || content.transcripts?.length || !serverDataRaw) return;
  try {
    const serverContent = JSON.parse(serverDataRaw);
    if (serverContent.transcripts?.length) {
      content.transcripts = serverContent.transcripts;
    }
  } catch { /* ignore malformed server_data */ }
}

const DEFAULT_CONTENT_FIELDS = [
  'ageGroup', 'appIcon', 'artifactUrl', 'attributions', 'audience',
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

  // `enrichTranscripts` is opt-in and defaults to false - it adds ?enrich=all,
  // which is what actually returns enrichment.transcripts ("transcripts" alone
  // in `fields` is not a recognized raw field on this endpoint). Left off by
  // default so every other contentRead caller (detail view, download, etc.)
  // isn't paying for enrichment data it never uses - only the video player
  // path opts in, and only for actual video content.
  public async contentRead<T = any>(
    contentId: string,
    fields?: string[],
    mode?: string,
    enrichTranscripts = false
  ): Promise<ApiResponse<T>> {
    if (!networkService.isConnected()) {
      return this.readContentFromDb<T>(contentId);
    }

    try {
      const resolvedFields = fields ?? DEFAULT_CONTENT_FIELDS;
      const params = new URLSearchParams();
      if (resolvedFields.length) params.set('fields', resolvedFields.join(','));
      if (mode) params.set('mode', mode);
      if (enrichTranscripts) params.set('enrich', 'all');
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await getClient().get<T>(`/content/v1/read/${contentId}${queryString}`);
      const content = (response.data as any)?.content;

      if (enrichTranscripts && content) {
        content.transcripts = mapRawTranscripts(content.enrichment?.transcripts);
      }

      try {
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

    if (entry.server_data !== raw) {
      mergeTranscriptsFromServerData(content, entry.server_data);
    }

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

  /**
   * Semantic (AI) search. Hits the same endpoint as contentSearch but flags
   * search_mode=semantic so the upstream service runs a vector search.
   * Online only — there is no on-device embedding index, so when offline we
   * return an empty offline response and the caller falls back to keyword mode.
   */
  public async semanticSearch(
    request: ContentSearchRequest = {}
  ): Promise<ApiResponse<ContentSearchResponse>> {
    if (!networkService.isConnected()) {
      return buildOfflineResponse<ContentSearchResponse>({ content: [], count: 0 });
    }

    return getClient().post<ContentSearchResponse>('/composite/v1/search', {
      request: {
        filters: request.filters ?? {},
        facets: request.facets,
        limit: request.limit ?? 9,
        offset: request.offset ?? 0,
        query: request.query ?? '',
        search_mode: 'semantic',
        semantic: request.semantic ?? { k: 50, min_score: 0.6 },
      },
    });
  }
}
