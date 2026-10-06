/**
 * `@nexaticket/ts-sdk` — client gọi api-gateway.
 *
 * SDK gom các client REST đã được xác nhận từ API contract của NexaTicket; không tự suy đoán
 * schema cho endpoint chưa có controller.
 */

export { ApiError, networkError } from './http/api-error';
export type { ApiErrorBody } from './http/api-error';

export { resolveApiBaseUrl } from './http/base-url';
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
export * from './types/seating';
export * from './types/public-catalog';
export * from './types/support';
export * from './types/ticketing';

export {
  acceptInvitation,
  acceptMyInvitation,
  activateOrganization,
  changeMemberRole,
  createOrganization,
  getAuditLogs,
  getMembers,
  getMyOrganizations,
  getMyPendingInvitations,
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
export { getPublicEvent, listPublicEvents, listTrendingEvents } from './api/public-catalog';
export { getPublicFloorPlan, getVenueFloorPlan } from './api/floor-plan';
export { getEventMasterData, getOrganizationDashboard } from './api/dashboard';
export { searchOrganizationTickets } from './api/organization-tickets';
export { requestPosterUpload, uploadPoster } from './api/media';
export {
  configureVenueZones,
  getSeatMapImages,
  previewFloorPlan,
  setEventSeatMapImage,
  setVenueSeatMapImage,
} from './api/seating';
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
export {
  listCheckinSessions,
  listMyTickets,
  listOrderTickets,
  scanTicket,
  scanTicketForOrganization,
} from './api/ticketing';
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
  useBulkTicketTypes,
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
  useConfigureVenueZones,
  useFloorPlanPreview,
  useSeatMapImages,
  useSetSeatMapImage,
} from './hooks/seating';
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
