import NextAuth, { type NextAuthConfig, type NextAuthResult } from 'next-auth';
import Keycloak from 'next-auth/providers/keycloak';
import { type AccessTokenDeps, type AccessTokenState, ensureAccessToken } from './access-token';
import { authCookieNames, useSecureCookies } from './cookies';
import { endSession } from './keycloak';
import { readSessionCookie } from './server';
import { defaultRefreshTokenStore, newTokenRef, type RefreshTokenStore } from './token-store';

/** Bốn app = bốn client Keycloak riêng (plan/frontend.md §4). */
export type NexaApp = 'web-customer' | 'web-admin' | 'web-platform' | 'web-scanner';

export interface NexaAuthOptions {
  app: NexaApp;
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  /**
   * Nơi giữ token của phiên. Mặc định là bản trong tiến trình — chỉ đủ cho `next dev`, và ở
   * production nó ném lỗi thay vì chạy tiếp (xem `defaultRefreshTokenStore`).
   */
  refreshTokenStore?: RefreshTokenStore;
  /** Trang đăng nhập của app. Auth.js chuyển hướng tới đây khi cần xác thực. */
  signInPage?: string;
  /**
   * Mở thêm đường "đăng ký" dẫn thẳng tới trang tạo tài khoản của Keycloak.
   *
   * Chỉ bật cho `web-customer`. Tài khoản của ban tổ chức, nhân viên soát vé và superadmin đều
   * do người khác cấp — có nút tự đăng ký ở ba app đó là mời người lạ vào khu vực quản trị.
   *
   * Cần realm bật "User registration"; không bật thì Keycloak trả về trang lỗi.
   */
  registration?: boolean;
}

/** Id của provider dùng cho đường đăng ký. Truyền vào `signIn()` để mở đúng trang. */
export const REGISTER_PROVIDER_ID = 'keycloak-register';

/** Refresh token của Keycloak mặc định sống 30 ngày; giữ bản ghi server đúng bằng ngần đó. */
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

declare module 'next-auth/jwt' {
  interface JWT {
    /**
     * Tham chiếu tới bản ghi phiên phía server — bản thân nó vô dụng nếu bị lộ.
     *
     * Đây là thứ DUY NHẤT của phiên nằm trong cookie, và nó **không đổi** suốt phiên. Access
     * token lẫn refresh token đều nằm ở store; lý do nằm ở đầu file `access-token.ts`.
     */
    refreshRef?: string;
  }
}

/**
 * Cookie KHÔNG mang cờ "phiên đã hỏng".
 *
 * Bản trước có `authError`, đặt từ callback `jwt`. Nhưng callback đó cũng chạy trong middleware —
 * Edge runtime, không nhìn thấy store — nên nó sẽ đánh dấu hỏng cho những phiên hoàn toàn khoẻ.
 * Kết luận "phiên đã chết" chỉ đúng ở nơi thấy store, và nơi đó xử lý bằng cách xoá thẳng cookie
 * (`expiredSessionCookies`) thay vì ghi một cờ vào nó.
 */

export interface NexaAuth {
  /** App nào — quyết định tên cookie phiên, nên mọi nơi đọc/xoá cookie bằng tay đều cần nó. */
  app: NexaApp;
  handlers: NextAuthResult['handlers'];
  auth: NextAuthResult['auth'];
  signIn: NextAuthResult['signIn'];
  signOut: NextAuthResult['signOut'];
  refreshTokenStore: RefreshTokenStore;
  /**
   * Access token còn hạn của người đang gửi request, làm mới nếu cần.
   *
   * Dùng ở route handler `/api/auth/token` và ở RSC / Server Action khi cần gọi API thay mặt
   * người dùng. Không đọc access token từ cookie, nên không phụ thuộc vào việc `Set-Cookie` có
   * được ghi lại hay không — chỗ mà bản trước sai.
   */
  readAccessToken(request: Request): Promise<AccessTokenState>;
}

/**
 * Dựng Auth.js cho một app.
 *
 * Ba luật cứng được ép ở đây, không phải bằng quy ước:
 *
 * 1. Refresh token nằm ở `refreshTokenStore` phía server; cookie chỉ mang `refreshRef`.
 * 2. Access token cũng nằm ở đó — cookie không mang bản sao nào, kể cả đã mã hoá.
 * 3. Session trả cho client **không** chứa access token. Client lấy token qua `/api/auth/token`
 *    và giữ trong memory (`@nexaticket/auth/client`).
 *
 * Vai trò trong tổ chức **không** lấy từ token: backend phân quyền theo membership tra ở
 * identity-service, nên frontend cũng phải hỏi `GET /v1/me/organizations` thay vì tin claim.
 */
export function createNexaAuth(options: NexaAuthOptions): NexaAuth {
  let store: RefreshTokenStore | null = options.refreshTokenStore ?? null;
  const getStore = () => (store ??= defaultRefreshTokenStore());

  // Config dựng theo từng request, không phải lúc import.
  //
  // `createNexaAuth` được gọi ở module scope của `src/auth.ts`, tức là chạy ngay khi `next build`
  // nạp file. Kiểm biến môi trường ở đó thì CI phải có sẵn secret của Keycloak chỉ để biên dịch
  // — sai chỗ. Kiểm ở đây: build không cần secret, còn request đầu tiên thiếu secret thì hỏng
  // ngay và nói rõ thiếu biến nào.
  const result = NextAuth(() => buildConfig(options, getStore()));

  return {
    app: options.app,
    handlers: result.handlers,
    auth: result.auth,
    signIn: result.signIn,
    signOut: result.signOut,
    get refreshTokenStore() {
      return getStore();
    },
    async readAccessToken(request: Request): Promise<AccessTokenState> {
      const cookie = await readSessionCookie(request, options.app);
      if (!cookie.present) return { status: 'anonymous' };
      return ensureAccessToken(cookie.ref, accessTokenDeps(options, getStore()));
    },
  };
}

function accessTokenDeps(options: NexaAuthOptions, store: RefreshTokenStore): AccessTokenDeps {
  return {
    store,
    issuer: required(options.issuer ?? process.env.KEYCLOAK_ISSUER, 'KEYCLOAK_ISSUER'),
    clientId: required(
      options.clientId ?? process.env.KEYCLOAK_CLIENT_ID ?? options.app,
      'KEYCLOAK_CLIENT_ID',
    ),
    clientSecret: required(
      options.clientSecret ?? process.env.KEYCLOAK_CLIENT_SECRET,
      'KEYCLOAK_CLIENT_SECRET',
    ),
  };
}

function buildConfig(options: NexaAuthOptions, store: RefreshTokenStore): NextAuthConfig {
  const deps = accessTokenDeps(options, store);
  const { issuer, clientId, clientSecret } = deps;

  const providers = [Keycloak({ clientId, clientSecret, issuer })];

  if (options.registration) {
    // Cùng một client Keycloak, chỉ khác điểm vào: `/registrations` là trang tạo tài khoản, còn
    // `/auth` là trang đăng nhập. Sau khi tạo xong Keycloak quay lại đúng callback cũ, nên phần
    // còn lại của luồng — đổi code lấy token, lưu refresh token — không phải sửa gì.
    providers.push(
      Keycloak({
        id: REGISTER_PROVIDER_ID,
        name: 'Keycloak (đăng ký)',
        clientId,
        clientSecret,
        issuer,
        authorization: {
          url: `${issuer.replace(/\/$/, '')}/protocol/openid-connect/registrations`,
          params: { scope: 'openid profile email' },
        },
      }),
    );
  }

  const secure = useSecureCookies();

  return {
    providers,
    session: { strategy: 'jwt' },
    // Bốn app chạy trên cùng host `localhost` ở dev, và cookie không phân biệt cổng. Tên mặc định
    // của Auth.js làm chúng ghi đè lên nhau; xem `cookies.ts` để biết đủ bốn hậu quả.
    //
    // Ghim luôn `useSecureCookies` thay vì để Auth.js suy ra từ giao thức của request: tên cookie
    // ở đây phải khớp tuyệt đối với tên mà `readSessionCookie` đi tìm, nên cả hai chỉ được nhìn
    // vào đúng một nguồn.
    useSecureCookies: secure,
    cookies: authCookieNames(options.app, secure),
    pages: options.signInPage ? { signIn: options.signInPage } : undefined,
    callbacks: {
      async jwt({ token, account }) {
        if (account) {
          // Đăng nhập lại trên một phiên còn cookie cũ: bản ghi cũ phải bị xoá tại đây.
          //
          // Bản trước cấp `refreshRef` mới và bỏ mặc bản cũ. Không ai còn tham chiếu tới nó, nên
          // nó nằm lại store đúng 30 ngày — cùng với một refresh token Keycloak vẫn đổi được ra
          // access token. Rác thì nhẹ, nhưng một thông tin đăng nhập còn hiệu lực mà không ai
          // theo dõi thì không nhẹ.
          if (token.refreshRef) await store.delete(token.refreshRef);

          const ref = newTokenRef();
          await store.set(ref, {
            refreshToken: account.refresh_token ?? '',
            subject: token.sub ?? '',
            expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
            accessToken: account.access_token,
            accessTokenExpiresAt: account.expires_at
              ? account.expires_at * 1000
              : Date.now() + 60_000,
          });
          token.refreshRef = ref;
          return token;
        }

        // Các request sau: KHÔNG chạm vào store. Đây là điều kiện bắt buộc, không phải tối ưu.
        //
        // Callback này chạy ở MỌI nơi gọi `auth()`, kể cả middleware — mà middleware của Next.js
        // chạy trong **Edge runtime**: một realm JavaScript riêng, không dùng chung `globalThis`
        // với route handler, nên store in-memory ở đó luôn rỗng. Hỏi store tại đây thì middleware
        // luôn kết luận "phiên đã chết" và giết phiên ngay ở lần điều hướng đầu tiên, dù phiên
        // hoàn toàn khoẻ.
        //
        // Cookie vì vậy chỉ trả lời đúng câu mà nó tự trả lời được: "có phiên hay không". Câu
        // "token còn hạn không" do `readAccessToken` trả lời, và nó chỉ chạy ở route handler phía
        // Node — nơi thật sự nhìn thấy store.
        return token;
      },

      async session({ session, token }) {
        // Cố ý KHÔNG gắn accessToken vào session: `/api/auth/session` là endpoint công khai với
        // JS của trang, và token phải đi qua đúng một cửa là `/api/auth/token`.
        if (token.sub) session.user = { ...session.user, id: token.sub };
        return session;
      },
    },
    events: {
      /**
       * Đăng xuất phải kết thúc phiên ở CẢ HAI phía, không chỉ phía mình.
       *
       * Bản trước chỉ xoá bản ghi refresh token ở store. Nhìn thì có vẻ đủ — cookie mất, tham
       * chiếu mất — nhưng bên Keycloak không có gì thay đổi: refresh token vẫn đổi được ra access
       * token mới, và phiên SSO vẫn sống (realm đặt 30 ngày).
       *
       * Hệ quả người dùng gặp: bấm "Đăng xuất" rồi bấm "Đăng nhập" thì Keycloak thấy phiên còn
       * hiệu lực, cấp code ngay mà không hỏi mật khẩu, và quay lại đúng tài khoản vừa thoát. Không
       * có cách nào đăng nhập bằng tài khoản khác ngoài việc tự đi xoá cookie của trình duyệt.
       *
       * Thứ tự ở đây là cố ý: gọi Keycloak TRƯỚC, xoá store SAU. Xoá trước thì không còn refresh
       * token để gửi đi, và phiên bên Keycloak sống sót vĩnh viễn mà không ai biết.
       */
      async signOut(message) {
        const ref = 'token' in message ? message.token?.refreshRef : undefined;
        if (!ref) return;

        const stored = await store.get(ref);
        if (stored?.refreshToken) {
          try {
            await endSession({
              issuer,
              clientId,
              clientSecret,
              refreshToken: stored.refreshToken,
            });
          } catch {
            // Keycloak không phản hồi thì vẫn phải đăng xuất ở phía mình: giữ người dùng ở trạng
            // thái đã đăng nhập chỉ vì IdP đang trục trặc là đổi sai chiều. Phiên bên kia sẽ tự
            // hết hạn; phiên bên này thì mất ngay.
          }
        }

        await store.delete(ref);
      },
    },
  };
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`[@nexaticket/auth] Thiếu biến môi trường ${name}`);
  return value;
}
