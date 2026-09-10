import { createNexaAuth } from '@nexaticket/auth';
import { redisRefreshTokenStoreFromEnv } from '@nexaticket/auth/redis-node';

import { authOptions } from './auth.edge';

/**
 * Auth.js cho web-platform.
 *
 * Client Keycloak riêng của app này (plan/frontend.md §4). Secret đọc từ biến môi trường của
 * chính tiến trình app — bốn app chạy bốn tiến trình nên dùng chung tên biến là an toàn.
 */
export const nexaAuth = createNexaAuth({
  ...authOptions,
  // Chỉ bản Node mới có store: xem `auth.edge.ts`.
  refreshTokenStore: redisRefreshTokenStoreFromEnv(),
});

export const { handlers, auth, signIn, signOut } = nexaAuth;
