import type { NextAuthRequest } from 'next-auth';
import type { NextFetchEvent, NextRequest } from 'next/server';
import type { NexaAuth } from './config';

/**
 * Middleware bảo vệ route.
 *
 * Chỉ chặn ở mức "đã đăng nhập hay chưa". Việc "người này có thuộc tổ chức đó không" do backend
 * quyết định và trả 404 — middleware của Next.js không có dữ liệu để trả lời câu đó, và giả vờ
 * trả lời được là tự tạo một điểm tin cậy thứ hai lệch với điểm thật.
 */
export interface AuthMiddlewareOptions {
  /**
   * Đường dẫn công khai. Khớp chính nó và mọi thứ nằm dưới nó — `'/events'` mở `/events/abc`
   * nhưng không mở `/eventsxyz`. `'/'` chỉ là trang chủ, không phải cả app.
   *
   * Mặc định: không có.
   */
  publicPaths?: string[];
  signInPath?: string;
}

/**
 * Đúng đường dẫn đó, hoặc nằm dưới nó. `/login` không mở cho `/loginXYZ`.
 *
 * `'/'` là trường hợp riêng và bắt buộc phải xử lý: mọi đường dẫn đều bắt đầu bằng `'/'`, nên
 * một phép so tiền tố ngây thơ sẽ biến trang chủ trong danh sách công khai thành "mở toàn bộ app".
 */
function isUnder(pathname: string, prefix: string): boolean {
  if (pathname === prefix) return true;
  const base = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  return base.length > 0 && pathname.startsWith(`${base}/`);
}

export function createAuthMiddleware(nexaAuth: NexaAuth, options: AuthMiddlewareOptions = {}) {
  const publicPaths = options.publicPaths ?? [];
  const signInPath = options.signInPath ?? '/login';

  const guard = (request: NextAuthRequest) => {
    const { pathname, search } = request.nextUrl;

    // So khớp bằng đúng một luật cho cả trang đăng nhập lẫn danh sách công khai.
    //
    // Bản trước dùng `pathname.startsWith(signInPath)` cho riêng trang đăng nhập, nên `/login`
    // mở luôn cho `/loginXYZ` — một đường dẫn thêm vào sau này chỉ vì trùng tiền tố mà thành công
    // khai, trong khi danh sách ngay bên dưới lại so khớp chặt. Hai luật khác nhau trong cùng một
    // hàm là chỗ sớm muộn cũng lệch.
    if (isUnder(pathname, signInPath)) return;
    if (publicPaths.some((prefix) => isUnder(pathname, prefix))) return;
    if (request.auth) return;

    // Giữ đường đang muốn vào để sau khi đăng nhập quay lại đúng chỗ.
    const url = request.nextUrl.clone();
    url.pathname = signInPath;
    url.search = '';
    url.searchParams.set('returnUrl', `${pathname}${search}`);
    return Response.redirect(url);
  };

  /**
   * `nexaAuth.auth(guard)` phải được `await`.
   *
   * Config của chúng ta là hàm (dựng theo từng request, để `next build` không cần secret), và ở
   * nhánh đó `initAuth` của Auth.js trả về *Promise* của handler chứ không phải handler. Export
   * thẳng nó ra thì Next từ chối với "must export a `middleware` or a `default` function" — và
   * chỉ lộ ra lúc chạy, không lộ ra lúc build.
   */
  return async function middleware(request: NextRequest, event: NextFetchEvent) {
    // Kiểu khai báo của `auth(handler)` mô tả handler của route (`req, ctx`), còn ở middleware
    // Auth.js gọi nó với `(req, event)`. Ép kiểu ở đúng một chỗ, kèm lý do, thay vì để lệch âm ỉ.
    const handler = (await nexaAuth.auth(guard)) as unknown as (
      request: NextRequest,
      event: NextFetchEvent,
    ) => Promise<Response | undefined>;

    return handler(request, event);
  };
}
