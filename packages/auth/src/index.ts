/**
 * `@nexaticket/auth` — Auth.js + Keycloak cho cả 4 app, mỗi app một client OIDC riêng.
 *
 * Điểm vào phía server. Code chạy trong trình duyệt dùng `@nexaticket/auth/client`.
 */
export { createNexaAuth, REGISTER_PROVIDER_ID } from './config';
export type { NexaApp, NexaAuth, NexaAuthOptions } from './config';

export { createTokenRoute } from './route';
export type { AccessTokenResponse } from './route';

export { IDP_GOOGLE, idpHint } from './idp';

export { safeReturnUrl } from './return-url';

export { resetPasswordUrl, resetPasswordUrlFromEnv } from './reset-password';

export { ensureAccessToken } from './access-token';
export type { AccessTokenDeps, AccessTokenState } from './access-token';

export { expiredSessionCookies, readSessionCookie } from './server';
export type { SessionCookie } from './server';

export { authCookieNames, sessionCookieName, useSecureCookies } from './cookies';

export {
  endSession,
  endSessionEndpoint,
  refreshAccessToken,
  RefreshFailedError,
  tokenEndpoint,
} from './keycloak';
export type { RefreshResult } from './keycloak';

export { defaultRefreshTokenStore, InMemoryRefreshTokenStore, newTokenRef } from './token-store';
export { RedisRefreshTokenStore } from './redis-store';
export type { RedisLike } from './redis-store';
export type { RefreshTokenStore, StoredRefreshToken } from './token-store';
