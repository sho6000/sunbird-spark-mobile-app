import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn() }));

vi.mock('../services/NativeConfigService', () => ({
  NativeConfigServiceInstance: { load: mockLoad },
}));

import { useAiSearchEnabled } from './useAiSearchEnabled';

describe('useAiSearchEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to true before the native config resolves', () => {
    mockLoad.mockReturnValue(new Promise(() => { /* never resolves */ }));
    const { result } = renderHook(() => useAiSearchEnabled());
    expect(result.current).toBe(true);
  });

  it('stays true when native config enables AI search', async () => {
    mockLoad.mockResolvedValue({ enableAiSearch: true });
    const { result } = renderHook(() => useAiSearchEnabled());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('becomes false when native config disables AI search', async () => {
    mockLoad.mockResolvedValue({ enableAiSearch: false });
    const { result } = renderHook(() => useAiSearchEnabled());
    await waitFor(() => expect(result.current).toBe(false));
  });
});
