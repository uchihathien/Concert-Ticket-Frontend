import { describe, expect, it } from 'vitest';
import type { AccessTokenState } from '../access-token';
import type { NexaAuth } from '../config';
import { createTokenRoute } from '../route';

function routeFor(state: AccessTokenState) {
  const stub = {
    // Tên cookie phiên lấy theo app, nên route phải biết mình đang phục vụ app nào — thiếu nó thì
    // nhánh 'expired' xoá nhầm một cookie không tồn tại và người dùng mắc kẹt.
    app: 'web-customer',
    readAccessToken: async () => state,
  } as unknown as NexaAuth;
  return createTokenRoute(stub);
}

const request = new Request('https://app.example/api/auth/token');

describe('GET /api/auth/token', () => {
  it('trả token còn hạn kèm no-store', async () => {
    const expiresAt = Date.now() + 300_000;
    const response = await routeFor({
      status: 'active',
      accessToken: 'at-1',
      expiresAt,
      userId: 'sub-1',
    })(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accessToken: 'at-1', expiresAt });
    // Một proxy cache lỡ giữ response này là phát token của người này cho người khác.
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('chưa đăng nhập: 401 UNAUTHENTICATED', async () => {
    const response = await routeFor({ status: 'anonymous' })(request);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'UNAUTHENTICATED' });
  });

  it('phiên hết hạn: 401 SESSION_EXPIRED, và xoá cookie của ĐÚNG app', async () => {
    const response = await routeFor({ status: 'expired' })(request);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'SESSION_EXPIRED' });

    // Không xoá thì cookie vẫn nói "đã đăng nhập" và người dùng không có đường tự thoát. Xoá nhầm
    // tên mặc định của Auth.js thì cũng vậy — và còn giết luôn phiên của app khác trên cùng host.
    const cleared = response.headers.getSetCookie().join('|');
    expect(cleared).toContain('web-customer.session-token=;');
    expect(cleared).toContain('Max-Age=0');
    expect(cleared).not.toContain('authjs.session-token');
  });

  it('Keycloak trục trặc: 503, KHÔNG phải 401', async () => {
    // 401 khiến client xoá token và báo "phiên hết hạn" — tức là đăng xuất người dùng chỉ vì IdP
    // chớp một cái. Phiên vẫn còn giá trị; lần gọi sau thử lại là xong.
    const response = await routeFor({ status: 'unavailable' })(request);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'IDP_UNAVAILABLE' });
  });
});
