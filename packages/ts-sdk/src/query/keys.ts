/**
 * Query key tập trung một chỗ.
 *
 * Gõ tay mảng key ở từng màn là cách chắc chắn nhất để `invalidateQueries` sau mutation trượt
 * mục tiêu: bảng vẫn hiện dữ liệu cũ và không ai biết vì sao.
 */
export const queryKeys = {
  identity: {
    myOrganizations: () => ['identity', 'me', 'organizations'] as const,
    organization: (organizationId: string) =>
      ['identity', 'organizations', organizationId] as const,
    members: (organizationId: string) =>
      ['identity', 'organizations', organizationId, 'members'] as const,
    platformOrganizations: (params: { limit: number; offset: number }) =>
      ['identity', 'platform', 'organizations', params] as const,
  },
  inventory: {
    seatMap: (eventSessionId: string) =>
      ['inventory', 'sessions', eventSessionId, 'seats'] as const,
  },
  ledger: {
    trialBalance: () => ['ledger', 'trial-balance'] as const,
    organizationBalance: (organizationId: string) =>
      ['ledger', 'organizations', organizationId, 'balance'] as const,
  },
} as const;

/**
 * Thời gian dữ liệu còn được coi là tươi (plan/frontend.md §5).
 *
 * `SEAT_MAP: 0` không phải cho vui: tồn kho ghế cũ vài giây là bán trùng. Sơ đồ chỗ cập nhật chủ
 * yếu qua WebSocket, còn `GET` dùng để khởi tạo và để refetch khi lệch version.
 */
export const staleTime = {
  PUBLIC_CATALOG: 60_000,
  SEAT_MAP: 0,
  ADMIN_TABLE: 30_000,
} as const;
