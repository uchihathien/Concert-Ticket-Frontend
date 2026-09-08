/**
 * `@nexaticket/auth` — Auth.js + Keycloak cho cả 4 app, mỗi app một client OIDC riêng.
 *
 * Điểm vào phía server. Code chạy trong trình duyệt dùng `@nexaticket/auth/client`.
 */
export { createNexaAuth, REGISTER_PROVIDER_ID } from './config';
export type { NexaApp, NexaAuth, NexaAuthOptions } from './config';

export { createTokenRoute } from './route';
export type { AccessTokenResponse } from './route';

export { safeReturnUrl } from './return-url';

export { readAccessToken } from './server';
export type { AccessTokenState } from './server';

export { refreshAccessToken, RefreshFailedError, tokenEndpoint } from './keycloak';
export type { RefreshResult } from './keycloak';

export { defaultRefreshTokenStore, InMemoryRefreshTokenStore, newTokenRef } from './token-store';
export type { RefreshTokenStore, StoredRefreshToken } from './token-store';
