'use client';

import { useQuery } from '@tanstack/react-query';
import { getPublicFloorPlan, getVenueFloorPlan } from '../api/floor-plan';
import { queryKeys, staleTime } from '../query/keys';
import { useApiClient } from '../query/provider';

/**
 * Mặt bằng của một sự kiện đang bán.
 *
 * `staleTime` dài — ngược hẳn với `useSeatMap`. Hai thứ này đi cùng nhau trên một màn hình nhưng
 * đổi theo hai nhịp khác nhau: trạng thái ghế đổi từng giây lúc mở bán, còn hình dạng khán phòng
 * thì đổi khi ban tổ chức rút sự kiện xuống và publish lại. Cho cả hai cùng `staleTime: 0` là kéo
 * lại hình học không đổi ở mỗi lần ghế đổi.
 */
export function usePublicFloorPlan(slug: string | null | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.catalog.publicFloorPlan(slug ?? ''),
    queryFn: () => getPublicFloorPlan(client, slug as string),
    enabled: Boolean(slug),
    staleTime: staleTime.FLOOR_PLAN,
  });
}

/** Bản xem trước của ban tổ chức: có ghế, dùng được cả khi sự kiện còn nháp. */
export function useVenueFloorPlan(
  organizationId: string | null | undefined,
  venueId: string | null | undefined,
) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.catalog.venueFloorPlan(organizationId ?? '', venueId ?? ''),
    queryFn: () => getVenueFloorPlan(client, organizationId as string, venueId as string),
    enabled: Boolean(organizationId) && Boolean(venueId),
    staleTime: staleTime.FLOOR_PLAN,
  });
}
