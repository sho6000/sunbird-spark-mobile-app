import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// vi.hoisted ensures these are available when the hoisted vi.mock factories run.
const { mockContentSearch, mockSemanticSearch } = vi.hoisted(() => ({
  mockContentSearch: vi.fn(),
  mockSemanticSearch: vi.fn(),
}));

vi.mock('../services/ContentService', () => ({
  ContentService: class {
    contentSearch = mockContentSearch;
    semanticSearch = mockSemanticSearch;
  },
}));

vi.mock('../AppInitializer', () => ({
  AppInitializer: {
    isInitialized: vi.fn(),
  },
}));

import { useContentSearch } from './useContentSearch';
import { AppInitializer } from '../AppInitializer';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

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

describe('useContentSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AppInitializer.isInitialized).mockReturnValue(true);
  });

  it('should fetch search results successfully', async () => {
    const mockResponse = {
      data: {
        result: {
          count: 1,
          content: [{ identifier: 'content-1', name: 'Test Content' }],
        },
      },
    };
    mockContentSearch.mockResolvedValue(mockResponse);

    const { result } = renderHook(
      () => useContentSearch({ request: { query: 'test', filters: { primaryCategory: ['Course'] } } }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
  });

  it('should inject default primaryCategory when none is provided', async () => {
    mockContentSearch.mockResolvedValue({ data: {} });

    renderHook(
      () => useContentSearch({ request: { query: 'test', filters: {} } }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(mockContentSearch).toHaveBeenCalled();
    });

    const calledWith = mockContentSearch.mock.calls[0][0];
    expect(calledWith.filters.primaryCategory).toEqual(DEFAULT_PRIMARY_CATEGORIES);
  });

  it('should not inject default primaryCategory when one is provided', async () => {
    mockContentSearch.mockResolvedValue({ data: {} });

    renderHook(
      () =>
        useContentSearch({
          request: { query: 'test', filters: { primaryCategory: ['Course'] } },
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(mockContentSearch).toHaveBeenCalled();
    });

    const calledWith = mockContentSearch.mock.calls[0][0];
    expect(calledWith.filters.primaryCategory).toEqual(['Course']);
  });

  it('should inject default primaryCategory when array is empty', async () => {
    mockContentSearch.mockResolvedValue({ data: {} });

    renderHook(
      () =>
        useContentSearch({
          request: { query: 'test', filters: { primaryCategory: [] } },
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(mockContentSearch).toHaveBeenCalled();
    });

    const calledWith = mockContentSearch.mock.calls[0][0];
    expect(calledWith.filters.primaryCategory).toEqual(DEFAULT_PRIMARY_CATEGORIES);
  });

  it('should handle fetch errors', async () => {
    mockContentSearch.mockRejectedValue(new Error('Search failed'));

    const { result } = renderHook(
      () => useContentSearch({ request: { query: 'test' } }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Search failed');
  });

  it('should not fetch when enabled is false', () => {
    const { result } = renderHook(
      () => useContentSearch({ request: { query: 'test' }, enabled: false }),
      { wrapper: createWrapper() }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockContentSearch).not.toHaveBeenCalled();
  });

  it('should not fetch when AppInitializer is not initialized', () => {
    vi.mocked(AppInitializer.isInitialized).mockReturnValue(false);

    const { result } = renderHook(
      () => useContentSearch({ request: { query: 'test' } }),
      { wrapper: createWrapper() }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockContentSearch).not.toHaveBeenCalled();
  });

  it('should handle undefined options', async () => {
    mockContentSearch.mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useContentSearch(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should handle undefined request', async () => {
    mockContentSearch.mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useContentSearch({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // When request is undefined, it should be passed as-is
    expect(mockContentSearch).toHaveBeenCalledWith(undefined);
  });

  describe('semantic search mode', () => {
    it('should call semanticSearch (not contentSearch) when searchMode is "semantic"', async () => {
      mockSemanticSearch.mockResolvedValue({ data: {} });

      renderHook(
        () => useContentSearch({ searchMode: 'semantic', request: { query: 'fractions' } }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockSemanticSearch).toHaveBeenCalled();
      });
      expect(mockContentSearch).not.toHaveBeenCalled();
    });

    it('should NOT inject default primaryCategory in semantic mode', async () => {
      mockSemanticSearch.mockResolvedValue({ data: {} });

      renderHook(
        () => useContentSearch({ searchMode: 'semantic', request: { query: 'q', filters: {} } }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockSemanticSearch).toHaveBeenCalled();
      });

      const calledWith = mockSemanticSearch.mock.calls[0][0];
      expect(calledWith.filters.primaryCategory).toBeUndefined();
    });

    it('should use contentSearch (keyword) by default', async () => {
      mockContentSearch.mockResolvedValue({ data: {} });

      renderHook(
        () => useContentSearch({ request: { query: 'q', filters: { primaryCategory: ['Course'] } } }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockContentSearch).toHaveBeenCalled();
      });
      expect(mockSemanticSearch).not.toHaveBeenCalled();
    });
  });
});
