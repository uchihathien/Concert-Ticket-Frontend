import { describe, expect, it, vi } from 'vitest';
import { createAuthMiddleware } from '../middleware';
import type { NexaAuth } from '../config';

/**
 * Middleware chỉ được hỏi "đã đăng nhập chưa" — nhưng nó quyết định điều đó bằng một phép so khớp
 * đường dẫn, và phép so khớp đó là thứ dễ sai âm thầm nhất trong cả luồng.
 */
function guardFor(paths: string[]) {
  // `nexaAuth.auth(handler)` trả về Promise của handler; middleware await rồi gọi lại. Ở đây chỉ
  // cần chính `handler` để kiểm phép so khớp.
  const stub = {
    auth: async (handler: unknown) => handler,
  } as unknown as NexaAuth;

  const middleware = createAuthMiddleware(stub, { publicPaths: paths, signInPath: '/login' });

  return async (pathname: string, signedIn: boolean) => {
    const url = new URL(`https://app.example${pathname}`);
    const request = {
      nextUrl: Object.assign(url, { clone: () => new URL(url.toString()) }),
      auth: signedIn ? { user: {} } : null,
    };
    return middleware(request as never, undefined as never);
  };
}

describe('đường dẫn công khai', () => {
  it('trang chủ công khai KHÔNG mở toàn bộ app', async () => {
    // Mọi đường dẫn đều bắt đầu bằng '/', nên một phép so tiền tố ngây thơ biến `publicPaths: ['/']`
    // thành "bỏ hết bảo vệ" — và không có test nào đỏ, chỉ có dữ liệu người dùng lộ ra.
    const guard = guardFor(['/']);

    expect(await guard('/', false)).toBeUndefined();
    expect(await guard('/account', false)).toBeInstanceOf(Response);
  });

  it('/login không mở cho /loginXYZ', async () => {
    const guard = guardFor([]);

    expect(await guard('/login', false)).toBeUndefined();
    expect(await guard('/loginXYZ', false)).toBeInstanceOf(Response);
  });

  it('tiền tố công khai mở đúng những gì nằm dưới nó', async () => {
    const guard = guardFor(['/events']);

    expect(await guard('/events', false)).toBeUndefined();
    expect(await guard('/events/abc', false)).toBeUndefined();
    expect(await guard('/eventsxyz', false)).toBeInstanceOf(Response);
  });

  it('giữ đường đang muốn vào để quay lại sau khi đăng nhập', async () => {
    const guard = guardFor([]);
    const response = (await guard('/account', false)) as Response;

    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('returnUrl')).toBe('/account');
  });

  it('đã đăng nhập thì đi tiếp', async () => {
    const guard = guardFor([]);
    expect(await guard('/account', true)).toBeUndefined();
  });
});

// `Response.redirect` cần URL tuyệt đối; jsdom có sẵn nên không phải giả lập gì thêm.
vi.stubGlobal('Response', Response);
