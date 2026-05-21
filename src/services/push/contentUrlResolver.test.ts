import { describe, it, expect } from 'vitest';
import { resolveContentUrl } from './contentUrlResolver';

describe('resolveContentUrl', () => {
  it('treats a relative path as internal', () => {
    expect(resolveContentUrl('/content/do_123')).toEqual({
      kind: 'internal',
      path: '/content/do_123',
    });
  });

  it('rewrites /play/content/:id to /content/:id', () => {
    expect(resolveContentUrl('https://example.org/play/content/do_999')).toEqual({
      kind: 'internal',
      path: '/content/do_999',
    });
  });

  it('rewrites /resources/play/content/:id to /content/:id', () => {
    expect(resolveContentUrl('https://example.org/resources/play/content/do_222')).toEqual({
      kind: 'internal',
      path: '/content/do_222',
    });
  });

  it('rewrites /learn/course/:id to /content/:id', () => {
    expect(resolveContentUrl('https://example.org/learn/course/do_42')).toEqual({
      kind: 'internal',
      path: '/content/do_42',
    });
  });

  it('preserves the query string on internal rewrites', () => {
    expect(
      resolveContentUrl('https://example.org/play/content/do_1?utm_source=push'),
    ).toEqual({ kind: 'internal', path: '/content/do_1?utm_source=push' });
  });

  it('routes /explore variants to /explore', () => {
    expect(resolveContentUrl('https://example.org/explore/subject/maths')).toEqual({
      kind: 'internal',
      path: '/explore',
    });
  });

  it('matches /profile and sub-paths but not adjacent paths like /profileX', () => {
    expect(resolveContentUrl('https://example.org/profile')).toEqual({
      kind: 'internal',
      path: '/profile',
    });
    expect(resolveContentUrl('https://example.org/profile/learning')).toEqual({
      kind: 'internal',
      path: '/profile/learning',
    });
    // The bug being guarded against: a prefix-only match that lets /profileX
    // mis-route to /profile. Must fall through to the external bucket.
    expect(resolveContentUrl('https://example.org/profileX')).toEqual({
      kind: 'external',
      url: 'https://example.org/profileX',
    });
    expect(resolveContentUrl('https://example.org/profile-old')).toEqual({
      kind: 'external',
      url: 'https://example.org/profile-old',
    });
  });

  it('falls back to external for unrecognised absolute http(s) URLs', () => {
    const result = resolveContentUrl('https://example.org/something/else');
    expect(result).toEqual({ kind: 'external', url: 'https://example.org/something/else' });
  });

  it('ignores non-http(s) schemes', () => {
    expect(resolveContentUrl('javascript:alert(1)')).toEqual({ kind: 'ignored' });
    expect(resolveContentUrl('mailto:x@example.com')).toEqual({ kind: 'ignored' });
  });

  it('ignores empty / malformed input', () => {
    expect(resolveContentUrl('')).toEqual({ kind: 'ignored' });
    expect(resolveContentUrl('not a url')).toEqual({ kind: 'ignored' });
  });
});
