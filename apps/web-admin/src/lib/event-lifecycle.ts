'use client';

import { queryKeys, useApiClient, type AdminEventDetail } from '@nexaticket/ts-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Ba lệnh vòng đời sự kiện mà backend có nhưng `@nexaticket/ts-sdk` chưa bọc.
 *
 * Đặt ở app chứ không ở SDK vì SDK là gói dùng chung đang có người khác sửa. Vẫn đi qua `ApiClient`
 * chuẩn (`useApiClient`) — cùng token, cùng xử lý lỗi, cùng chuyển hướng khi mất phiên.
 *
 * Hợp đồng lấy từ `AdminCatalogController` (catalog-service), cả ba cần `CATALOG_MANAGE`:
 *
 * - `POST   /v1/organizations/{org}/events/{id}/cancel`           → `AdminEventDetail`
 *   Trạng thái cuối. Không xoá tồn kho, vé hay thanh toán; hoàn tiền là quy trình ngoài hệ thống.
 * - `DELETE /v1/organizations/{org}/events/{id}`                  → 204
 *   Chỉ bản nháp chưa từng lên bán (`DRAFT`).
 * - `POST   /v1/organizations/{org}/events/{id}/resync-inventory` → `{ sessions: number }`
 *   Chỉ sự kiện đang bán; gửi lại hình học ghế sang inventory, không đổi trạng thái bán.
 *
 * Nếu sau này SDK bọc các endpoint này thì xoá file này và dùng hook của SDK.
 */

const eventPath = (organizationId: string, eventId: string) =>
  `/v1/organizations/${organizationId}/events/${eventId}`;

export interface ResyncResult {
  /** Số suất diễn đã gửi lại sang inventory. */
  sessions: number;
}

export function useCancelEvent(organizationId: string, eventId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await client.post<AdminEventDetail>(
        `${eventPath(organizationId, eventId)}/cancel`,
      );
      return response.data;
    },
    onSuccess: (event) => {
      queryClient.setQueryData(queryKeys.catalog.event(organizationId, eventId), event);
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.events(organizationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.dashboard(organizationId) });
    },
  });
}

export function useDeleteDraftEvent(organizationId: string, eventId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await client.delete<null>(eventPath(organizationId, eventId));
    },
    // Không `removeQueries` chi tiết sự kiện ở đây: trang chi tiết vẫn đang mở và sẽ hỏi lại ngay,
    // nhận 404 và chớp một khối lỗi trước khi kịp chuyển về danh sách.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.events(organizationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.dashboard(organizationId) });
    },
  });
}

export function useResyncInventory(organizationId: string, eventId: string) {
  const client = useApiClient();

  return useMutation({
    mutationFn: async () => {
      const response = await client.post<ResyncResult>(
        `${eventPath(organizationId, eventId)}/resync-inventory`,
      );
      return response.data;
    },
  });
}
