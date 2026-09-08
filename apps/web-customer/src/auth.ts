import { createNexaAuth } from '@nexaticket/auth';

/**
 * Auth.js cho web-customer.
 *
 * Client Keycloak riêng của app này (plan/frontend.md §4). Secret đọc từ biến môi trường của
 * chính tiến trình app — bốn app chạy bốn tiến trình nên dùng chung tên biến là an toàn.
 */
export const nexaAuth = createNexaAuth({
  app: 'web-customer',
  signInPage: '/login',
  // Chỉ app khách mới có đăng ký tự phục vụ; ba app còn lại tài khoản do người khác cấp.
  registration: true,
});

export const { handlers, auth, signIn, signOut } = nexaAuth;
