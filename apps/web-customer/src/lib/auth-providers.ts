/**
 * Có hiện nút "Tiếp tục với Google" hay không.
 *
 * Đọc biến môi trường phía server, KHÔNG phải `NEXT_PUBLIC_`: đây là quyết định hiển thị, không
 * phải dữ liệu client cần tự suy ra, và trang đăng nhập vốn đã là server component.
 *
 * Vì sao cần cờ riêng thay vì cứ hiện nút: nút chỉ chạy được khi realm Keycloak đã khai identity
 * provider `google` với client ID và secret thật của Google Cloud. Chưa khai mà vẫn hiện nút thì
 * người dùng bấm vào và nhận trang lỗi của Keycloak — tệ hơn hẳn so với không thấy nút. Mặc định
 * TẮT để môi trường dev sạch chạy được ngay mà không cần tài khoản Google Cloud.
 *
 * Lưu ý về trang tĩnh: header xuất hiện trên cả trang chủ và các trang chữ, vốn được prerender.
 * Ở những trang đó giá trị này bị "đóng băng" lúc build, nên đổi biến môi trường phải build lại.
 * Đúng như mong muốn — bật/tắt Google là việc của một lần triển khai, không phải cờ đổi lúc chạy.
 *
 * Xem `scripts/setup-google-idp.sh` để khai provider ở phía Keycloak.
 */
export function googleSignInEnabled(): boolean {
  return process.env.AUTH_GOOGLE_ENABLED === 'true';
}
