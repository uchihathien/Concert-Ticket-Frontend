import { createEdgeAuth } from '@nexaticket/auth/edge';

/**
 * Tuỳ chọn dùng chung cho CẢ hai bản auth của app này — nguồn duy nhất.
 *
 * Tên app quyết định tên cookie phiên (`cookies.ts`). Khai ở hai chỗ rồi lệch nhau thì middleware
 * đi tìm một cookie không tồn tại: mọi đường đều bị đá về trang đăng nhập, và đăng nhập xong lại
 * bị đá tiếp. Nên nó nằm đúng một chỗ.
 */
export const authOptions = {
  app: 'web-customer' as const,
  signInPage: '/login',
  // Chỉ app khách mới có đăng ký tự phục vụ; ba app còn lại tài khoản do người khác cấp.
  registration: true,
};

/**
 * Bản dùng cho `middleware.ts`, chạy trong **Edge runtime** — KHÔNG mang store phiên.
 *
 * `src/auth.ts` import store Redis, và store đó kéo theo `ioredis`, vốn cần `node:*`. Chỉ cần
 * middleware import `src/auth.ts` là webpack kéo cả cụm đó vào bundle Edge và `next build` hỏng.
 * Xem `createEdgeAuth` để biết vì sao bỏ store đi là đúng chứ không phải né tránh.
 */
export const nexaAuthEdge = createEdgeAuth(authOptions);
