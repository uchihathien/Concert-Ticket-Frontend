import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignInScreen } from '../components/SignInScreen';

const base = {
  brand: <span>NexaTicket</span>,
  title: 'Đăng nhập',
  action: () => {},
};

describe('SignInScreen — quên mật khẩu', () => {
  it('hiện liên kết dẫn sang Keycloak khi có href', () => {
    render(
      <SignInScreen
        {...base}
        forgotPasswordHref="http://localhost:8081/realms/nexaticket/login-actions/reset-credentials?client_id=web-admin"
      />,
    );

    const link = screen.getByRole('link', { name: /quên mật khẩu/i });
    // Là thẻ `<a>` chứ không phải nút: người dùng phải thấy được đích đến ở thanh trạng thái trước
    // khi đi gõ mật khẩu ở một tên miền khác.
    expect(link).toHaveAttribute('href', expect.stringContaining('/login-actions/reset-credentials'));
  });

  it('không hiện gì khi thiếu cấu hình', () => {
    // `resetPasswordUrlFromEnv` trả null khi thiếu biến môi trường. Thiếu một liên kết phụ không
    // đáng làm trắng cả trang đăng nhập — thứ người dùng đang cần để vào hệ thống.
    render(<SignInScreen {...base} forgotPasswordHref={null} />);

    expect(screen.queryByRole('link', { name: /quên mật khẩu/i })).toBeNull();
  });

  it('vẫn không có ô mật khẩu nào trên màn hình này', () => {
    // Mật khẩu do Keycloak giữ. Dựng form đăng nhập ở đây là tự rước nghĩa vụ bảo mật mà cả hệ
    // thống đã cố ý đẩy sang IdP — và làm người dùng mất thanh địa chỉ, thứ duy nhất giúp họ phân
    // biệt trang thật với trang giả.
    const { container } = render(<SignInScreen {...base} forgotPasswordHref="http://kc/x" />);

    expect(container.querySelector('input[type="password"]')).toBeNull();
  });
});
