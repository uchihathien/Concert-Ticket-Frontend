import { createTokenRoute } from '@nexaticket/auth';
import { nexaAuth } from '@/auth';

/**
 * Cửa duy nhất để JS phía client cầm access token.
 *
 * `force-dynamic` là bắt buộc: đây là response theo từng người dùng, cache nó là phát token của
 * người này cho người khác.
 */
export const dynamic = 'force-dynamic';

export const GET = createTokenRoute(nexaAuth);
