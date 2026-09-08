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

export function endSessionEndpoint(issuer: string): string {
  return `${issuer.replace(/\/$/, '')}/protocol/openid-connect/logout`;
}

/**
 * Kết thúc phiên đăng nhập ở phía Keycloak.
 *
 * <h3>Vì sao logout của Auth.js một mình là không đủ</h3>
 *
 * `signOut()` chỉ xoá cookie phiên của Next.js. Hai thứ vẫn sống nguyên bên Keycloak:
 *
 * 1. **Refresh token** — vẫn đổi được ra access token mới. Ai cầm được nó vẫn vào được tài khoản,
 *    dù người dùng tưởng mình đã đăng xuất.
 * 2. **Phiên SSO** — cookie `KEYCLOAK_IDENTITY` sống 30 ngày theo cấu hình realm. Lần đăng nhập
 *    sau, Keycloak thấy phiên còn hiệu lực và **cấp code ngay mà không hỏi mật khẩu**. Hệ quả là
 *    không có cách nào đăng nhập bằng tài khoản khác: bấm "Đăng nhập" là quay lại đúng tài khoản
 *    vừa thoát.
 *
 * Vấn đề thứ hai mới là thứ người dùng gặp và báo lại; vấn đề thứ nhất thì âm thầm hơn nhưng nặng
 * hơn.
 *
 * <h3>Vì sao gọi backchannel chứ không chuyển hướng trình duyệt</h3>
 *
 * Cách thường thấy là đẩy trình duyệt tới `end_session_endpoint`. Đo thực tế trên Keycloak 26:
 *
 * | Cách | Refresh token | Phiên SSO |
 * | --- | --- | --- |
 * | Không gọi gì (trước bản sửa này) | còn dùng được | còn |
 * | POST backchannel kèm refresh_token | **đã thu hồi** | **đã kết thúc** |
 * | GET frontchannel chỉ kèm client_id | còn dùng được | còn |
 *
 * Dòng cuối gây bất ngờ: Keycloak trả HTTP 200 nhưng **không** đăng xuất — nó hiện một trang hỏi
 * "bạn có chắc muốn thoát không". Muốn nó thoát ngay thì phải kèm `id_token_hint`, tức là phải lưu
 * thêm id token chỉ để dùng cho lúc đăng xuất.
 *
 * Bản backchannel làm đủ cả hai việc, chỉ cần refresh token đã có sẵn ở store, và chạy được cả khi
 * người dùng đóng tab trước khi chuyển hướng kịp.
 *
 * @returns `true` nếu Keycloak xác nhận đã đăng xuất
 */
export async function endSession(params: {
  issuer: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<boolean> {
  const doFetch = params.fetchImpl ?? globalThis.fetch;

  const response = await doFetch(endSessionEndpoint(params.issuer), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
    }),
  });

  return response.ok;
}
