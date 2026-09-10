'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchOrganizationSales } from '../api/analytics';
import { queryKeys, staleTime } from '../query/keys';
import { useApiClient } from '../query/provider';

/**
 * Doanh thu của một tổ chức.
 *
 * Xem cảnh báo vận hành ở `api/analytics.ts`: `analytics-service` chưa chạy và gateway chưa khai
 * route `/v1/admin/**`, nên hook này hiện trả lỗi 404 của gateway. Màn dùng nó phải phân biệt
 * được "chưa bật dịch vụ" với "tổ chức không có dữ liệu".
 */
export function useOrganizationSales(organizationId: string | null | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.analytics.organizationSales(organizationId ?? ''),
    queryFn: () => fetchOrganizationSales(client, organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}
