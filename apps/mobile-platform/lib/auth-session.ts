import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const issuer = (process.env.EXPO_PUBLIC_KEYCLOAK_ISSUER ?? 'http://localhost:8081/realms/nexaticket').replace(/\/$/, '');
const clientId = process.env.EXPO_PUBLIC_MOBILE_OIDC_CLIENT_ID ?? 'mobile-platform';
const refreshTokenKey = 'nexaticket.mobile-platform.refresh-token';

export const redirectUri = AuthSession.makeRedirectUri({ scheme: 'nexaticket-platform', path: 'auth' });
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
  accessTokenExpiresAt = response.expiresIn ? Date.now() + response.expiresIn * 1000 : Number.MAX_SAFE_INTEGER;
  if (response.refreshToken) {
    refreshToken = response.refreshToken;
    if (Platform.OS !== 'web') await SecureStore.setItemAsync(refreshTokenKey, response.refreshToken);
  }
}

export async function restoreMobileSession() {
  if (Platform.OS === 'web') return false;
  refreshToken = await SecureStore.getItemAsync(refreshTokenKey);
  return refreshToken ? Boolean(await getMobileAccessToken()) : false;
}

export async function getMobileAccessToken(): Promise<string | null> {
  if (accessToken && accessTokenExpiresAt > Date.now() + 30_000) return accessToken;
  if (!refreshToken || Platform.OS === 'web') return null;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = AuthSession.refreshAsync({ clientId, refreshToken }, discovery)
    .then(async (response) => { await saveAuthResponse(response); return accessToken; })
    .catch(async (error: unknown) => {
      if ((error as { code?: string } | null)?.code === 'invalid_grant') await clearMobileSession();
      return null;
    })
    .finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function exchangeMobileCode(code: string, codeVerifier: string) {
  const response = await AuthSession.exchangeCodeAsync(
    { clientId, code, redirectUri, extraParams: { code_verifier: codeVerifier } }, discovery,
  );
  await saveAuthResponse(response);
}

export async function signOutMobile() {
  const token = refreshToken;
  await clearMobileSession();
  if (token && discovery.revocationEndpoint) {
    await AuthSession.revokeAsync({ clientId, token, tokenTypeHint: AuthSession.TokenTypeHint.RefreshToken }, discovery)
      .catch(() => undefined);
  }
}

async function clearMobileSession() {
  accessToken = null;
  accessTokenExpiresAt = 0;
  refreshToken = null;
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(refreshTokenKey).catch(() => undefined);
}