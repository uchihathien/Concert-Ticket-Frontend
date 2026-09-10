import { getToken } from 'next-auth/jwt';
import type { NexaApp } from './config';
import { sessionCookieName, useSecureCookies } from './cookies';

/**
 * Những gì cookie phiên còn mang.
 *
 * @param present có cookie phiên giải mã được hay không
 * @param ref tham chiếu tới bản ghi phiên ở store
 */
export interface SessionCookie {
  present: boolean;
  ref?: string;
}

/**
 * Đọc tham chiếu phiên từ cookie, phía server.
 *
 * Cookie chỉ còn mang đúng `refreshRef`; access token và refresh token nằm ở store. Xem đầu file
 * `access-token.ts` để biết vì sao — tóm tắt: `auth()` ở nhánh RSC của next-auth vứt bỏ
 * `Set-Cookie`, nên mọi giá trị xoay vòng mà nằm trong cookie đều trở thành bản cũ ngay sau lần
 * làm mới đầu tiên.
 *
 * Đường này KHÔNG đi qua Auth.js, nên phải tự truyền đúng tên cookie của app. `getToken` lấy
 * `salt` mặc định bằng chính `cookieName`, và Auth.js cũng ký bằng tên đó (`actions/session.js`),
 * nên hai bên khớp nhau mà không cần khai thêm gì.
 */
export async function readSessionCookie(request: Request, app: NexaApp): Promise<SessionCookie> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('[@nexaticket/auth] Thiếu biến môi trường AUTH_SECRET');

  const secure = useSecureCookies();
  const token = await getToken({
    req: request,
    secret,
    secureCookie: secure,
    cookieName: sessionCookieName(app, secure),
  });

  if (!token) return { present: false };
  return { present: true, ref: token.refreshRef };
}

/** Số mảnh tối đa Auth.js cắt cookie ra khi nó vượt 4KB. Cookie hiện tại nhỏ, nhưng bản cũ thì không. */
const MAX_COOKIE_CHUNKS = 4;

/**
 * Header xoá cookie phiên.
 *
 * <p>Dùng khi phát hiện phiên đã chết thật (refresh token bị thu hồi hoặc hết hạn). Không xoá thì
 * cookie vẫn nói "đã đăng nhập", middleware vẫn cho đi tiếp, và người dùng mắc kẹt ở một giao diện
 * đăng nhập rồi mà mọi lời gọi API đều 401 — không có đường nào tự thoát ra ngoài việc xoá cookie
 * bằng tay.
 *
 * <p>Chỉ route handler phía Node gọi được hàm này, và đó là đúng chỗ: nó là nơi duy nhất nhìn thấy
 * store, tức nơi duy nhất biết phiên còn sống hay không.
 */
export function expiredSessionCookies(app: NexaApp): string[] {
  const secure = useSecureCookies();
  const base = sessionCookieName(app, secure);
  const names = [base, ...Array.from({ length: MAX_COOKIE_CHUNKS }, (_, i) => `${base}.${i}`)];
  const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
  return names.map((name) => `${name}=; ${flags}`);
}
