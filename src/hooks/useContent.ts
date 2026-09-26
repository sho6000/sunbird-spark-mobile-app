import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { ContentService } from '../services/ContentService';
import { ApiResponse } from '../lib/http-client';

const contentService = new ContentService();

export const useContent = (): UseQueryResult<ApiResponse<any>, Error> => {
  return useQuery({
    queryKey: ['content'],
    queryFn: () => contentService.getContent({
      request: {
        filters: {
          contentType: ['Course'],
          status: ['Live']
        },
        limit: 10
      }
    }),
  });
};

export const useContentRead = (
  contentId: string,
  options?: { enabled?: boolean; fields?: string[]; mode?: string; enrichTranscripts?: boolean }
): UseQueryResult<ApiResponse<any>, Error> => {
  const enabled = options?.enabled ?? true;
  const fields = options?.fields;
  const mode = options?.mode;
  const enrichTranscripts = options?.enrichTranscripts ?? false;
  return useQuery({
    queryKey: ['content-read', contentId, fields, mode, enrichTranscripts],
    queryFn: () => contentService.contentRead(contentId, fields, mode, enrichTranscripts),
    enabled: enabled && !!contentId,
    staleTime: 60 * 60 * 1000,
  });
};