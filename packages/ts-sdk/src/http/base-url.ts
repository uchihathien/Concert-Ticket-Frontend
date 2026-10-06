/**
 * Quyết định `baseUrl` của API client từ biến môi trường — một chỗ cho cả bốn app.
 *
 * <h2>Vì sao tồn tại</h2>
 *
 * Bốn app đều viết `process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080'`, và `??` chỉ
 * bắt `null`/`undefined` — **không** bắt chuỗi rỗng. CI của repo này truyền
 * `NEXT_PUBLIC_API_BASE_URL=${{ vars.PUBLIC_API_BASE_URL }}`; biến repo chưa khai thì Docker nhận
 * build-arg RỖNG, Next nhúng `""` vào bundle, và `baseUrl` thành chuỗi rỗng.
 *
 * Hậu quả đã xảy ra trên production và nó không để lại dấu vết nào dễ thấy: mọi lời gọi thành đường
 * TƯƠNG ĐỐI, rơi vào chính Next thay vì gateway. `GET /v1/sessions/{id}/seats` trả 404 HTML, rồi
 * middleware đẩy sang `/login?returnUrl=/v1/...` — nên trong tab Network người đọc thấy một 200 của
 * trang login và kết luận là lỗi đăng nhập. Không lỗi console, không response 4xx trong bảng, và
 * SeatPicker chỉ hiện "Có lỗi xảy ra, thử lại sau". Phải lái Chrome bằng CDP mới thấy.
 *
 * <h2>Vì sao rỗng ở production nghĩa là CÙNG GỐC</h2>
 *
 * Nginx của hệ phục vụ `/v1/` ngay trên bốn tên miền web (`deploy/nginx/nexaticket.conf`), nên đường
 * tương đối là một đích HỢP LỆ — và tốt hơn URL tuyệt đối: cùng gốc thì không có preflight CORS,
 * không có token đi qua tên miền thứ hai, và trình duyệt chặn cookie bên thứ ba cũng không ảnh hưởng.
 * Vậy "rỗng" không còn là lỗi cấu hình; nó là chế độ cùng gốc, và hàm này nói ra điều đó.
 *
 * Ở máy phát triển thì khác: không có nginx nào ở giữa, nên rỗng phải về gateway ở localhost.
 * `NODE_ENV` là thứ phân biệt hai hoàn cảnh, và Next nhúng nó vào bundle lúc build.
 */
export function resolveApiBaseUrl(
  raw: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string {
  const value = raw?.trim();
  if (value) {
    // Bỏ `/` cuối: ApiClient tự nối `/v1/...`, hai dấu gạch liền nhau làm gateway trả 404.
    return value.replace(/\/+$/, '');
  }
  return nodeEnv === 'production' ? '' : 'http://localhost:8080';
}
