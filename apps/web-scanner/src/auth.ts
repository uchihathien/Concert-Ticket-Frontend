import { createNexaAuth } from '@nexaticket/auth';

/**
 * Auth.js cho web-scanner.
 *
 * Client Keycloak riêng của app này (plan/frontend.md §4). Secret đọc từ biến môi trường của
 * chính tiến trình app — bốn app chạy bốn tiến trình nên dùng chung tên biến là an toàn.
 */
export const nexaAuth = createNexaAuth({
  app: 'web-scanner',
  signInPage: '/login',
});

export const { handlers, auth, signIn, signOut } = nexaAuth;
