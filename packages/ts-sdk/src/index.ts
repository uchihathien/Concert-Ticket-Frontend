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

export * from './types/catalog';
export * from './types/identity';
export * from './types/analytics';
export * from './types/inventory';
export * from './types/ledger';
export * from './types/ordering';
export * from './types/dashboard';
export * from './types/floor-plan';
export * from './types/media';
export * from './types/public-catalog';
export * from './types/support';
export * from './types/ticketing';

export {
  acceptInvitation,
  activateOrganization,
  changeMemberRole,
  createOrganization,
  getAuditLogs,
  getMembers,
  getMyOrganizations,
  getMyPermissions,
  getOrganization,
  getPendingInvitations,
  getPlatformAuditLogs,
  getRoles,
  grantMember,
  inviteMember,
  listPlatformOrganizations,
  removeMember,
  renameOrganization,
  revokeInvitation,
  revokeMemberSessions,
  sendMemberPasswordReset,
  suspendOrganization,
} from './api/identity';
export {
  createEvent,
  createSession,
  createTicketType,
  createVenue,
  createZone,
  deleteSession,
  deleteTicketType,
  getEvent,
  listEvents,
  listVenues,
  publishEvent,
  unpublishEvent,
  updateEvent,
  updateSession,
  updateTicketType,
} from './api/catalog';
export { getPublicEvent, listPublicEvents } from './api/public-catalog';
export { getPublicFloorPlan, getVenueFloorPlan } from './api/floor-plan';
export { getEventMasterData, getOrganizationDashboard } from './api/dashboard';
export { searchOrganizationTickets } from './api/organization-tickets';
export { requestPosterUpload, uploadPoster } from './api/media';
export {
  addKnowledgeChunk,
  askSupport,
  claimHandoff,
  deleteKnowledgeChunk,
  getChatThread,
  getEventRules,
  getHandoffThread,
  listHandoffs,
  listKnowledgeChunks,
  previewKnowledge,
  replyToHandoff,
  requestHumanAgent,
  resolveHandoff,
  saveEventRules,
} from './api/support';
export { listMyTickets, listOrderTickets, scanTicket } from './api/ticketing';
export { cancelOrder, getOrder, listMyOrders, placeOrder } from './api/ordering';
export { fetchOrganizationSales } from './api/analytics';
export { fetchSeatMap, placeHold, releaseHold } from './api/inventory';
export type { SeatMapSnapshot } from './api/inventory';
export { getOrganizationBalance, getTrialBalance } from './api/ledger';

export {
  useAcceptInvitation,
  useAuditLogs,
  useChangeMemberRole,
  useCreateOrganization,
  useGrantMember,
  useHasPermission,
  useInviteMember,
  useMyOrganizations,
  useMyPermissions,
  useOrganization,
  useOrganizationLifecycle,
  useOrganizationMembers,
  usePendingInvitations,
  usePlatformAuditLogs,
  usePlatformOrganizations,
  useRemoveMember,
  useRenameOrganization,
  useRevokeInvitation,
  useRevokeMemberSessions,
  useRoles,
  useSendMemberPasswordReset,
} from './hooks/identity';
export {
  useAdminEvent,
  useAdminEvents,
  useCreateEvent,
  useCreateSession,
  useCreateTicketType,
  useCreateVenue,
  useCreateZone,
  useDeleteSession,
  useDeleteTicketType,
  usePublishEvent,
  useUpdateEvent,
  useUpdateSession,
  useUpdateTicketType,
  useVenues,
} from './hooks/catalog';
export { usePublicFloorPlan, useVenueFloorPlan } from './hooks/floor-plan';
export {
  useEventMasterData,
  useOrganizationDashboard,
  useOrganizationTickets,
} from './hooks/dashboard';
export {
  useAddKnowledgeChunk,
  useAskSupport,
  useChatThread,
  useClaimHandoff,
  useHandoffQueue,
  useHandoffThread,
  useReplyToHandoff,
  useRequestHumanAgent,
  useDeleteKnowledgeChunk,
  useEventRules,
  useKnowledgeChunks,
  useKnowledgePreview,
  useResolveHandoff,
  useSaveEventRules,
} from './hooks/support';
export { useMyTickets, useOrderTickets, useScanTicket } from './hooks/ticketing';
export { useCancelOrder, useMyOrders, useOrder } from './hooks/ordering';
export { useOrganizationSales } from './hooks/analytics';
export { usePlaceHold, useReleaseHold, useSeatMap } from './hooks/inventory';
export type { PlaceHoldInput, UseSeatMapOptions } from './hooks/inventory';
export { useOrganizationBalance, useTrialBalance } from './hooks/ledger';
