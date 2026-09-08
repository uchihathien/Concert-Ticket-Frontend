import { describe, expect, it, vi } from 'vitest';
import { endSession, endSessionEndpoint } from '../keycloak';

const base = {
  issuer: 'http://localhost:8081/realms/nexaticket',
  clientId: 'web-customer',
  clientSecret: 'secret',
  refreshToken: 'rt-1',
};

describe('endSession', () => {
  it('gọi đúng logout endpoint của realm', async () => {
    const fetchImpl = vi.fn(async (..._args: unknown[]) => new Response(null, { status: 204 }));

    await endSession({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'http://localhost:8081/realms/nexaticket/protocol/openid-connect/logout',
    );
    expect(endSessionEndpoint('http://x/realms/y/')).toBe(
      'http://x/realms/y/protocol/openid-connect/logout',
    );
  });

  it('gửi refresh token đi — đó là thứ khiến Keycloak kết thúc phiên', async () => {
    // Đây là điểm mấu chốt của cả bản sửa. Gọi logout mà KHÔNG kèm refresh token thì Keycloak trả
    // 200 nhưng không đăng xuất gì cả: nó chỉ hiện trang hỏi "bạn có chắc không". Phiên SSO sống
    // tiếp, và lần đăng nhập sau quay lại đúng tài khoản cũ mà không hỏi mật khẩu.
    const fetchImpl = vi.fn(async (..._args: unknown[]) => new Response(null, { status: 204 }));

    await endSession({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });

    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    const body = init.body as URLSearchParams;
    expect(body.get('refresh_token')).toBe('rt-1');
    expect(body.get('client_id')).toBe('web-customer');
    expect(body.get('client_secret')).toBe('secret');
  });

  it('POST chứ không GET', async () => {
    // GET là đường frontchannel, cần id_token_hint và một vòng chuyển hướng trình duyệt. Đường
    // này chạy hoàn toàn ở server nên vẫn đăng xuất được kể cả khi người dùng đã đóng tab.
    const fetchImpl = vi.fn(async (..._args: unknown[]) => new Response(null, { status: 204 }));

    await endSession({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
  });

  it('Keycloak từ chối thì trả false chứ không ném lỗi', async () => {
    // Nơi gọi phải đăng xuất được ở phía mình dù IdP đang trục trặc. Ném lỗi ở đây sẽ giữ người
    // dùng ở trạng thái đã đăng nhập chỉ vì Keycloak sập — đổi sai chiều.
    const fetchImpl = vi.fn(async (..._args: unknown[]) => new Response('nope', { status: 400 }));

    await expect(
      endSession({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).resolves.toBe(false);
  });
});
