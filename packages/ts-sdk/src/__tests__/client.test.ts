// @vitest-environment node
//
// Môi trường node, không phải jsdom: jsdom không có fetch, nên fetch của undici sẽ nhận
// AbortSignal của jsdom và từ chối. Trình duyệt thật dùng chung một implementation nên không
// gặp chuyện này — đây là hạn chế của môi trường test, không phải của client.
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '../http/api-error';
import { createApiClient } from '../http/client';

const BASE_URL = 'http://gateway.test';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function client(getAccessToken?: () => string | null) {
  return createApiClient({ baseUrl: BASE_URL, getAccessToken });
}

describe('ApiClient', () => {
  it('gắn Bearer token khi đã đăng nhập', async () => {
    let seen: string | null = null;
    server.use(
      http.get(`${BASE_URL}/v1/me/organizations`, ({ request }) => {
        seen = request.headers.get('Authorization');
        return HttpResponse.json([]);
      }),
    );

    await client(() => 'tok-123').get('/v1/me/organizations');
    expect(seen).toBe('Bearer tok-123');
  });

  it('khách vãng lai không gửi Authorization — sơ đồ chỗ vẫn xem được', async () => {
    let seen: string | null = 'chưa gọi';
    server.use(
      http.get(`${BASE_URL}/v1/sessions/s1/seats`, ({ request }) => {
        seen = request.headers.get('Authorization');
        return HttpResponse.json({ seats: [] });
      }),
    );

    await client(() => null).get('/v1/sessions/s1/seats');
    expect(seen).toBeNull();
  });

  it('gửi Idempotency-Key khi được cấp', async () => {
    let seen: string | null = null;
    server.use(
      http.post(`${BASE_URL}/v1/sessions/s1/holds`, ({ request }) => {
        seen = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ holdId: 'h1' }, { status: 201 });
      }),
    );

    await client().post('/v1/sessions/s1/holds', { seatIds: [] }, { idempotencyKey: 'key-1' });
    expect(seen).toBe('key-1');
  });

  it('dựng ApiError từ body RFC 7807, giữ code / meta / correlationId', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/sessions/s1/holds`, () =>
        HttpResponse.json(
          {
            type: 'https://nexaticket.vn/errors/seat-unavailable',
            title: 'seat unavailable',
            status: 409,
            code: 'SEAT_UNAVAILABLE',
            detail: 'Seat already held',
            correlationId: 'corr-9',
            meta: { seatIds: ['a'] },
          },
          { status: 409 },
        ),
      ),
    );

    const error = await client()
      .post('/v1/sessions/s1/holds', {})
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.code).toBe('SEAT_UNAVAILABLE');
    expect(apiError.status).toBe(409);
    expect(apiError.correlationId).toBe('corr-9');
    expect(apiError.meta).toEqual({ seatIds: ['a'] });
    expect(apiError.isClientError).toBe(true);
  });

  it('body không phải JSON (trang lỗi của hạ tầng) vẫn thành ApiError đọc được', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/me/organizations`, () =>
        HttpResponse.text('<html>502 Bad Gateway</html>', { status: 502 }),
      ),
    );

    const error = (await client()
      .get('/v1/me/organizations')
      .catch((cause: unknown) => cause)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.status).toBe(502);
  });

  it('lấy correlationId từ header khi body không có', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/me/organizations`, () =>
        HttpResponse.json(
          { code: 'FORBIDDEN' },
          { status: 403, headers: { 'X-Correlation-Id': 'h-1' } },
        ),
      ),
    );

    const error = (await client()
      .get('/v1/me/organizations')
      .catch((cause: unknown) => cause)) as ApiError;

    expect(error.correlationId).toBe('h-1');
  });

  it('204 trả về null chứ không nổ khi parse JSON', async () => {
    server.use(
      http.delete(`${BASE_URL}/v1/holds/h1`, () => new HttpResponse(null, { status: 204 })),
    );

    const response = await client().delete('/v1/holds/h1');
    expect(response.data).toBeNull();
    expect(response.status).toBe(204);
  });

  it('mất mạng thành ApiError NETWORK_ERROR, không phải TypeError trần', async () => {
    server.use(http.get(`${BASE_URL}/v1/me/organizations`, () => HttpResponse.error()));

    const error = (await client()
      .get('/v1/me/organizations')
      .catch((cause: unknown) => cause)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.status).toBe(0);
  });
});
