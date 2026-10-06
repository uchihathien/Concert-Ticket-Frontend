import { createApiClient } from '@nexaticket/ts-sdk';
import { getMobileAccessToken } from './auth-session';

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const publicApi = createApiClient({ baseUrl });

export const api = createApiClient({
  baseUrl,
  getAccessToken: getMobileAccessToken,
});