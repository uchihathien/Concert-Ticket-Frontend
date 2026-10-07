import { Redirect } from 'expo-router';

/**
 * Điểm quay về sau khi đăng nhập ở Keycloak. Màn hình này KHÔNG xử lý gì, nó chỉ cần TỒN TẠI.
 *
 * Redirect URI của app là `nexaticket-organizer://auth`. Khi Keycloak chuyển hướng về, Android mở app bằng intent
 * của scheme đó, và Expo Router nhìn phần đường dẫn `/auth` rồi đi tìm một route tên `auth`. Không có
 * tệp nào tên đó thì nó hiện "Unmatched Route — Page could not be found", một màn hình dành cho người
 * lập trình, ngay sau khi người dùng vừa nhập xong mật khẩu.
 *
 * Việc đổi mã lấy token KHÔNG diễn ra ở đây: `expo-auth-session` có bộ lắng nghe Linking riêng, độc lập
 * với router, bắt cùng URL đó và trả kết quả về `useAuthRequest`.
 */
export default function AuthReturnScreen() {
  return <Redirect href="/" />;
}
