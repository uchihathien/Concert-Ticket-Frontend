'use client';

import { useApiClient } from '@nexaticket/ts-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Vô hiệu hoá / khôi phục tài khoản — identity-service, `PlatformUserController`.
 *
 * - `POST /v1/platform/users/{userId}/disable` body `{ reason }` → 204
 * - `POST /v1/platform/users/{userId}/enable`                    → 204
 *
 * Cần `PLATFORM_USER_MANAGE`. Cả hai idempotent (gọi khi đã ở trạng thái đích thì không đổi gì).
 * Vô hiệu hoá thu hồi luôn mọi phiên, không đụng tới Keycloak, và không cho tự khoá chính mình
 * (403). API không trả trạng thái hiện tại của tài khoản, nên giao diện không đoán.
 *
 * Đặt ở app vì `@nexaticket/ts-sdk` chưa bọc endpoint này; vẫn đi qua `ApiClient` chuẩn.
 */
export function useUserLifecycle() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input:
        | { userId: string; action: 'disable'; reason: string }
        | { userId: string; action: 'enable' },
    ) => {
      if (input.action === 'disable') {
        await client.post<null>(`/v1/platform/users/${input.userId}/disable`, {
          reason: input.reason,
        });
      } else {
        await client.post<null>(`/v1/platform/users/${input.userId}/enable`);
      }
    },
    onSuccess: () => {
      // Mỗi lệnh ghi một dòng nhật ký nền tảng.
      void queryClient.invalidateQueries({ queryKey: ['identity', 'platform'] });
    },
  });
}
