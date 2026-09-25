'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  configureVenueZones,
  getSeatMapImages,
  previewFloorPlan,
  setEventSeatMapImage,
  setVenueSeatMapImage,
} from '../api/seating';
import { queryKeys, staleTime } from '../query/keys';
import { useApiClient } from '../query/provider';
import type { ConfigureZonesRequest } from '../types/seating';

/**
 * Lưu sơ đồ.
 *
 * Làm mới cả danh sách địa điểm lẫn mặt bằng đã lưu: sức chứa của địa điểm đổi theo, và bản xem
 * trước trong trình sửa phải thôi là "bản nháp" sau khi lưu xong.
 */
export function useConfigureVenueZones(organizationId: string, venueId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ConfigureZonesRequest) =>
      configureVenueZones(client, organizationId, venueId, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.venues(organizationId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.catalog.venueFloorPlan(organizationId, venueId),
      });
    },
  });
}

/**
 * Mặt bằng của một bản nháp.
 *
 * `enabled` để nơi dùng tắt hẳn khi bản nháp chưa hợp lệ — gửi một khu cung thiếu bán kính chỉ
 * nhận về 422, và một dòng lỗi đỏ nhấp nháy theo từng phím gõ là thứ không ai đọc.
 *
 * Khoá truy vấn chứa cả bản nháp, nên hai bản nháp khác nhau là hai mục cache khác nhau — kéo một
 * khu rồi kéo ngược lại sẽ lấy từ cache thay vì gọi mạng lần nữa.
 */
export function useFloorPlanPreview(
  organizationId: string,
  venueId: string,
  draft: ConfigureZonesRequest,
  options: { enabled?: boolean } = {},
) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.catalog.floorPlanPreview(organizationId, venueId, draft),
    queryFn: () => previewFloorPlan(client, organizationId, venueId, draft),
    enabled: options.enabled !== false && draft.zones.length > 0,
    // Bản nháp là đầu vào thuần: cùng một bản nháp luôn cho cùng một mặt bằng, nên không có lý do
    // hỏi lại.
    staleTime: staleTime.FLOOR_PLAN,
  });
}

export function useSeatMapImages(organizationId: string, eventId: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.catalog.seatMapImages(organizationId, eventId),
    queryFn: () => getSeatMapImages(client, organizationId, eventId),
    enabled: Boolean(organizationId && eventId),
  });
}

/**
 * Đặt hoặc gỡ ảnh sơ đồ.
 *
 * Một hook cho cả hai cấp, phân biệt bằng `scope`: hai hook riêng sẽ khiến màn hình phải nhớ gọi
 * đúng cái — trong khi thứ duy nhất khác nhau giữa chúng là một đoạn đường dẫn, và **phần làm mới
 * cache thì giống hệt**: đổi ảnh ở cấp nào cũng có thể đổi tấm đang hiển thị.
 */
export function useSetSeatMapImage(organizationId: string, eventId: string, venueId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scope, imageUrl }: { scope: 'event' | 'venue'; imageUrl: string }) =>
      scope === 'event'
        ? setEventSeatMapImage(client, organizationId, eventId, imageUrl)
        : setVenueSeatMapImage(client, organizationId, venueId, imageUrl),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.catalog.seatMapImages(organizationId, eventId),
      });
    },
  });
}
