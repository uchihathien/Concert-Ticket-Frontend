// @vitest-environment node
//
// Môi trường node, không phải jsdom: jsdom không có fetch, nên fetch của undici sẽ nhận
// AbortSignal của jsdom và từ chối. Trình duyệt thật dùng chung một implementation nên không
// gặp chuyện này — đây là hạn chế của môi trường test, không phải của client.
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

  it('401 từ gateway gọi onUnauthenticated — đường thoát duy nhất khi phiên bị thu hồi', async () => {
    // Keycloak KHÔNG biết identity-service đã thu hồi phiên hay khoá tài khoản, nên `/api/auth/token`
    // vẫn trả token mới đều đặn trong khi mọi lời gọi gateway trả 401. Thiếu móc này thì người dùng
    // mắc kẹt: cookie nói đã đăng nhập, màn hình nào cũng lỗi, không có đường tự thoát.
    server.use(
      http.get(`${BASE_URL}/v1/me/organizations`, () =>
        HttpResponse.json({ code: 'UNAUTHENTICATED' }, { status: 401 }),
      ),
    );
    const onUnauthenticated = vi.fn();
    const api = createApiClient({ baseUrl: BASE_URL, onUnauthenticated });

    await expect(api.get('/v1/me/organizations')).rejects.toBeInstanceOf(ApiError);

    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('403 KHÔNG gọi onUnauthenticated — thiếu quyền không phải mất phiên', async () => {
    // Nhầm hai thứ này là đăng xuất người dùng mỗi lần họ chạm vào một nút không thuộc vai trò của
    // mình — và họ sẽ nghĩ hệ thống hỏng chứ không nghĩ mình thiếu quyền.
    server.use(
      http.get(`${BASE_URL}/v1/organizations/x/audit-logs`, () =>
        HttpResponse.json({ code: 'FORBIDDEN' }, { status: 403 }),
      ),
    );
    const onUnauthenticated = vi.fn();
    const api = createApiClient({ baseUrl: BASE_URL, onUnauthenticated });

    await expect(api.get('/v1/organizations/x/audit-logs')).rejects.toBeInstanceOf(ApiError);

    expect(onUnauthenticated).not.toHaveBeenCalled();
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

  /**
   * Hạn mặc định 15 giây là đúng cho CRUD và sai cho một lượt chat: mô hình chạy tại chỗ trên CPU
   * cần ~114 giây, nên nếu không có ghi đè theo từng lời gọi thì trình duyệt cắt ở giây 15 và
   * khung chat hỗ trợ không gửi được câu nào. `askSupport` dựa vào đúng bất biến này.
   */
  it('timeoutMs của một lời gọi thắng hạn mặc định của client', async () => {
    let seen: number | null = null;

    // Đọc hạn từ chính AbortSignal mà client dựng: `AbortSignal.timeout(ms)` không phơi ms ra, nên
    // chặn ở tầng fetch là chỗ duy nhất thấy được nó. Bọc `AbortSignal.timeout` để ghi lại tham số.
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    const spy = vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => {
      seen = ms;
      return realTimeout(ms);
    });

    server.use(http.post(`${BASE_URL}/v1/chat/agent/support`, () => HttpResponse.json({})));
    await client().post('/v1/chat/agent/support', { message: 'hỏi' }, { timeoutMs: 540_000 });

    expect(seen).toBe(540_000);
    spy.mockRestore();
  });

  it('không truyền timeoutMs thì vẫn là 15 giây — nới hạn là việc của từng endpoint', async () => {
    let seen: number | null = null;
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    const spy = vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => {
      seen = ms;
      return realTimeout(ms);
    });

    server.use(http.get(`${BASE_URL}/v1/events`, () => HttpResponse.json([])));
    await client().get('/v1/events');

    expect(seen).toBe(15_000);
    spy.mockRestore();
  });
});

/**
 * `fetch` của trình duyệt ném "Illegal invocation" nếu receiver không phải `window`.
 *
 * Node không kiểm receiver nên test bằng MSW ở trên KHÔNG bắt được lỗi này — phải kiểm thẳng cái
 * bất biến: ApiClient luôn gọi fetch với receiver là `globalThis`. Đây từng là lỗi thật, làm mọi
 * request từ trình duyệt của cả bốn app hỏng với `NETWORK_ERROR`.
 */
describe('receiver của fetch', () => {
  it('luôn là globalThis, không phải chính ApiClient', async () => {
    let called = false;
    let receiverWasGlobal = false;

    // Ghi lại kết quả SO SÁNH chứ không gán `this` ra biến: gán thẳng vi phạm `no-this-alias`,
    // mà thứ cần kiểm ở đây vốn chỉ là "receiver có phải globalThis không".
    function spyFetch(this: unknown): Promise<Response> {
      called = true;
      receiverWasGlobal = this === globalThis;
      return Promise.resolve(
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    }

    const api = createApiClient({
      baseUrl: BASE_URL,
      fetch: spyFetch as unknown as typeof globalThis.fetch,
    });
    await api.get('/v1/ping');

    expect(called).toBe(true);
    expect(receiverWasGlobal).toBe(true);
  });
});
