/**
 * Đường tới màn hình "quên mật khẩu" của Keycloak.
 *
 * <h3>Vì sao không tự dựng màn hình này</h3>
 *
 * Hệ thống không lưu mật khẩu (ADR-0016). Tự làm nghĩa là dựng bảng token đặt lại, tự chống dò, tự
 * hết hạn, tự chống dùng lại — rồi cuối cùng vẫn phải nhờ Keycloak ghi mật khẩu mới. Toàn bộ phần
 * đó Keycloak đã có sẵn và đã được kiểm chứng.
 *
 * Quan trọng hơn: người dùng gõ mật khẩu mới trên **đúng tên miền** mà họ vẫn đăng nhập, với thanh
 * địa chỉ nhìn thấy được. Đó là thứ duy nhất giúp họ phân biệt trang thật với trang giả, và một
 * form mật khẩu dựng trong app của ta thì phá mất nó — cùng lý do `SignInScreen` không có ô mật
 * khẩu.
 *
 * <h3>Vì sao vẫn cần liên kết này, khi trang đăng nhập của Keycloak đã có sẵn nút đó</h3>
 *
 * Vì người quên mật khẩu chưa chắc đã bấm "Đăng nhập" trước. Họ vào trang, nhớ ra mình quên, và
 * tìm chữ "Quên mật khẩu?" ngay tại chỗ. Bắt họ bấm "Đăng nhập" rồi mới thấy nút cần tìm là thêm
 * một bước cho đúng người đang bối rối nhất.
 */

/**
 * @param issuer gốc realm, ví dụ `http://localhost:8081/realms/nexaticket`
 * @param clientId client của app đang gọi — Keycloak dùng nó để biết quay về đâu và hiện giao diện
 *   nào. **Bắt buộc**: thiếu nó Keycloak trả về trang lỗi thay vì form đặt lại mật khẩu.
 */
export function resetPasswordUrl(issuer: string, clientId: string): string {
  const base = issuer.replace(/\/$/, '');
  return `${base}/login-actions/reset-credentials?client_id=${encodeURIComponent(clientId)}`;
}

/**
 * Bản đọc cấu hình từ biến môi trường, dùng được trong Server Component.
 *
 * Trả `null` khi thiếu biến, thay vì ném lỗi: thiếu một liên kết phụ không đáng làm trắng cả trang
 * đăng nhập — thứ mà người dùng đang cần để vào hệ thống. Liên kết biến mất, mọi thứ còn lại chạy.
 */
export function resetPasswordUrlFromEnv(app: string): string | null {
  const issuer = process.env.KEYCLOAK_ISSUER;
  const clientId = process.env.KEYCLOAK_CLIENT_ID ?? app;
  if (!issuer || !clientId) return null;
  return resetPasswordUrl(issuer, clientId);
}
