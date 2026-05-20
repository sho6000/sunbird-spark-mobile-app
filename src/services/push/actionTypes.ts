/**
 * Push notification action types. The backend sets `actionType` in the FCM data
 * payload (or `action.type` in the in-app notification feed); both router and
 * inbox tap handlers should compare against these constants — never the raw
 * string literals — so the contract stays in one place.
 */
export const ActionType = {
  CERTIFICATE_UPDATE: 'certificateUpdate',
  COURSE_UPDATE: 'courseUpdate',
  CONTENT_UPDATE: 'contentUpdate',
  BOOK_UPDATE: 'bookUpdate',
  UPDATE_APP: 'updateApp',
  EXT_URL: 'extURL',
  CONTENT_URL: 'contentURL',
  SEARCH: 'search',
} as const;

export type ActionTypeValue = (typeof ActionType)[keyof typeof ActionType];
