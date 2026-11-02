/**
 * Thông báo hiện trên đầu trang `/login` — lỗi đăng nhập hoặc phiên đã hết hạn.
 *
 * <h3>Hai nguồn</h3>
 *
 * - `?error=…` do Auth.js gắn khi luồng OIDC hỏng giữa chừng (`pages.error` trỏ về trang đăng nhập
 *   của app, xem `config.ts`). Trước đây người dùng rơi vào trang lỗi mặc định của Auth.js: chữ
 *   tiếng Anh, nền trắng, không có đường quay lại.
 * - `?reason=expired` do `createSignInRedirect` gắn khi gateway trả 401 giữa lúc đang dùng.
 *
 * <h3>Câu chữ</h3>
 *
 * Dùng chung giọng với theme Keycloak (`messages_vi.properties`) và màn đăng nhập nhân viên của app
 * mobile: nói chuyện gì xảy ra và việc cần làm tiếp. Không chép mã lỗi kỹ thuật ra màn hình.
 */

export type SignInNoticeTone = 'error' | 'info';

export interface SignInNotice {
  tone: SignInNoticeTone;
  message: string;
}

/** Mã lỗi Auth.js v5 chuyển cho `pages.error`. Mã lạ rơi về câu mặc định. */
const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    'Tài khoản này không có quyền vào khu vực này. Đăng nhập bằng tài khoản khác hoặc liên hệ quản trị viên.',
  Verification: 'Liên kết đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
};

export const SIGN_IN_ERROR_FALLBACK = 'Chưa đăng nhập được. Thử lại sau ít phút.';
export const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';

/** Giá trị của `reason` mà `createSignInRedirect` gắn vào đường dẫn. */
export const SESSION_EXPIRED_REASON = 'expired';

export function signInNotice(
  params: Record<string, string | string[] | undefined>,
): SignInNotice | null {
  const error = first(params.error);
  if (error) {
    return { tone: 'error', message: ERROR_MESSAGES[error] ?? SIGN_IN_ERROR_FALLBACK };
  }
  if (first(params.reason) === SESSION_EXPIRED_REASON) {
    return { tone: 'info', message: SESSION_EXPIRED_MESSAGE };
  }
  return null;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
