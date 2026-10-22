import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { isStaffApp, storageKey } from './app-variant';

const issuer = (process.env.EXPO_PUBLIC_KEYCLOAK_ISSUER ?? 'http://localhost:8081/realms/nexaticket').replace(/\/$/, '');

/*
 * Mỗi bản ứng dụng một client Keycloak: `mobile-customer` cho khách, `mobile-staff` cho ban tổ chức
 * và nhân viên. Tách client là tách redirect URI (hai scheme khác nhau) và tách quyền dùng grant
 * `password` — chỉ client của bản staff được bật nó, cho đăng nhập bằng mã PIN.
 */
const clientId = isStaffApp
  ? process.env.EXPO_PUBLIC_STAFF_OIDC_CLIENT_ID ?? 'mobile-staff'
  : process.env.EXPO_PUBLIC_MOBILE_OIDC_CLIENT_ID ?? 'mobile-customer';
const refreshTokenKey = storageKey('refresh-token');

export const redirectUri =
  (isStaffApp ? process.env.EXPO_PUBLIC_STAFF_OIDC_REDIRECT_URI : process.env.EXPO_PUBLIC_OIDC_REDIRECT_URI) ||
  AuthSession.makeRedirectUri({ scheme: isStaffApp ? 'nexaticket-staff' : 'nexaticket', path: 'auth' });

export const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `${issuer}/protocol/openid-connect/auth`,
  tokenEndpoint: `${issuer}/protocol/openid-connect/token`,
  revocationEndpoint: `${issuer}/protocol/openid-connect/revoke`,
  endSessionEndpoint: `${issuer}/protocol/openid-connect/logout`,
};

export const mobileClientId = clientId;

let accessToken: string | null = null;
let accessTokenExpiresAt = 0;
let refreshToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export async function saveAuthResponse(response: AuthSession.TokenResponse) {
  accessToken = response.accessToken;
  accessTokenExpiresAt = response.expiresIn
    ? Date.now() + response.expiresIn * 1000
    : Number.MAX_SAFE_INTEGER;

  if (response.refreshToken) {
    refreshToken = response.refreshToken;
    if (Platform.OS !== 'web') {
      await SecureStore.setItemAsync(refreshTokenKey, response.refreshToken);
    }
  }
}

export async function restoreMobileSession() {
  if (Platform.OS === 'web') return false;

  refreshToken = await SecureStore.getItemAsync(refreshTokenKey);
  if (!refreshToken) return false;
  return Boolean(await getMobileAccessToken());
}

export async function getMobileAccessToken(): Promise<string | null> {
  if (accessToken && accessTokenExpiresAt > Date.now() + 30_000) return accessToken;
  if (!refreshToken || Platform.OS === 'web') return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = AuthSession.refreshAsync(
    { clientId, refreshToken },
    discovery,
  )
    .then(async (response) => {
      await saveAuthResponse(response);
      return accessToken;
    })
    .catch(async (error: unknown) => {
      if ((error as { code?: string } | null)?.code === 'invalid_grant') {
        await clearMobileSession();
      }
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export async function exchangeMobileCode(code: string, codeVerifier: string) {
  const response = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code,
      redirectUri,
      extraParams: { code_verifier: codeVerifier },
    },
    discovery,
  );
  await saveAuthResponse(response);
}

/**
 * Miền của email nội bộ gắn với tài khoản nhân viên do hệ thống cấp. Realm dùng email làm tên đăng
 * nhập, nên `nexa-nv01` thực ra là `nexa-nv01@staff.nexaticket.invalid` bên Keycloak — `.invalid`
 * là đuôi dành riêng (RFC 2606), không bao giờ có hộp thư thật. Nhân viên chỉ gõ phần trước `@`.
 */
const staffLoginDomain = process.env.EXPO_PUBLIC_STAFF_LOGIN_DOMAIN ?? 'staff.nexaticket.invalid';

export type StaffLoginFailure = 'credentials' | 'disabled' | 'throttled' | 'network' | 'unknown';

/** Đăng nhập không thành; `reason` để màn hình nói đúng câu cho nhân viên. */
export class StaffLoginError extends Error {
  constructor(readonly reason: StaffLoginFailure) {
    super(reason);
  }
}

export function staffKeycloakUsername(username: string): string {
  const trimmed = username.trim().toLowerCase();
  return trimmed.includes('@') ? trimmed : `${trimmed}@${staffLoginDomain}`;
}

/**
 * Đăng nhập nhân viên bằng tên đăng nhập + mã PIN (grant `password` của client `mobile-staff`).
 *
 * Chỉ dùng cho tài khoản nhân viên do ban tổ chức cấp. Tài khoản email (ban tổ chức) vẫn đăng
 * nhập qua trình duyệt — PKCE, không để app chạm vào mật khẩu của họ.
 */
export async function signInWithStaffPin(username: string, pin: string) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    username: staffKeycloakUsername(username),
    password: pin,
    scope: 'openid profile email',
  });
  let response: Response;
  try {
    response = await fetch(discovery.tokenEndpoint as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch {
    throw new StaffLoginError('network');
  }
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !payload?.access_token) {
    const description = String(payload?.error_description ?? '').toLowerCase();
    // Keycloak phân biệt ba trường hợp bằng câu chữ của `error_description`, không bằng mã lỗi.
    if (description.includes('temporarily')) throw new StaffLoginError('throttled');
    if (description.includes('disabled')) throw new StaffLoginError('disabled');
    if (payload?.error === 'invalid_grant') throw new StaffLoginError('credentials');
    throw new StaffLoginError('unknown');
  }
  await saveAuthResponse(
    new AuthSession.TokenResponse({
      accessToken: String(payload.access_token),
      tokenType: 'bearer',
      expiresIn: typeof payload.expires_in === 'number' ? payload.expires_in : undefined,
      refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
      idToken: typeof payload.id_token === 'string' ? payload.id_token : undefined,
      scope: typeof payload.scope === 'string' ? payload.scope : undefined,
    }),
  );
}

export async function signOutMobile() {
  const token = refreshToken;
  await clearMobileSession();

  if (token && discovery.revocationEndpoint) {
    await AuthSession.revokeAsync(
      { clientId, token, tokenTypeHint: AuthSession.TokenTypeHint.RefreshToken },
      discovery,
    ).catch(() => undefined);
  }
}

async function clearMobileSession() {
  accessToken = null;
  accessTokenExpiresAt = 0;
  refreshToken = null;
  if (Platform.OS !== 'web') {
    await SecureStore.deleteItemAsync(refreshTokenKey).catch(() => undefined);
  }
}
export interface MobileIdentity {
  name: string | null;
  email: string | null;
}

/**
 * Tên + email của người đang đăng nhập, đọc từ claim trong access token Keycloak.
 *
 * Chỉ để HIỂN THỊ — không xác thực chữ ký (backend làm việc đó ở mọi request). Không gọi thêm API
 * nào: token đã có sẵn `name`, `email`, `preferred_username` nhờ scope `profile email`.
 */
export async function getMobileIdentity(): Promise<MobileIdentity | null> {
  const token = await getMobileAccessToken();
  if (!token) return null;
  try {
    const segment = token.split('.')[1] ?? '';
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=');
    const json = decodeURIComponent(
      Array.from(atob(base64), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
    const claims = JSON.parse(json) as { name?: string; email?: string; preferred_username?: string };
    return {
      name: claims.name?.trim() || claims.preferred_username || null,
      email: claims.email ?? null,
    };
  } catch {
    return null;
  }
}
