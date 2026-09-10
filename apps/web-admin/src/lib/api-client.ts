import { createSignInRedirect, getAccessToken } from '@nexaticket/auth/client';
import { createApiClient } from '@nexaticket/ts-sdk';

/**
 * Client gọi api-gateway.
 *
 * Token lấy qua `getAccessToken` của `@nexaticket/auth/client` — bộ nhớ tiến trình của tab,
 * không phải storage của trình duyệt.
 *
 * `onUnauthenticated` là đường thoát duy nhất khi phiên bị thu hồi từ phía server:
 * `/api/auth/token` chỉ hỏi Keycloak, mà Keycloak không biết identity-service đã thu hồi phiên hay
 * khoá tài khoản — nên nó trả 200 mãi trong khi mọi lời gọi API trả 401.
 */
export const apiClient = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080',
  getAccessToken,
  onUnauthenticated: createSignInRedirect('/login'),
});
