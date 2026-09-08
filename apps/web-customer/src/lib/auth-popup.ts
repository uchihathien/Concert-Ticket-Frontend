/** Tín hiệu popup gửi về cửa sổ cha khi luồng OIDC kết thúc. */
export const AUTH_POPUP_MESSAGE = 'nexaticket:auth-complete';

export type AuthMode = 'login' | 'register';

const POPUP_WIDTH = 480;
const POPUP_HEIGHT = 720;

/**
 * Mở popup đăng nhập.
 *
 * Trả `null` khi trình duyệt chặn popup — nơi gọi phải rơi về chuyển hướng cả trang, nếu không
 * người dùng bấm nút và không có gì xảy ra.
 *
 * Popup mở giữa **cửa sổ hiện tại**, không phải giữa màn hình chính: người dùng hai màn hình sẽ
 * phải đi tìm cửa sổ nếu tính sai.
 */
export function openAuthPopup(mode: AuthMode): Window | null {
  const screenLeft = window.screenLeft ?? window.screenX ?? 0;
  const screenTop = window.screenTop ?? window.screenY ?? 0;
  const width = window.outerWidth || window.innerWidth;
  const height = window.outerHeight || window.innerHeight;

  const left = Math.max(0, screenLeft + (width - POPUP_WIDTH) / 2);
  const top = Math.max(0, screenTop + (height - POPUP_HEIGHT) / 2);

  const popup = window.open(
    `/auth/start?mode=${mode}`,
    'nexaticket-auth',
    `popup=yes,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${Math.round(left)},top=${Math.round(top)}`,
  );

  return popup && !popup.closed ? popup : null;
}

/**
 * Đường dự phòng khi popup bị chặn: chạy đúng luồng OIDC đó nhưng trên cả trang.
 *
 * Truyền `returnTo` để sau khi xong người dùng về đúng chỗ đang đứng — không có nó thì họ hạ
 * cánh xuống trang "đang đóng cửa sổ" vốn chỉ dành cho popup.
 */
export function redirectToAuth(mode: AuthMode, returnUrl: string): void {
  const params = new URLSearchParams({ mode, returnTo: returnUrl });
  window.location.href = `/auth/start?${params.toString()}`;
}
