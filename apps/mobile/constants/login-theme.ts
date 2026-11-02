/**
 * Màu và kích thước cho các màn đăng nhập của app.
 *
 * Khớp từng giá trị với theme Keycloak `nexaticket-lime`
 * (deploy/keycloak/themes/nexaticket-lime/login/resources/css/nexaticket-lime.css) — trang mà app
 * mở trong trình duyệt khi bấm "Đăng nhập". Màn hình của app và trang Keycloak nối tiếp nhau trong
 * vài giây, nên chúng phải cùng nền, cùng nút, cùng ô nhập; lệch một màu là người dùng thấy "nhảy".
 *
 * Không có màu mới ở đây: mọi giá trị là màu app đang dùng sẵn ở các màn khác (#111713, #19221B,
 * #D5FF66…). Đổi màu thì đổi cả file CSS của theme cho khớp.
 */
export const loginTheme = {
  /** Nền màn đăng nhập = `--nt-surface`: trên điện thoại trang Keycloak dùng đúng màu thẻ làm nền. */
  screen: '#19221B',
  /** Nền ô nhập, ô thông báo = `--nt-input-bg`. */
  inset: '#111713',
  border: '#2C3A30',
  inputBorder: '#3B493F',
  text: '#F1F5F1',
  muted: '#A6B1A8',
  placeholder: '#6F7B72',
  primary: '#D5FF66',
  primaryInk: '#17210D',
  danger: '#FF8C79',
  /** `--nt-radius`: ô nhập, nút, ô thông báo. */
  radius: 10,
  /** Nút chính = nút `size="lg"` của web và `#kc-login` của theme. */
  buttonHeight: 52,
  buttonFont: 17,
  /** Ô nhập ≥ 48px, chữ 16px — cùng mức với theme. */
  inputHeight: 52,
  inputFont: 16,
  /** Tiêu đề = `#kc-page-title`. */
  titleFont: 26,
  /** Logo lockup chữ sáng 408×128 — cao 36 như trên trang Keycloak. */
  logoHeight: 36,
  logoWidth: Math.round((36 * 408) / 128),
} as const;

/** Lấy từ @nexaticket/brand — một nguồn logo cho cả web, app và theme Keycloak (xem README của gói). */
export { default as brandLogo } from '@nexaticket/brand/logo-dark.png';
