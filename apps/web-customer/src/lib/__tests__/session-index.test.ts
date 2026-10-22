// @vitest-environment node
//
// Mã chạy phía server (RSC): fetch thật của undici, chặn bằng MSW. Môi trường node vì fetch của
// undici từ chối AbortSignal của jsdom.
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const API = 'http://catalog.test';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  // `serverApi` đọc biến môi trường lúc nạp module — đặt trước rồi mới nạp lại.
  vi.stubEnv('API_BASE_URL', API);
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

const card = (slug: string) => ({
  slug,
  title: slug,
  summary: null,
  category: 'nhac-song',
  posterUrl: null,
  city: 'Hà Nội',
  venueName: 'Nhà hát',
  nextSessionAt: null,
  fromPriceVnd: 100_000,
  sessionCount: 1,
});

const detail = (slug: string, sessionIds: string[]) => ({
  ...card(slug),
  title: `Sự kiện ${slug}`,
  description: null,
  venueAddress: null,
  seatMapImageUrl: null,
  sessions: sessionIds.map((id) => ({
    id,
    startsAt: '2026-11-01T12:00:00Z',
    endsAt: null,
    salesOpenAt: null,
    salesCloseAt: null,
    tiers: [],
  })),
});

describe('loadSessionIndex', () => {
  it('tra ngược mỗi suất về sự kiện của nó; một trang chi tiết hỏng không kéo theo các trang khác', async () => {
    let listQuery = '';
    server.use(
      http.get(`${API}/v1/events`, ({ request }) => {
        listQuery = new URL(request.url).search;
        return HttpResponse.json({
          items: [card('a'), card('b'), card('c')],
          total: 3,
          page: 0,
          size: 60,
          cities: [],
        });
      }),
      http.get(`${API}/v1/events/a`, () => HttpResponse.json(detail('a', ['s1', 's2']))),
      http.get(`${API}/v1/events/b`, () =>
        HttpResponse.json({ code: 'EVENT_NOT_FOUND' }, { status: 404 }),
      ),
      http.get(`${API}/v1/events/c`, () => HttpResponse.json(detail('c', ['s3']))),
    );

    const { loadSessionIndex } = await import('../session-index');
    const index = await loadSessionIndex();

    // Backend kẹp `size` ở 60 — xin nhiều hơn là xin thừa.
    expect(listQuery).toBe('?size=60');
    expect(Object.keys(index).sort()).toEqual(['s1', 's2', 's3']);
    expect(index.s1).toMatchObject({ slug: 'a', eventTitle: 'Sự kiện a', city: 'Hà Nội' });
    expect(index.s3?.slug).toBe('c');
  });

  it('catalog chết thì trả bảng rỗng — ví vé vẫn phải mở được', async () => {
    server.use(http.get(`${API}/v1/events`, () => HttpResponse.error()));
    const { loadSessionIndex } = await import('../session-index');
    await expect(loadSessionIndex()).resolves.toEqual({});
  });
});

describe('loadCities', () => {
  it('xin đúng một bản ghi và lấy danh sách thành phố đi kèm', async () => {
    let size: string | null = null;
    server.use(
      http.get(`${API}/v1/events`, ({ request }) => {
        size = new URL(request.url).searchParams.get('size');
        return HttpResponse.json({ items: [], total: 0, page: 0, size: 1, cities: ['Hà Nội', 'Huế'] });
      }),
    );
    const { loadCities } = await import('../server-api');
    expect(await loadCities()).toEqual(['Hà Nội', 'Huế']);
    expect(size).toBe('1');
  });

  it('lỗi 5xx của catalog thì trả mảng rỗng thay vì làm trắng cả layout', async () => {
    server.use(
      http.get(`${API}/v1/events`, () =>
        HttpResponse.json({ code: 'INTERNAL_ERROR' }, { status: 503 }),
      ),
    );
    const { loadCities } = await import('../server-api');
    expect(await loadCities()).toEqual([]);
  });

  it('API_BASE_URL rỗng thì rơi về NEXT_PUBLIC_API_BASE_URL — chuỗi rỗng không được lọt qua', async () => {
    vi.stubEnv('API_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://public.test');
    server.use(
      http.get('http://public.test/v1/events', () =>
        HttpResponse.json({ items: [], total: 0, page: 0, size: 1, cities: ['Đà Nẵng'] }),
      ),
    );
    const { loadCities } = await import('../server-api');
    expect(await loadCities()).toEqual(['Đà Nẵng']);
  });
});
