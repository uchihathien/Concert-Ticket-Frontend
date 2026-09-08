// @vitest-environment node
//
// Môi trường node, không phải jsdom: jsdom không có fetch, nên fetch của undici sẽ nhận
// AbortSignal của jsdom và từ chối. Trình duyệt thật dùng chung một implementation nên không
// gặp chuyện này — đây là hạn chế của môi trường test, không phải của client.
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fetchSeatMap, placeHold } from '../api/inventory';
import { createApiClient } from '../http/client';
import type { SeatMap } from '../types/inventory';

const BASE_URL = 'http://gateway.test';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = createApiClient({ baseUrl: BASE_URL });

const seatMap: SeatMap = {
  eventSessionId: 's1',
  availabilityVersion: 7,
  seats: [
    {
      id: 'seat-1',
      seatCode: 'A-12-07',
      zoneCode: 'A',
      sectionLabel: 'Khán đài A',
      rowLabel: '12',
      seatLabel: '07',
      posX: 10,
      posY: 20,
      ticketTypeId: 'tt-1',
      ticketTypeName: 'VIP',
      priceVnd: 1_200_000,
      status: 'AVAILABLE',
    },
  ],
  standingZones: [
    {
      zoneCode: 'FLOOR',
      ticketTypeId: 'tt-2',
      ticketTypeName: 'Vé đứng',
      priceVnd: 500_000,
      available: 340,
      capacity: 2000,
    },
  ],
  purchaseAllowance: { limit: 8, used: 2, remaining: 6 },
};

describe('fetchSeatMap', () => {
  it('lần đầu lấy đủ dữ liệu và giữ lại ETag', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/sessions/s1/seats`, () =>
        HttpResponse.json(seatMap, { headers: { ETag: '"7-user-1"' } }),
      ),
    );

    const snapshot = await fetchSeatMap(client, 's1');
    expect(snapshot.etag).toBe('"7-user-1"');
    expect(snapshot.data.availabilityVersion).toBe(7);
  });

  it('gửi If-None-Match và dùng lại bản cũ khi backend trả 304', async () => {
    let sentIfNoneMatch: string | null = null;
    server.use(
      http.get(`${BASE_URL}/v1/sessions/s1/seats`, ({ request }) => {
        sentIfNoneMatch = request.headers.get('If-None-Match');
        return new HttpResponse(null, { status: 304, headers: { ETag: '"7-user-1"' } });
      }),
    );

    const snapshot = await fetchSeatMap(client, 's1', { data: seatMap, etag: '"7-user-1"' });

    expect(sentIfNoneMatch).toBe('"7-user-1"');
    // Body rỗng nhưng người dùng vẫn phải thấy sơ đồ — dữ liệu lấy từ bản đang giữ.
    expect(snapshot.data).toEqual(seatMap);
  });

  it('304 mà không có bản sao nào thì hỏi lại, lần này không kèm ETag', async () => {
    const seen: Array<string | null> = [];
    server.use(
      http.get(`${BASE_URL}/v1/sessions/s1/seats`, ({ request }) => {
        seen.push(request.headers.get('If-None-Match'));
        return seen.length === 1
          ? new HttpResponse(null, { status: 304 })
          : HttpResponse.json(seatMap, { headers: { ETag: '"7-user-1"' } });
      }),
    );

    // Không có bản sao nào để dùng lại, nên 304 ở đây là cache trung gian trả nhầm.
    const snapshot = await fetchSeatMap(client, 's1');

    expect(seen).toEqual([null, null]);
    expect(snapshot.data).toEqual(seatMap);
  });
});

describe('placeHold', () => {
  it('gửi mảng rỗng thay vì bỏ trống, và kèm Idempotency-Key', async () => {
    let body: unknown = null;
    let key: string | null = null;

    server.use(
      http.post(`${BASE_URL}/v1/sessions/s1/holds`, async ({ request }) => {
        key = request.headers.get('Idempotency-Key');
        body = await request.json();
        return HttpResponse.json(
          {
            holdId: 'h1',
            expiresAt: '2026-11-01T12:05:00Z',
            seatIds: ['seat-1'],
            availabilityVersion: 8,
          },
          { status: 201 },
        );
      }),
    );

    const hold = await placeHold(client, 's1', { seatIds: ['seat-1'] }, 'key-1');

    expect(key).toBe('key-1');
    expect(body).toEqual({ seatIds: ['seat-1'], standing: [] });
    expect(hold.expiresAt).toBe('2026-11-01T12:05:00Z');
  });
});
