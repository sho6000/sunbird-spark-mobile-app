import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ContentService } from '../services/ContentService';
import { ApiResponse } from '../lib/http-client';
import { ContentSearchResponse, UseContentSearchOptions } from '../types/contentTypes';
import { AppInitializer } from '../AppInitializer';

const contentService = new ContentService();

// Fallback list used when no primaryCategory filter is selected.
// Ensures the search returns all known content categories by default.
const DEFAULT_PRIMARY_CATEGORIES = [
  'Collection',
  'Resource',
  'Content Playlist',
  'Course',
  'Course Assessment',
  'Digital Textbook',
  'eTextbook',
  'Explanation Content',
  'Learning Resource',
  'Lesson Plan Unit',
  'Practice Question Set',
  'Teacher Resource',
  'Textbook Unit',
  'LessonPlan',
  'Course Unit',
  'Exam Question',
  'Question paper',
];

export const useContentSearch = (
  options?: UseContentSearchOptions
): UseQueryResult<ApiResponse<ContentSearchResponse>, Error> => {
  const request = options?.request;
  const enabled = options?.enabled ?? true;
  const searchMode = options?.searchMode ?? 'keyword';
  const isSemantic = searchMode === 'semantic';

  // Inject the primaryCategory fallback when the user hasn't selected any category filter.
  // Semantic search is cross-category by design, so the fallback is skipped (portal parity).
  const effectiveRequest = useMemo(() => {
    if (!request) return request;
    if (isSemantic) return request;
    const hasPrimaryCategory = Array.isArray(request.filters?.primaryCategory)
      ? (request.filters!.primaryCategory as string[]).length > 0
      : !!request.filters?.primaryCategory;
    if (hasPrimaryCategory) return request;
    return {
      ...request,
      filters: {
        ...request.filters,
        primaryCategory: DEFAULT_PRIMARY_CATEGORIES,
      },
    };
  }, [request, isSemantic]);

  const queryKey = useMemo(
    () => [
      'content-search',
      searchMode,
      effectiveRequest?.query,
      effectiveRequest?.offset,
      effectiveRequest?.limit,
      JSON.stringify(effectiveRequest?.sort_by),
      JSON.stringify(effectiveRequest?.filters),
    ],
    [effectiveRequest, searchMode]
  );

  return useQuery({
    queryKey,
    queryFn: () => isSemantic
      ? contentService.semanticSearch(effectiveRequest)
      : contentService.contentSearch(effectiveRequest),
    enabled: enabled && AppInitializer.isInitialized(),
    staleTime: 60 * 60 * 1000,
  });
};
