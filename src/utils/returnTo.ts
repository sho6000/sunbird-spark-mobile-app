const KEY = 'auth_return_to';
const DEFAULT_RETURN_TO = '/home';
const BLOCKED_PATHS = new Set(['/sign-in', '/profile/delete-account']);

function normalizeReturnTo(path: string | null): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return null;
  if (BLOCKED_PATHS.has(path)) return null;
  return path;
}

/** Call before navigating to /sign-in. Validates path is a safe relative URL. */
export function saveReturnTo(path: string): void {
  if (normalizeReturnTo(path)) {
    sessionStorage.setItem(KEY, path);
  }
}

/** Read the stored returnTo without clearing it (guards may still intercept). */
export function peekReturnTo(): string {
  const normalized = normalizeReturnTo(sessionStorage.getItem(KEY));
  if (!normalized) {
    sessionStorage.removeItem(KEY);
    return DEFAULT_RETURN_TO;
  }
  return normalized;
}

/** Read and clear the stored returnTo. Call at the final post-login navigation step. */
export function consumeReturnTo(): string {
  const normalized = normalizeReturnTo(sessionStorage.getItem(KEY));
  sessionStorage.removeItem(KEY);
  return normalized ?? DEFAULT_RETURN_TO;
}

/** Clear without navigating — use when abandoning the login flow (e.g. TnC dismissed). */
export function clearReturnTo(): void {
  sessionStorage.removeItem(KEY);
}
