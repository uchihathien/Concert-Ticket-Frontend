import { Redirect } from 'expo-router';

/**
 * Điểm quay về sau khi đăng nhập ở Keycloak. Màn hình này KHÔNG xử lý gì, nó chỉ cần TỒN TẠI.
 *
 * ## Vì sao cần một tệp rỗng như thế này
 *
 * Redirect URI của app là `nexaticket-scanner://auth`. Khi Keycloak chuyển hướng về, Android mở app
 * bằng intent của scheme đó, và Expo Router nhìn phần đường dẫn `/auth` rồi đi tìm một route tên `auth`.
 * Không có tệp nào tên đó, nên nó hiện màn hình "Unmatched Route — Page could not be found" —
 * một màn hình dành cho người lập trình, giữa lúc người dùng vừa nhập xong mật khẩu.
 *
 * Việc đổi mã lấy token KHÔNG diễn ra ở đây. `expo-auth-session` có bộ lắng nghe Linking riêng, độc lập
 * với router: nó bắt cùng URL đó, trả kết quả về `useAuthRequest` trong `LoginButton`, và `LoginButton`
 * mới là nơi gọi `exchangeScannerCode`. `LoginButton` nằm trên màn hình `index`, và `Stack` giữ màn hình
 * phía dưới luôn được gắn, nên nó vẫn chạy trong lúc `auth` hiện ra chớp nhoáng rồi biến mất.
 *
 * Vì vậy ở đây chỉ cần đưa người dùng về `/` ngay. `Redirect` chuyển hướng lúc dựng cây, không chờ một
 * vòng hiệu ứng nào, nên không ai kịp nhìn thấy màn hình trắng.
 */
export default function AuthReturnScreen() {
  return <Redirect href="/" />;
}
