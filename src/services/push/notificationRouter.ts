/**
 * Routes a push notification tap to the correct screen. Called when the user
 * taps a notification from the OS tray or from the in-app inbox.
 *
 * Payload shape (supports both FCM data and inbox feed formats):
 *   data.actionType / data.action.type           — action type string
 *   data.actionData / data.action.additionalInfo — object with deepLink,
 *                                                  identifier, contentURL, etc.
 */

import { ActionType } from './actionTypes';
import { resolveContentUrl } from './contentUrlResolver';

/** Returns true only for safe http/https URLs from push payloads. */
function isSafeUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * FCM's HTTP v1 API enforces `data` as `map<string, string>` at the wire level,
 * so backend serialises `actionData` as a JSON string before sending. The
 * in-app inbox feed (REST JSON) delivers it as a parsed object. Normalise both
 * shapes here so the rest of the router can treat it as an object.
 */
function normaliseActionData(raw: unknown): Record<string, any> {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

export function routeNotification(
  data: Record<string, any>,
  push: (path: string) => void,
  openExternal?: (url: string) => void,
): void {
  if (!data) return;

  const actionType: string = data.actionType ?? data.action?.type ?? '';
  const actionData = normaliseActionData(data.actionData ?? data.action?.additionalInfo);
  const openUrl = openExternal ?? ((url: string) => window.open(url, '_system'));

  switch (actionType) {
    case ActionType.CERTIFICATE_UPDATE:
      push('/profile/learning');
      break;

    case ActionType.COURSE_UPDATE:
    case ActionType.CONTENT_UPDATE:
    case ActionType.BOOK_UPDATE:
      if (actionData.identifier) {
        push(`/content/${actionData.identifier}`);
      }
      break;

    case ActionType.CONTENT_URL: {
      const url: string = actionData.contentURL ?? '';
      if (!url) break;
      const resolved = resolveContentUrl(url);
      if (resolved.kind === 'internal') {
        push(resolved.path);
      } else if (resolved.kind === 'external' && isSafeUrl(resolved.url)) {
        openUrl(resolved.url);
      }
      break;
    }

    case ActionType.UPDATE_APP:
      window.dispatchEvent(new CustomEvent('push:update-app'));
      break;

    case ActionType.SEARCH:
      push('/explore');
      break;

    default:
      push('/notifications');
      break;
  }
}
