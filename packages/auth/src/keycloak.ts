/** Gọi thẳng token endpoint của Keycloak để làm mới access token. */

export interface RefreshResult {
  accessToken: string;
  /** Epoch ms. */
  expiresAt: number;
  /** Keycloak xoay vòng refresh token: bản mới phải được ghi đè vào store. */
  refreshToken: string;
  idToken?: string;
}

export class RefreshFailedError extends Error {
  readonly recoverable: boolean;

  constructor(message: string, recoverable: boolean) {
    super(message);
    this.name = 'RefreshFailedError';
    this.recoverable = recoverable;
  }
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

export function tokenEndpoint(issuer: string): string {
  return `${issuer.replace(/\/$/, '')}/protocol/openid-connect/token`;
}

export async function refreshAccessToken(params: {
  issuer: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<RefreshResult> {
  const doFetch = params.fetchImpl ?? globalThis.fetch;

  const response = await doFetch(tokenEndpoint(params.issuer), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as TokenResponse;

  if (!response.ok || !body.access_token) {
    // `invalid_grant` = refresh token hết hạn hoặc đã bị thu hồi: bắt đăng nhập lại, đừng thử lại.
    // Lỗi khác (Keycloak sập, mạng nội bộ trục trặc) thì phiên vẫn còn giá trị.
    const recoverable = body.error !== 'invalid_grant';
    throw new RefreshFailedError(
      body.error_description ?? body.error ?? `Keycloak trả ${response.status}`,
      recoverable,
    );
  }

  return {
    accessToken: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    // Keycloak mặc định xoay vòng; nếu không xoay thì dùng lại bản cũ.
    refreshToken: body.refresh_token ?? params.refreshToken,
    idToken: body.id_token,
  };
}
