import { getToken } from 'next-auth/jwt';

/**
 * Đọc access token từ cookie phiên, phía server.
 *
 * Dùng ở route handler `/api/auth/token` và ở RSC / Server Action khi cần gọi API thay mặt người
 * dùng. Không có đường nào lấy được token này từ JS phía client ngoài `/api/auth/token`.
 *
 * `getToken` giải mã cookie nhưng **không** chạy callback `jwt`, nên nó không tự làm mới token.
 * Việc làm mới xảy ra ở `auth()` — hãy gọi `auth()` trước trong cùng request (route handler ở
 * `createTokenRoute` làm đúng thứ tự này).
 */
export async function readAccessToken(request: Request): Promise<AccessTokenState> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('[@nexaticket/auth] Thiếu biến môi trường AUTH_SECRET');

  const token = await getToken({
    req: request,
    secret,
    secureCookie: isSecure(request),
  });

  if (!token) return { status: 'anonymous' };
  if (token.authError === 'RefreshFailed') return { status: 'expired' };
  if (!token.accessToken || !token.accessTokenExpiresAt) return { status: 'anonymous' };

  return {
    status: 'active',
    accessToken: token.accessToken,
    expiresAt: token.accessTokenExpiresAt,
    userId: token.sub ?? null,
  };
}

export type AccessTokenState =
  | { status: 'anonymous' }
  /** Phiên còn cookie nhưng không làm mới được — UI phải mời đăng nhập lại. */
  | { status: 'expired' }
  | { status: 'active'; accessToken: string; expiresAt: number; userId: string | null };

/**
 * Cookie phiên mang tiền tố `__Secure-` khi chạy trên https. Đoán sai tiền tố thì `getToken` tìm
 * không thấy cookie và mọi thứ im lặng trở thành "chưa đăng nhập".
 */
function isSecure(request: Request): boolean {
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (authUrl) return authUrl.startsWith('https://');
  return new URL(request.url).protocol === 'https:';
}
