import { createSignInRedirect, getAccessToken } from '@nexaticket/auth/client';
import { createApiClient, resolveApiBaseUrl } from '@nexaticket/ts-sdk';

/**
 * Client gọi api-gateway.
 *
 * Token lấy qua `getAccessToken` của `@nexaticket/auth/client` — bộ nhớ tiến trình của tab,
 * không phải storage của trình duyệt.
 */
export const apiClient = createApiClient({
  baseUrl: resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL),
  getAccessToken,
  onUnauthenticated: createSignInRedirect('/login'),
});
