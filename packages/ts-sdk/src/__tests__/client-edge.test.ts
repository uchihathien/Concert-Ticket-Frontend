// Những nhánh của ApiClient mà client.test.ts chưa chạm: hạn chờ, mã dự phòng theo status, body
// rỗng, và các header chỉ được gửi khi có lý do. Dùng `fetch` giả truyền thẳng vào client để điều
// khiển được cả những lỗi mà MSW không dựng nổi (TimeoutError của AbortSignal).
import { describe, expect, it, vi } from 'vitest';
import { ApiError, networkError } from '../http/api-error';
import { createApiClient } from '../http/client';

function clientWith(
  respond: (url: string, init: RequestInit) => Promise<Response> | Response,
  extra: Partial<Parameters<typeof createApiClient>[0]> = {},
) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return respond(String(input), init ?? {});
  });
  const api = createApiClient({
    baseUrl: 'http://gateway.test/',
    fetch: fakeFetch as unknown as typeof fetch,
    ...extra,
  });
  return { api, calls };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('ApiClient — dựng request', () => {
  it('bỏ dấu / cuối của baseUrl để không thành //v1', async () => {
    const { api, calls } = clientWith(() => json({}));
    await api.get('/v1/events');
    expect(calls[0]!.url).toBe('http://gateway.test/v1/events');
  });

  it('GET không body thì không khai Content-Type; luôn credentials=omit và Accept JSON', async () => {
    const { api, calls } = clientWith(() => json({}));
    await api.get('/v1/events');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers.Accept).toBe('application/json');
    expect(calls[0]!.init.credentials).toBe('omit');
    expect(calls[0]!.init.body).toBeUndefined();
  });

  it('PATCH và PUT gửi body JSON với đúng method', async () => {
    const { api, calls } = clientWith(() => json({}));
    await api.patch('/v1/x', { a: 1 });
    await api.put('/v1/y', { b: 2 });
    expect(calls.map((c) => [c.init.method, c.init.body])).toEqual([
      ['PATCH', '{"a":1}'],
      ['PUT', '{"b":2}'],
    ]);
    expect((calls[0]!.init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
  });

  it('chờ được getAccessToken bất đồng bộ', async () => {
    const { api, calls } = clientWith(() => json({}), {
      getAccessToken: async () => 'async-tok',
    });
    await api.get('/v1/me/orders');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(
      'Bearer async-tok',
    );
  });

  it('header do nơi gọi truyền vào được giữ, và etag thành If-None-Match', async () => {
    const { api, calls } = clientWith(() => json({}));
    await api.get('/v1/x', { headers: { 'X-Trace': 't1' }, etag: '"9"' });
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['X-Trace']).toBe('t1');
    expect(headers['If-None-Match']).toBe('"9"');
  });

  it('signal của nơi gọi thắng hạn mặc định', async () => {
    const { api, calls } = clientWith(() => json({}));
    const controller = new AbortController();
    await api.get('/v1/x', { signal: controller.signal });
    expect(calls[0]!.init.signal).toBe(controller.signal);
  });
});

describe('ApiClient — đọc response', () => {
  it('Content-Length: 0 hoặc body rỗng trả null, không nổ JSON.parse', async () => {
    const { api } = clientWith((url) =>
      url.endsWith('/a')
        ? new Response('', { status: 200, headers: { 'Content-Length': '0' } })
        : new Response('', { status: 201 }),
    );
    expect((await api.post('/v1/a')).data).toBeNull();
    expect((await api.post('/v1/b')).data).toBeNull();
  });

  it('trả etag và correlationId từ header', async () => {
    const { api } = clientWith(() => json({ ok: true }, 200, { ETag: '"e"', 'X-Correlation-Id': 'c' }));
    const response = await api.get('/v1/x');
    expect(response).toMatchObject({ etag: '"e"', correlationId: 'c', notModified: false });
  });

  /**
   * Hiện trạng, không phải hành vi mong muốn: body 200 không phải JSON (ví dụ trang HTML của Next
   * khi baseUrl rỗng làm request rơi vào chính app — tình huống base-url.ts mô tả) nổ ra
   * `SyntaxError` trần chứ không phải `ApiError`. Nhánh lỗi (`toApiError`) đã được bọc cho đúng tình
   * huống này; nhánh thành công thì chưa. Test chỉ khẳng định request bị từ chối — xem báo cáo.
   */
  it('body 200 không phải JSON làm request bị từ chối (hiện là SyntaxError, không phải ApiError)', async () => {
    const { api } = clientWith(() => new Response('<html>login</html>', { status: 200 }));
    const error = await api.get('/v1/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SyntaxError);
  });
});

describe('ApiClient — mã lỗi dự phòng khi body không có `code`', () => {
  it.each([
    [400, 'VALIDATION_FAILED'],
    [401, 'UNAUTHENTICATED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [422, 'VALIDATION_FAILED'],
    [429, 'RATE_LIMITED'],
    [500, 'INTERNAL_ERROR'],
    [503, 'INTERNAL_ERROR'],
  ])('HTTP %i → %s', async (status, code) => {
    const { api } = clientWith(() => new Response('', { status }));
    const error = (await api.get('/v1/x').catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.detail).toBeNull();
    // `message` rơi về code khi không có detail — log không bao giờ là chuỗi rỗng.
    expect(error.message).toBe(code);
  });

  it('401 không có body vẫn gọi onUnauthenticated', async () => {
    const onUnauthenticated = vi.fn();
    const { api } = clientWith(() => new Response('', { status: 401 }), { onUnauthenticated });
    const error = (await api.get('/v1/x').catch((e: unknown) => e)) as ApiError;
    expect(error.isAuthError).toBe(true);
    expect(onUnauthenticated).toHaveBeenCalledOnce();
  });

  it('5xx không phải lỗi phía client', async () => {
    const { api } = clientWith(() => json({ code: 'INVENTORY_UNAVAILABLE' }, 503));
    const error = (await api.get('/v1/x').catch((e: unknown) => e)) as ApiError;
    expect(error.isClientError).toBe(false);
    expect(error.code).toBe('INVENTORY_UNAVAILABLE');
  });
});

describe('ApiClient — hạn chờ và lỗi mạng', () => {
  it('fetch bị huỷ vì hết hạn thành ApiError TIMEOUT, status 0', async () => {
    const { api } = clientWith(() => {
      throw new DOMException('signal timed out', 'TimeoutError');
    });
    const error = (await api.get('/v1/x').catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('TIMEOUT');
    expect(error.status).toBe(0);
    expect(error.detail).toContain('signal timed out');
  });

  it('người dùng tự huỷ (AbortError) là NETWORK_ERROR, không bị gọi nhầm là quá hạn', async () => {
    const { api } = clientWith(() => {
      throw new DOMException('aborted', 'AbortError');
    });
    const error = (await api.get('/v1/x').catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('NETWORK_ERROR');
  });

  it('client KHÔNG tự thử lại — một lỗi mạng là đúng một lần gọi fetch', async () => {
    const { api, calls } = clientWith(() => {
      throw new TypeError('fetch failed');
    });
    await api.post('/v1/orders', {}, { idempotencyKey: 'k' }).catch(() => undefined);
    expect(calls).toHaveLength(1);
  });

  it('networkError với nguyên nhân không phải Error vẫn có detail đọc được', () => {
    expect(networkError('mất sóng').detail).toBe('mất sóng');
  });
});
