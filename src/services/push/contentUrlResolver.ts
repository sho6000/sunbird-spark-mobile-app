/**
 * Resolves a `contentURL` from a push payload to a navigation target.
 *
 * The backend may send:
 *   - A relative path  ("/content/do_123")           → push directly
 *   - An absolute URL  ("https://example.org/play/content/do_123")
 *       - If the path matches a known internal pattern → strip host & route in-app
 *       - Otherwise → open in external browser
 *
 * The known-pattern list mirrors legacy SunbirdEd deep-link behaviour and lives
 * here as a static table rather than a backend system setting. If a new content
 * type is introduced, add its pattern below — keep the list short and explicit
 * so it stays auditable.
 */

type Internal = { kind: 'internal'; path: string };
type External = { kind: 'external'; url: string };
type Ignored = { kind: 'ignored' };

export type ResolvedContentUrl = Internal | External | Ignored;

interface PatternMap {
  /** Regex against the URL pathname (no leading slash trimmed). */
  match: RegExp;
  /** Builds the in-app route from regex groups. */
  toPath: (m: RegExpMatchArray) => string;
}

const INTERNAL_PATTERNS: PatternMap[] = [
  // /play/content/:id, /resources/play/content/:id, /play/collection/:id
  { match: /^\/(?:resources\/)?play\/(?:content|collection)\/([^/?#]+)/, toPath: (m) => `/content/${m[1]}` },
  // /learn/course/:id
  { match: /^\/learn\/course\/([^/?#]+)/, toPath: (m) => `/content/${m[1]}` },
  // /explore (search landing)
  { match: /^\/explore(?:\/.*)?$/, toPath: () => '/explore' },
  // /profile (or sub-paths) — keep namespace, strip host.
  // The `(?:\/.*)?$` anchor prevents accidental matches like `/profileX`.
  { match: /^(\/profile(?:\/.*)?)$/, toPath: (m) => m[1] },
  // /notifications
  { match: /^\/notifications(?:\/.*)?$/, toPath: () => '/notifications' },
];

export function resolveContentUrl(rawUrl: string): ResolvedContentUrl {
  if (!rawUrl) return { kind: 'ignored' };

  // Relative path → push as-is (router handles it). We require a leading slash
  // to avoid accidentally treating a bare string like "foo" as a route.
  if (rawUrl.startsWith('/')) {
    return { kind: 'internal', path: rawUrl };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { kind: 'ignored' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { kind: 'ignored' };
  }

  const pathAndQuery = parsed.pathname + parsed.search + parsed.hash;
  for (const { match, toPath } of INTERNAL_PATTERNS) {
    const m = parsed.pathname.match(match);
    if (m) {
      // Preserve query/hash on the resolved path (e.g. tracking params).
      const base = toPath(m);
      const tail = parsed.search + parsed.hash;
      return { kind: 'internal', path: tail ? `${base}${tail}` : base };
    }
  }

  return { kind: 'external', url: pathAndQuery && parsed.toString() };
}
