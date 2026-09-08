import type { ApiClient } from '../http/client';
import type { HoldCreated, PlaceHoldRequest, SeatMap } from '../types/inventory';

/** Sơ đồ chỗ kèm ETag, để lần gọi sau kết thúc bằng 304 với body rỗng. */
export interface SeatMapSnapshot {
  data: SeatMap;
  etag: string | null;
}

/**
 * `GET /v1/sessions/{id}/seats` — endpoint bị gọi nhiều nhất hệ thống.
 *
 * Truyền `previous` để gửi `If-None-Match`: suất 3.000 ghế nặng ~400KB, và phần lớn lần gọi lại
 * chỉ để kiểm tra xem có gì đổi không. ETag của backend phụ thuộc cả người xem (hạn mức mua khác
 * nhau theo từng khách), nên không được chia sẻ snapshot giữa hai phiên đăng nhập.
 */
export async function fetchSeatMap(
  client: ApiClient,
  eventSessionId: string,
  previous?: SeatMapSnapshot | null,
): Promise<SeatMapSnapshot> {
  const response = await client.get<SeatMap>(`/v1/sessions/${eventSessionId}/seats`, {
    etag: previous?.etag ?? null,
  });

  if (response.notModified) {
    if (previous) return { data: previous.data, etag: response.etag ?? previous.etag };
    // 304 mà không có bản sao nào: cache trung gian trả nhầm. Hỏi lại, lần này không kèm ETag.
    const retry = await client.get<SeatMap>(`/v1/sessions/${eventSessionId}/seats`);
    return { data: retry.data, etag: retry.etag };
  }

  return { data: response.data, etag: response.etag };
}

/**
 * Giữ chỗ. `Idempotency-Key` là bắt buộc — starter-idempotency chặn request thiếu khoá trước khi
 * vào controller, và thiếu nó thì bấm hai lần trên mạng chập chờn sẽ giữ hai lần.
 */
export async function placeHold(
  client: ApiClient,
  eventSessionId: string,
  request: PlaceHoldRequest,
  idempotencyKey: string,
): Promise<HoldCreated> {
  const response = await client.post<HoldCreated>(
    `/v1/sessions/${eventSessionId}/holds`,
    {
      seatIds: request.seatIds ?? [],
      standing: request.standing ?? [],
    },
    { idempotencyKey },
  );
  return response.data;
}

/** Nhả chỗ. Backend trả 204. Giữ chỗ của người khác cũng trả HOLD_NOT_FOUND, không phải 403. */
export async function releaseHold(client: ApiClient, holdId: string): Promise<void> {
  await client.delete<null>(`/v1/holds/${holdId}`);
}
