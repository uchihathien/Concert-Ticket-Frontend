import { afterEach, describe, expect, it } from 'vitest';
import { resetPasswordUrl, resetPasswordUrlFromEnv } from '../reset-password';

describe('resetPasswordUrl', () => {
  it('dựng đúng đường mà Keycloak phục vụ form đặt lại mật khẩu', () => {
    expect(resetPasswordUrl('http://localhost:8081/realms/nexaticket', 'web-admin')).toBe(
      'http://localhost:8081/realms/nexaticket/login-actions/reset-credentials?client_id=web-admin',
    );
  });

  it('bỏ dấu gạch chéo thừa ở cuối issuer', () => {
    // Biến môi trường do người gõ tay, và một dấu `/` thừa sinh ra `//login-actions` — Keycloak
    // trả 404 cho đường đó, và thông báo lỗi không gợi ý gì về nguyên nhân.
    expect(resetPasswordUrl('http://localhost:8081/realms/nexaticket/', 'web-admin')).toContain(
      '/nexaticket/login-actions/',
    );
  });

  it('mã hoá client_id', () => {
    // Không client nào hiện có ký tự đặc biệt, nhưng nối thẳng chuỗi vào query string là thói quen
    // sai — và chỗ nó gây hại thật thì không nhìn ra được từ đây.
    expect(resetPasswordUrl('http://kc/realms/r', 'a b&c')).toContain('client_id=a%20b%26c');
  });
});

describe('resetPasswordUrlFromEnv', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it('trả null khi thiếu issuer, thay vì ném lỗi', () => {
    // Thiếu một liên kết phụ không đáng làm trắng cả trang đăng nhập — thứ người dùng đang cần để
    // vào hệ thống.
    delete process.env.KEYCLOAK_ISSUER;
    expect(resetPasswordUrlFromEnv('web-admin')).toBeNull();
  });

  it('rơi về tên app khi không khai KEYCLOAK_CLIENT_ID', () => {
    // Cùng quy ước với `accessTokenDeps`: bốn app dùng bốn client trùng tên app.
    process.env.KEYCLOAK_ISSUER = 'http://localhost:8081/realms/nexaticket';
    delete process.env.KEYCLOAK_CLIENT_ID;
    expect(resetPasswordUrlFromEnv('web-scanner')).toContain('client_id=web-scanner');
  });
});
