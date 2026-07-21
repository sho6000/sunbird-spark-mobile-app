import { HttpService } from '../services/HttpService';
import { NativeConfigServiceInstance } from '../services/NativeConfigService';
import { AppConsumerAuthService } from '../services/AppConsumerAuthService';
import type { AuthTokens, AuthApiError } from './types';

const httpService = new HttpService();

/**
 * Calls POST /mobile/keycloak/login on the backend.
 * The backend handles Keycloak ROPC internally — we just send emailId + password as JSON.
 */
export const loginWithCredentials = async (
  emailId: string,
  password: string,
): Promise<AuthTokens> => {
  const config = await NativeConfigServiceInstance.load();
  const baseUrl = config.baseUrl;

  const data = await httpService.post<AuthTokens | AuthApiError>(
    `${baseUrl}/api/mobile/keycloak/login`,
    { emailId, password },
  );

  // Backend returns { error, error_msg } on failure (CapacitorHttp doesn't throw on 4xx)
  if (data && typeof data === 'object' && 'error' in data && (data as AuthApiError).error) {
    const errorData = data as AuthApiError;
    const err = new Error(errorData.error_msg || 'Login failed');
    (err as any).code = errorData.error;
    throw err;
  }

  // Verify we actually got tokens back
  if (!data || typeof data !== 'object' || !('access_token' in data)) {
    throw new Error('Login failed');
  }

  return data as AuthTokens;
};

/**
 * Calls POST /mobile/google/auth/android on the backend.
 * Sends the Google ID token (via X-GOOGLE-ID-TOKEN header), emailId, and optional
 * display name in the request body. Also attaches the device Kong token as Authorization.
 * Backend verifies the token with Google, finds/creates the Sunbird user, and returns
 * Keycloak session tokens.
 */
export const loginWithGoogleToken = async (
  idToken: string,
  emailId: string,
  name?: string,
): Promise<AuthTokens> => {
  const config = await NativeConfigServiceInstance.load();
  const baseUrl = config.baseUrl;

  const authService = AppConsumerAuthService.getInstance();
  const kongToken = await authService.getAuthenticatedToken();

  const data = await httpService.post<any>(
    `${baseUrl}/mobile/google/auth/android`,
    { emailId, name },
    {
      'X-GOOGLE-ID-TOKEN': idToken,
      'Authorization': `Bearer ${kongToken}`,
    },
  );

  // Backend returns { error, msg } on failure
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    const err = new Error(data.msg || data.error_msg || 'Google sign-in failed');
    (err as any).code = data.error;
    throw err;
  }

  // Backend returns { msg } without error field for some failures
  if (data && typeof data === 'object' && 'msg' in data && !('access_token' in data)) {
    throw new Error(data.msg || 'Google sign-in failed');
  }

  // Verify we got tokens
  if (!data || typeof data !== 'object' || !('access_token' in data)) {
    throw new Error('Google sign-in failed');
  }

  return data as AuthTokens;
};

const MAX_REFRESH_RETRIES = 3;

/**
 * Calls POST /mobile/auth/v1/refresh/token on the backend.
 *
 * Request:
 *   Header: Authorization — current bearer token
 *   Body:   { refresh_token }
 *
 * Response: Sunbird envelope → result.data contains new tokens
 *
 * Retries up to 3 times on 500 errors. Throws on all other failures.
 */
export const refreshAccessToken = async (
  refreshToken: string,
  accessToken: string,
): Promise<AuthTokens> => {
  const config = await NativeConfigServiceInstance.load();
  const baseUrl = config.baseUrl;

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_REFRESH_RETRIES; attempt++) {
    try {
      const data = await httpService.post<any>(
        `${baseUrl}/mobile/auth/v1/refresh/token`,
        { refresh_token: refreshToken },
        { Authorization: `Bearer ${accessToken}` },
      );

      // Success — backend returns Sunbird envelope with result.data containing tokens
      const tokens = data?.result?.data;
      if (tokens?.access_token) {
        return {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          id_token: tokens.id_token,
        };
      }

      // Check if it's a server error (500) — retry
      const responseCode = data?.responseCode;
      const isServerError = responseCode === 'SERVER_ERROR';

      if (isServerError && attempt < MAX_REFRESH_RETRIES) {
        lastError = new Error(data?.params?.errmsg || 'Token refresh failed');
        continue;
      }

      // Client error or final server error — don't retry
      const errMsg = data?.params?.errmsg || data?.params?.err || 'Token refresh failed';
      const err = new Error(errMsg);
      (err as any).code = data?.params?.err || 'REFRESH_FAILED';
      (err as any).isServerError = isServerError;
      throw err;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_REFRESH_RETRIES) {
        continue;
      }
      throw err;
    }
  }

  // Should not reach here, but safety net
  throw lastError || new Error('Token refresh failed');
};
