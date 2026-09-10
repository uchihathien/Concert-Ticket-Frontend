import { getAccessToken, markSessionExpired } from '@nexaticket/auth/client';
import { createApiClient } from '@nexaticket/ts-sdk';

/**
 * Client gọi api-gateway.
 *
 * Token lấy qua `getAccessToken` của `@nexaticket/auth/client` — bộ nhớ tiến trình của tab,
 * không phải storage của trình duyệt.
 *
 * `onUnauthenticated` chỉ **xoá phiên**, KHÔNG chuyển hướng — khác ba app quản trị.
 *
 * Phần lớn app khách là công khai: một người đang xem danh sách sự kiện mà bị đá sang trang đăng
 * nhập chỉ vì một lời gọi cần quyền trả 401 là phản ứng thái quá. Xoá phiên là đủ để
 * `useSessionState` chuyển sang `anonymous`, và header tự đổi nút "Tài khoản" thành "Đăng nhập" —
 * người dùng bấm khi họ cần, ở đúng lúc họ cần.
 */
export const apiClient = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080',
  getAccessToken,
  onUnauthenticated: markSessionExpired,
});
