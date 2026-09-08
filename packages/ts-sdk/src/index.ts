/**
 * `@nexaticket/ts-sdk` — client gọi api-gateway.
 *
 * Phạm vi hiện tại đúng bằng phần backend đã có REST: identity, inventory, ledger. Catalog,
 * ordering, payment, ticketing chưa expose controller nào, nên ở đây cũng chưa có gì —
 * cố tình để trống thay vì đoán hình dạng JSON rồi phải sửa lại.
 */

export { ApiError, networkError } from './http/api-error';
export type { ApiErrorBody } from './http/api-error';

export { ApiClient, createApiClient } from './http/client';
export type { ApiClientOptions, ApiResponse, RequestOptions } from './http/client';

export { newIdempotencyKey, useIdempotencyKey } from './http/idempotency';
export type { IdempotencyKeyHandle } from './http/idempotency';

export { createQueryClient, NexaQueryProvider, useApiClient } from './query/provider';
export type { NexaQueryProviderProps } from './query/provider';
export { queryKeys, staleTime } from './query/keys';

export * from './types/identity';
export * from './types/inventory';
export * from './types/ledger';

export {
  acceptInvitation,
  createOrganization,
  getMembers,
  getMyOrganizations,
  getOrganization,
  inviteMember,
  listPlatformOrganizations,
} from './api/identity';
export { fetchSeatMap, placeHold, releaseHold } from './api/inventory';
export type { SeatMapSnapshot } from './api/inventory';
export { getOrganizationBalance, getTrialBalance } from './api/ledger';

export {
  useAcceptInvitation,
  useCreateOrganization,
  useInviteMember,
  useMyOrganizations,
  useOrganization,
  useOrganizationMembers,
  usePlatformOrganizations,
} from './hooks/identity';
export { usePlaceHold, useReleaseHold, useSeatMap } from './hooks/inventory';
export type { PlaceHoldInput, UseSeatMapOptions } from './hooks/inventory';
export { useOrganizationBalance, useTrialBalance } from './hooks/ledger';
