import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { useContentRead } from './useContent';

const { mockContentRead } = vi.hoisted(() => ({
  mockContentRead: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('../services/ContentService', () => ({
  ContentService: class {
    contentRead = mockContentRead;
  },
}));

describe('useContentRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockImplementation((opts) => opts as unknown as ReturnType<typeof useQuery>);
  });

  it('uses content-read queryKey with contentId, fields, mode, and enrichTranscripts', () => {
    renderHook(() => useContentRead('content-abc', { fields: ['name', 'description'], mode: 'edit' }));
    const call = vi.mocked(useQuery).mock.calls[0]?.[0] as Parameters<typeof useQuery>[0];
    expect(call.queryKey).toEqual(['content-read', 'content-abc', ['name', 'description'], 'edit', false]);
  });

  it('is enabled when contentId is non-empty', () => {
    renderHook(() => useContentRead('content-abc'));
    const call = vi.mocked(useQuery).mock.calls[0]?.[0] as Parameters<typeof useQuery>[0];
    expect(call.enabled).toBe(true);
  });

  it('is disabled when contentId is empty string', () => {
    renderHook(() => useContentRead(''));
    const call = vi.mocked(useQuery).mock.calls[0]?.[0] as Parameters<typeof useQuery>[0];
    expect(call.enabled).toBe(false);
  });

  it('is disabled when enabled option is false', () => {
    renderHook(() => useContentRead('content-abc', { enabled: false }));
    const call = vi.mocked(useQuery).mock.calls[0]?.[0] as Parameters<typeof useQuery>[0];
    expect(call.enabled).toBe(false);
  });

  it('calls contentService.contentRead with correct params via queryFn', () => {
    mockContentRead.mockResolvedValue({ data: {} });
    renderHook(() => useContentRead('c-123', { fields: ['name'], mode: 'view' }));
    const call = vi.mocked(useQuery).mock.calls[0]?.[0] as Parameters<typeof useQuery>[0];
    (call.queryFn as () => void)();
    expect(mockContentRead).toHaveBeenCalledWith('c-123', ['name'], 'view', false);
  });

  it('includes enrichTranscripts=true in queryKey and passes it through to contentRead when enabled', () => {
    mockContentRead.mockResolvedValue({ data: {} });
    renderHook(() => useContentRead('c-123', { fields: ['name'], mode: 'view', enrichTranscripts: true }));
    const call = vi.mocked(useQuery).mock.calls[0]?.[0] as Parameters<typeof useQuery>[0];
    expect(call.queryKey).toEqual(['content-read', 'c-123', ['name'], 'view', true]);
    (call.queryFn as () => void)();
    expect(mockContentRead).toHaveBeenCalledWith('c-123', ['name'], 'view', true);
  });

  it('has 1 hour staleTime', () => {
    renderHook(() => useContentRead('c-123'));
    const call = vi.mocked(useQuery).mock.calls[0]?.[0] as Parameters<typeof useQuery>[0];
    expect(call.staleTime).toBe(60 * 60 * 1000);
  });
});
