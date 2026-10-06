'use client';

import { staleTime, useApiClient } from '@nexaticket/ts-sdk';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Trần mua vé mặc định của tổ chức — identity-service, `OrganizationController`.
 *
 * - `GET /v1/organizations/{org}/purchase-limits` → `PurchaseLimits`
 * - `PUT /v1/organizations/{org}/purchase-limits` (body cùng hình dạng) → `PurchaseLimits`
 *
 * Cả hai cần `ORG_LIMITS_SET` (kể cả đọc). Mỗi trường `null` nghĩa là **kế thừa trần nền tảng**,
 * không phải "không giới hạn"; backend không nhận 0. `PUT` thay cả bộ: bỏ trống một ô là xoá trần
 * đó về mặc định.
 *
 * Chuỗi kế thừa: suất diễn → tổ chức → nền tảng, giải một lần lúc publish. Đổi trần ở đây không
 * ảnh hưởng suất đã lên bán.
 *
 * Đặt ở app vì `@nexaticket/ts-sdk` chưa bọc endpoint này; vẫn đi qua `ApiClient` chuẩn.
 */
export interface PurchaseLimits {
  maxSeatedPerHold: number | null;
  maxStandingPerHold: number | null;
  maxUnitsPerHold: number | null;
  maxTicketsPerCustomer: number | null;
}

const path = (organizationId: string) => `/v1/organizations/${organizationId}/purchase-limits`;
const key = (organizationId: string) =>
  ['identity', 'organizations', organizationId, 'purchase-limits'] as const;

export function usePurchaseLimits(organizationId: string | null) {
  const client = useApiClient();
  return useQuery({
    queryKey: key(organizationId ?? ''),
    queryFn: async () => (await client.get<PurchaseLimits>(path(organizationId as string))).data,
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function useSetPurchaseLimits(organizationId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (limits: PurchaseLimits) =>
      (await client.put<PurchaseLimits>(path(organizationId), limits)).data,
    onSuccess: (limits) => {
      queryClient.setQueryData(key(organizationId), limits);
    },
  });
}
