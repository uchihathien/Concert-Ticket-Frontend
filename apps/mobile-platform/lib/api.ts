import { createApiClient } from '@nexaticket/ts-sdk';
import { publicEnv } from './env';
import { getMobileAccessToken } from './auth-session';

const baseUrl = publicEnv(process.env.EXPO_PUBLIC_API_BASE_URL, {
  name: 'EXPO_PUBLIC_API_BASE_URL',
  devFallback: 'http://localhost:8080',
});
export const api = createApiClient({ baseUrl, getAccessToken: getMobileAccessToken });