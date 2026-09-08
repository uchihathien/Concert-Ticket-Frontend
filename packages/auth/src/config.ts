import NextAuth, { type NextAuthConfig, type NextAuthResult } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Keycloak from 'next-auth/providers/keycloak';
import { RefreshFailedError, refreshAccessToken } from './keycloak';
import { defaultRefreshTokenStore, newTokenRef, type RefreshTokenStore } from './token-store';

/** Bốn app = bốn client Keycloak riêng (plan/frontend.md §4). */
export type NexaApp = 'web-customer' | 'web-admin' | 'web-platform' | 'web-scanner';

export interface NexaAuthOptions {
  app: NexaApp;
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  /**
   * Nơi giữ refresh token. Mặc định là bản trong tiến trình — chỉ đủ cho `next dev`.
   * Production phải cắm store dùng chung (Redis).
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

/**
 * Đổi token sớm hơn hạn 30 giây.
 *
 * Đúng hạn mới đổi thì request đang bay dở sẽ mang token vừa hết hạn và nhận 401 — người dùng
 * thấy "phiên hết hạn" giữa lúc đang thao tác.
 */
const REFRESH_SKEW_MS = 30_000;

/** Refresh token của Keycloak mặc định sống 30 ngày; giữ bản ghi server đúng bằng ngần đó. */
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

declare module 'next-auth/jwt' {
  interface JWT {
    /** Access token sống ngắn. Nằm trong cookie JWE httpOnly, không bao giờ vào storage. */
    accessToken?: string;
    /** Epoch ms. */
    accessTokenExpiresAt?: number;
    /** Tham chiếu tới refresh token phía server — bản thân nó vô dụng nếu bị lộ. */
    refreshRef?: string;
    /** Đặt khi làm mới token thất bại không cứu được: UI phải đẩy người dùng đi đăng nhập lại. */
    authError?: 'RefreshFailed';
  }
}

declare module 'next-auth' {
  interface Session {
    authError?: 'RefreshFailed';
  }
}

export interface NexaAuth {
  handlers: NextAuthResult['handlers'];
  auth: NextAuthResult['auth'];
  signIn: NextAuthResult['signIn'];
  signOut: NextAuthResult['signOut'];
  refreshTokenStore: RefreshTokenStore;
}

/**
 * Dựng Auth.js cho một app.
 *
 * Hai luật cứng được ép ở đây, không phải bằng quy ước:
 *
 * 1. Refresh token nằm ở `refreshTokenStore` phía server; cookie chỉ mang `refreshRef`.
 * 2. Session trả cho client **không** chứa access token. Client lấy token qua `/api/auth/token`
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
    handlers: result.handlers,
    auth: result.auth,
    signIn: result.signIn,
    signOut: result.signOut,
    get refreshTokenStore() {
      return getStore();
    },
  };
}

function buildConfig(options: NexaAuthOptions, store: RefreshTokenStore): NextAuthConfig {
  const issuer = required(options.issuer ?? process.env.KEYCLOAK_ISSUER, 'KEYCLOAK_ISSUER');
  const clientId = required(
    options.clientId ?? process.env.KEYCLOAK_CLIENT_ID ?? options.app,
    'KEYCLOAK_CLIENT_ID',
  );
  const clientSecret = required(
    options.clientSecret ?? process.env.KEYCLOAK_CLIENT_SECRET,
    'KEYCLOAK_CLIENT_SECRET',
  );

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

  return {
    providers,
    session: { strategy: 'jwt' },
    pages: options.signInPage ? { signIn: options.signInPage } : undefined,
    callbacks: {
      async jwt({ token, account }) {
        if (account) {
          const refreshToken = account.refresh_token;
          const ref = newTokenRef();
          if (refreshToken && token.sub) {
            await store.set(ref, {
              refreshToken,
              subject: token.sub,
              expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
            });
            token.refreshRef = ref;
          }
          token.accessToken = account.access_token;
          token.accessTokenExpiresAt = account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 60_000;
          delete token.authError;
          return token;
        }

        const expiresAt = token.accessTokenExpiresAt ?? 0;
        if (Date.now() < expiresAt - REFRESH_SKEW_MS) return token;

        return refreshToken(token, { store, issuer, clientId, clientSecret });
      },

      async session({ session, token }) {
        // Cố ý KHÔNG gắn accessToken vào session: `/api/auth/session` là endpoint công khai với
        // JS của trang, và token phải đi qua đúng một cửa là `/api/auth/token`.
        if (token.authError) session.authError = token.authError;
        if (token.sub) session.user = { ...session.user, id: token.sub };
        return session;
      },
    },
    events: {
      async signOut(message) {
        const ref = 'token' in message ? message.token?.refreshRef : undefined;
        if (ref) await store.delete(ref);
      },
    },
  };
}

async function refreshToken(
  token: JWT,
  deps: {
    store: RefreshTokenStore;
    issuer: string;
    clientId: string;
    clientSecret: string;
  },
): Promise<JWT> {
  const ref = token.refreshRef;
  if (!ref) {
    token.authError = 'RefreshFailed';
    return token;
  }

  const stored = await deps.store.get(ref);
  if (!stored) {
    // Server khởi động lại (store trong tiến trình) hoặc phiên đã bị thu hồi.
    token.authError = 'RefreshFailed';
    return token;
  }

  try {
    const refreshed = await refreshAccessToken({
      issuer: deps.issuer,
      clientId: deps.clientId,
      clientSecret: deps.clientSecret,
      refreshToken: stored.refreshToken,
    });

    // Keycloak xoay vòng refresh token: không ghi đè là lần đổi sau sẽ hỏng.
    await deps.store.set(ref, { ...stored, refreshToken: refreshed.refreshToken });

    token.accessToken = refreshed.accessToken;
    token.accessTokenExpiresAt = refreshed.expiresAt;
    delete token.authError;
    return token;
  } catch (cause) {
    if (cause instanceof RefreshFailedError && cause.recoverable) {
      // Keycloak trục trặc tạm thời: giữ nguyên phiên, lần gọi sau thử lại. Đá người dùng ra
      // đăng nhập lại vì một lần 503 là phản ứng thái quá.
      return token;
    }
    await deps.store.delete(ref);
    token.authError = 'RefreshFailed';
    delete token.accessToken;
    return token;
  }
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`[@nexaticket/auth] Thiếu biến môi trường ${name}`);
  return value;
}
