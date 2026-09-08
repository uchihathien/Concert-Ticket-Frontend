'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSeatMap, placeHold, releaseHold, type SeatMapSnapshot } from '../api/inventory';
import { queryKeys, staleTime } from '../query/keys';
import { useApiClient } from '../query/provider';
import type { HoldCreated, PlaceHoldRequest } from '../types/inventory';

export interface UseSeatMapOptions {
  enabled?: boolean;
}

/**
 * Sơ đồ chỗ của một suất diễn.
 *
 * `staleTime: 0` là cố ý: tồn kho ghế cũ vài giây là bán trùng. Nguồn cập nhật chính là delta
 * WebSocket; `GET` dùng để khởi tạo và để đồng bộ lại khi lệch version.
 *
 * Snapshot giữ kèm ETag, nên lần refetch sau phần lớn kết thúc bằng 304 body rỗng thay vì kéo lại
 * 400KB. ETag phía backend phụ thuộc cả người xem (hạn mức mua riêng từng khách), nên cache này
 * không được chia sẻ giữa hai phiên đăng nhập — đổi người dùng phải xoá cache.
 */
export function useSeatMap(
  eventSessionId: string | null | undefined,
  options: UseSeatMapOptions = {},
) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.inventory.seatMap(eventSessionId ?? '');

  return useQuery({
    queryKey,
    queryFn: () => {
      const previous = queryClient.getQueryData<SeatMapSnapshot>(queryKey) ?? null;
      return fetchSeatMap(client, eventSessionId as string, previous);
    },
    enabled: Boolean(eventSessionId) && options.enabled !== false,
    staleTime: staleTime.SEAT_MAP,
  });
}

export interface PlaceHoldInput extends PlaceHoldRequest {
  /**
   * Sinh khi người dùng bấm nút, dùng lại nguyên vẹn ở mọi lần thử lại của cùng lựa chọn đó.
   * Xem `useIdempotencyKey`.
   */
  idempotencyKey: string;
}

/**
 * Giữ chỗ.
 *
 * Sau khi giữ xong phải làm mới sơ đồ: `availabilityVersion` trong response đã nhảy, và những ghế
 * vừa giữ giờ mang trạng thái `HELD`. Không invalidate thì khách bấm tiếp vào ghế mình vừa giữ.
 */
export function usePlaceHold(eventSessionId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<HoldCreated, Error, PlaceHoldInput>({
    mutationFn: ({ idempotencyKey, ...request }) =>
      placeHold(client, eventSessionId, request, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.seatMap(eventSessionId),
      });
    },
  });
}

export function useReleaseHold(eventSessionId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (holdId: string) => releaseHold(client, holdId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.seatMap(eventSessionId),
      });
    },
  });
}
