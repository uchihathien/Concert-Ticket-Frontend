/**
 * Đăng nhập qua nhà cung cấp ngoài, đi vòng qua Keycloak.
 *
 * Google được khai làm **identity provider trong Keycloak**, không phải provider riêng của
 * Auth.js. Khác biệt này quan trọng:
 *
 * - Chỉ có MỘT nguồn chân lý về danh tính. Người dùng đăng nhập Google hôm nay và đăng nhập mật
 *   khẩu ngày mai vẫn là cùng một tài khoản, cùng một `sub` — backend đã tạo bản ghi theo `sub`
 *   nên không phải làm gì thêm.
 * - Thêm nhà cung cấp thứ hai (Facebook, Apple) sau này là việc cấu hình Keycloak, không phải
 *   sửa code của bốn app.
 * - Client OIDC, callback URL và luồng đổi token giữ nguyên. Chỉ thêm một tham số vào URL uỷ
 *   quyền để Keycloak bỏ qua trang đăng nhập của nó và đi thẳng sang Google.
 */

/** Alias của identity provider trong realm Keycloak. */
export const IDP_GOOGLE = 'google';

/**
 * Tham số bảo Keycloak chuyển thẳng sang một identity provider.
 *
 * Truyền làm đối số thứ BA của `signIn()`: `signIn(provider, options, authorizationParams)`.
 * Đặt nhầm vào đối số thứ hai thì nó bị coi là tuỳ chọn của Auth.js, bị bỏ qua lặng lẽ, và người
 * dùng rơi vào trang đăng nhập mật khẩu của Keycloak thay vì sang Google.
 */
export function idpHint(alias: string): Record<string, string> {
  return { kc_idp_hint: alias };
}
