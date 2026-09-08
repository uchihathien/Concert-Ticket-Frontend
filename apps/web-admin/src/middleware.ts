import { createAuthMiddleware } from '@nexaticket/auth/middleware';
import { nexaAuth } from '@/auth';

/**
 * Chỉ chặn ở mức "đã đăng nhập hay chưa".
 *
 * Quyền theo tổ chức do backend quyết định (TenantFilter trả 404 nếu không phải thành viên).
 * Kiểm lại ở middleware là tạo điểm tin cậy thứ hai, sớm muộn cũng lệch với điểm thật.
 */
export default createAuthMiddleware(nexaAuth, {
  publicPaths: ['/login'],
  signInPath: '/login',
});

export const config = {
  // Bỏ qua tài nguyên tĩnh và chính các route của Auth.js.
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)',
  ],
};
