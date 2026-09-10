import { describe, expect, it } from 'vitest';
import { authCookieNames, sessionCookieName } from '../cookies';

/**
 * Cookie không phân biệt cổng: bốn app dev trên `localhost` dùng chung một kho cookie. Tên phải
 * mang tên app, nếu không chúng ghi đè phiên của nhau — xem đầu `cookies.ts`.
 */
describe('tên cookie theo app', () => {
  it('hai app không dùng chung tên nào', () => {
    const customer = Object.values(authCookieNames('web-customer', false)).map((c) => c.name);
    const admin = Object.values(authCookieNames('web-admin', false)).map((c) => c.name);

    expect(customer).toHaveLength(6);
    expect(customer.filter((name) => admin.includes(name))).toEqual([]);
  });

  it('không còn tên mặc định của Auth.js', () => {
    const names = Object.values(authCookieNames('web-scanner', false)).map((c) => c.name);
    expect(names.some((name) => name.startsWith('authjs.'))).toBe(false);
  });

  it('https giữ nguyên tiền tố bảo mật, và csrf vẫn là __Host- chứ không phải __Secure-', () => {
    const names = authCookieNames('web-platform', true);
    expect(names.sessionToken.name).toBe('__Secure-web-platform.session-token');
    expect(names.pkceCodeVerifier.name).toBe('__Secure-web-platform.pkce.code_verifier');
    // __Host- chặt hơn __Secure-: trình duyệt còn đòi Path=/ và cấm Domain.
    expect(names.csrfToken.name).toBe('__Host-web-platform.csrf-token');
  });

  it('tên cookie phiên là thứ Auth.js dùng làm salt, nên phải khớp tuyệt đối', () => {
    expect(sessionCookieName('web-admin', false)).toBe('web-admin.session-token');
    expect(authCookieNames('web-admin', false).sessionToken.name).toBe(
      sessionCookieName('web-admin', false),
    );
  });
});
