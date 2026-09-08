import type { NexaAuth } from './config';
import { readAccessToken } from './server';

export interface AccessTokenResponse {
  accessToken: string;
  /** Epoch ms. Client dùng để tự gọi lại trước khi hết hạn. */
  expiresAt: number;
}

/**
 * Handler cho `GET /api/auth/token` — cửa duy nhất để JS phía client cầm được access token.
 *
 * Thứ tự trong hàm là quan trọng: gọi `auth()` trước để callback `jwt` chạy và làm mới token nếu
 * cần, rồi mới đọc cookie đã cập nhật. Đảo lại thì client nhận token vừa hết hạn.
 *
 * `Cache-Control: no-store` là bắt buộc — một proxy cache lỡ giữ response này là phát token của
 * người này cho người khác.
 */
export function createTokenRoute(nexaAuth: NexaAuth) {
  return async function GET(request: Request): Promise<Response> {
    const session = await nexaAuth.auth();

    if (!session) {
      return json({ error: 'UNAUTHENTICATED' }, 401);
    }
    if (session.authError === 'RefreshFailed') {
      return json({ error: 'SESSION_EXPIRED' }, 401);
    }

    const state = await readAccessToken(request);
    if (state.status !== 'active') {
      return json(
        { error: state.status === 'expired' ? 'SESSION_EXPIRED' : 'UNAUTHENTICATED' },
        401,
      );
    }

    const body: AccessTokenResponse = {
      accessToken: state.accessToken,
      expiresAt: state.expiresAt,
    };
    return json(body, 200);
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, private',
    },
  });
}
