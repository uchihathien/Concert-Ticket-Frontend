import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { publicEnv } from './env';

const issuer = publicEnv(process.env.EXPO_PUBLIC_KEYCLOAK_ISSUER, {
  name: 'EXPO_PUBLIC_KEYCLOAK_ISSUER',
  devFallback: 'http://localhost:8081/realms/nexaticket',
}).replace(/\/+$/, '');

const clientId = publicEnv(process.env.EXPO_PUBLIC_MOBILE_OIDC_CLIENT_ID, {
  name: 'EXPO_PUBLIC_MOBILE_OIDC_CLIENT_ID',
  devFallback: 'mobile-scanner',
});
const refreshTokenKey = 'nexaticket.mobile-scanner.refresh-token';

// Redirect URI là chỗ DUY NHẤT phải khớp từng ký tự với Keycloak, nên nó KHÔNG đi qua publicEnv:
// khi biến trống, `makeRedirectUri` tự dựng đúng địa chỉ cho môi trường đang chạy — `exp://<IP>:<cổng>/--/auth`
// dưới Expo Go, `nexaticket-scanner://auth` trong bản build thật. Đó là một mặc định ĐÚNG, không phải
// mặc định của máy phát triển lọt lên production, nên ném lỗi ở đây sẽ chặn một trường hợp vốn chạy được.
export const redirectUri =
  process.env.EXPO_PUBLIC_OIDC_REDIRECT_URI?.trim() ||
  AuthSession.makeRedirectUri({ scheme: 'nexaticket-scanner', path: 'auth' });

export const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `${issuer}/protocol/openid-connect/auth`,
  tokenEndpoint: `${issuer}/protocol/openid-connect/token`,
  revocationEndpoint: `${issuer}/protocol/openid-connect/revoke`,
  endSessionEndpoint: `${issuer}/protocol/openid-connect/logout`,
};

export const scannerClientId = clientId;

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

export async function restoreScannerSession() {
  if (Platform.OS === 'web') return false;
  refreshToken = await SecureStore.getItemAsync(refreshTokenKey);
  if (!refreshToken) return false;
  return Boolean(await getScannerAccessToken());
}

export async function getScannerAccessToken(): Promise<string | null> {
  if (accessToken && accessTokenExpiresAt > Date.now() + 30_000) return accessToken;
  if (!refreshToken || Platform.OS === 'web') return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = AuthSession.refreshAsync({ clientId, refreshToken }, discovery)
    .then(async (response) => {
      await saveAuthResponse(response);
      return accessToken;
    })
    .catch(async (error: unknown) => {
      if ((error as { code?: string } | null)?.code === 'invalid_grant') {
        await clearScannerSession();
      }
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export async function exchangeScannerCode(code: string, codeVerifier: string) {
  const response = await AuthSession.exchangeCodeAsync(
    { clientId, code, redirectUri, extraParams: { code_verifier: codeVerifier } },
    discovery,
  );
  await saveAuthResponse(response);
}

export async function signOutScanner() {
  const token = refreshToken;
  await clearScannerSession();
  if (token && discovery.revocationEndpoint) {
    await AuthSession.revokeAsync(
      { clientId, token, tokenTypeHint: AuthSession.TokenTypeHint.RefreshToken },
      discovery,
    ).catch(() => undefined);
  }
}

async function clearScannerSession() {
  accessToken = null;
  accessTokenExpiresAt = 0;
  refreshToken = null;
  if (Platform.OS !== 'web') {
    await SecureStore.deleteItemAsync(refreshTokenKey).catch(() => undefined);
  }
}