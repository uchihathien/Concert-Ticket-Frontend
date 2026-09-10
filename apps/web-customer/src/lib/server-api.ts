import { createApiClient, listPublicEvents } from '@nexaticket/ts-sdk';

/**
 * Client gọi API từ **phía server**, dùng cho các trang công khai.
 *
 * Ba lý do không gọi những endpoint này từ trình duyệt:
 *
 * 1. Trang chủ, danh sách và chi tiết sự kiện cần HTML đầy đủ cho SEO — đây là những trang khách
 *    vào từ Google và từ link chia sẻ.
 * 2. Không vướng CORS. Gateway hiện chưa khai `Access-Control-*` nào, nên request từ trình duyệt
 *    sang cổng 8080 bị chặn ngay ở preflight.
 * 3. Catalog công khai không cần token, nên chẳng có gì phải đưa xuống client.
 *
 * `API_BASE_URL` tách khỏi `NEXT_PUBLIC_API_BASE_URL` vì hai bên đứng ở hai chỗ khác nhau: tiến
 * trình Next thường gọi được địa chỉ nội bộ mà trình duyệt không thấy.
 */
export const serverApi = createApiClient({
  baseUrl:
    process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080',
});

/**
 * Danh sách thành phố cho bộ lọc ở header.
 *
 * `GET /v1/events` trả kèm `cities` nên xin đúng một bản ghi là đủ — không có endpoint riêng cho
 * việc này.
 *
 * Nuốt lỗi và trả mảng rỗng là có chủ đích: header nằm trong layout của *mọi* trang công khai,
 * nên để lỗi mạng nổi lên đây đồng nghĩa với việc catalog chết thì cả trang điều khoản, trang hỗ
 * trợ cũng trắng theo. Không có thành phố thì bộ chọn tự ẩn, phần còn lại của site vẫn chạy.
 */
export async function loadCities(): Promise<string[]> {
  try {
    const page = await listPublicEvents(serverApi, { size: 1 });
    return page.cities;
  } catch {
    return [];
  }
}
