import { createApiClient } from '@nexaticket/ts-sdk';
import { getScannerAccessToken } from './auth-session';
import { publicEnv } from './env';

const baseUrl = publicEnv(process.env.EXPO_PUBLIC_API_BASE_URL, {
  name: 'EXPO_PUBLIC_API_BASE_URL',
  devFallback: 'http://localhost:8080',
});

export const api = createApiClient({ baseUrl, getAccessToken: getScannerAccessToken });
