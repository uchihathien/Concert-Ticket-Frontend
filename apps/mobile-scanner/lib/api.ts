import { createApiClient } from '@nexaticket/ts-sdk';
import { getScannerAccessToken } from './auth-session';

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const api = createApiClient({ baseUrl, getAccessToken: getScannerAccessToken });