import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockLoadLocal, mockGetHierarchy, mockGetQuestionList } = vi.hoisted(() => ({
  mockLoadLocal: vi.fn(),
  mockGetHierarchy: vi.fn(),
  mockGetQuestionList: vi.fn(),
}));

vi.mock('../services/content/localQumlLoader', () => ({
  loadLocalQumlContent: mockLoadLocal,
}));

vi.mock('../services/QuestionSetService', () => ({
  questionSetService: {
    getHierarchy: mockGetHierarchy,
    getQuestionList: mockGetQuestionList,
  },
}));

import { useQumlContent } from './useQumlContent';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useQumlContent', () => {
  it('short-circuits to local content and never calls the API when downloaded', async () => {
    const localMeta = { identifier: 'qs1', name: 'Local QS' };
    mockLoadLocal.mockResolvedValue(localMeta);

    const { result } = renderHook(() => useQumlContent('qs1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(localMeta);
    expect(mockGetHierarchy).not.toHaveBeenCalled();
    expect(mockGetQuestionList).not.toHaveBeenCalled();
  });

  it('falls back to the API when no local content is available', async () => {
    mockLoadLocal.mockResolvedValue(null);
    mockGetHierarchy.mockResolvedValue({
      data: {
        questionset: {
          identifier: 'qs1',
          outcomeDeclaration: { maxScore: { defaultValue: 1 } },
          children: [],
        },
      },
    });

    const { result } = renderHook(() => useQumlContent('qs1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetHierarchy).toHaveBeenCalledWith('qs1');
    expect(result.current.data.identifier).toBe('qs1');
  });

  it('does not run when disabled', () => {
    mockLoadLocal.mockResolvedValue(null);
    renderHook(() => useQumlContent('qs1', { enabled: false }), { wrapper: createWrapper() });
    expect(mockLoadLocal).not.toHaveBeenCalled();
    expect(mockGetHierarchy).not.toHaveBeenCalled();
  });
});
