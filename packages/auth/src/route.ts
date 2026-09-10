import type { NexaAuth } from './config';
import { expiredSessionCookies } from './server';

export interface AccessTokenResponse {
  accessToken: string;
  /** Epoch ms. Client dùng để tự gọi lại trước khi hết hạn. */
  expiresAt: number;
}

/**
 * Handler cho `GET /api/auth/token` — cửa duy nhất để JS phía client cầm được access token.
 *
 * <h3>Vì sao không còn gọi `auth()` trước</h3>
 *
 * Bản trước gọi `auth()` để callback `jwt` chạy và làm mới token, rồi đọc cookie "đã cập nhật".
 * Cookie không bao giờ được cập nhật: `auth()` không tham số rơi vào nhánh RSC của next-auth, và
 * nhánh đó vứt bỏ `Set-Cookie` do `@auth/core` trả về. Route vì thế phát ra token cũ — đã hết hạn
 * — trong khi Keycloak đã xoay vòng refresh token. Chi tiết ở đầu `access-token.ts`.
 *
 * <h3>Đây là nơi duy nhất kết luận được "phiên đã chết"</h3>
 *
 * Middleware chạy ở Edge runtime và không nhìn thấy store, nên nó chỉ biết "có cookie hay không".
 * Route này chạy phía Node và thấy store, nên khi phiên chết thật thì chính nó phải xoá cookie —
 * nếu không người dùng mắc kẹt: cookie nói đã đăng nhập, mọi lời gọi API trả 401, và không có
 * đường nào tự thoát.
 *
 * `Cache-Control: no-store` là bắt buộc — một proxy cache lỡ giữ response này là phát token của
 * người này cho người khác.
 */
export function createTokenRoute(nexaAuth: NexaAuth) {
  return async function GET(request: Request): Promise<Response> {
    const state = await nexaAuth.readAccessToken(request);

    if (state.status === 'active') {
      const body: AccessTokenResponse = {
        accessToken: state.accessToken,
        expiresAt: state.expiresAt,
      };
      return json(body, 200);
    }

    if (state.status === 'unavailable') {
      // 503 chứ không 401, và khác biệt này quan trọng: 401 khiến client xoá token và báo "phiên
      // hết hạn", tức là đăng xuất người dùng chỉ vì Keycloak chớp một cái. Phiên vẫn còn giá trị;
      // lần gọi sau thử lại là xong.
      return json({ error: 'IDP_UNAVAILABLE' }, 503);
    }

    if (state.status === 'expired') {
      return json({ error: 'SESSION_EXPIRED' }, 401, expiredSessionCookies(nexaAuth.app));
    }

    return json({ error: 'UNAUTHENTICATED' }, 401);
  };
}

function json(body: unknown, status: number, setCookies: string[] = []): Response {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, private',
  });
  for (const cookie of setCookies) {
    headers.append('Set-Cookie', cookie);
  }
  return new Response(JSON.stringify(body), { status, headers });
}
