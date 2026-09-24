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
    invitations: (organizationId: string) =>
      ['identity', 'organizations', organizationId, 'invitations'] as const,
    // Ma trận vai trò là hằng số của hệ thống: một khoá duy nhất, không tham số.
    roles: () => ['identity', 'roles'] as const,
    myPermissions: () => ['identity', 'me', 'permissions'] as const,
    auditLogs: (organizationId: string, params: { action: string | null; limit: number; offset: number }) =>
      ['identity', 'organizations', organizationId, 'audit-logs', params] as const,
    platformAuditLogs: (params: { action: string | null; limit: number; offset: number }) =>
      ['identity', 'platform', 'audit-logs', params] as const,
  },
  catalog: {
    venues: (organizationId: string) =>
      ['catalog', 'organizations', organizationId, 'venues'] as const,
    events: (organizationId: string) =>
      ['catalog', 'organizations', organizationId, 'events'] as const,
    event: (organizationId: string, eventId: string) =>
      ['catalog', 'organizations', organizationId, 'events', eventId] as const,
    dashboard: (organizationId: string) =>
      ['catalog', 'organizations', organizationId, 'dashboard'] as const,
    masterData: (organizationId: string, eventId: string) =>
      ['catalog', 'organizations', organizationId, 'events', eventId, 'master-data'] as const,
    venueFloorPlan: (organizationId: string, venueId: string) =>
      ['catalog', 'organizations', organizationId, 'venues', venueId, 'floor-plan'] as const,
    // Không mang organizationId: mặt bằng công khai tra theo slug và ai cũng thấy cùng một bản.
    publicFloorPlan: (slug: string) => ['catalog', 'public', 'events', slug, 'floor-plan'] as const,
  },
  inventory: {
    seatMap: (eventSessionId: string) =>
      ['inventory', 'sessions', eventSessionId, 'seats'] as const,
  },
  ordering: {
    myOrders: (params: { limit: number; offset: number }) =>
      ['ordering', 'me', 'orders', params] as const,
    order: (orderId: string) => ['ordering', 'orders', orderId] as const,
  },
  ticketing: {
    myTickets: (params: { limit: number; offset: number }) =>
      ['ticketing', 'me', 'tickets', params] as const,
    orderTickets: (orderId: string) => ['ticketing', 'orders', orderId, 'tickets'] as const,
    // Cả bộ lọc nằm trong khoá: đổi một tiêu chí là một truy vấn khác, và react-query phải coi nó
    // là một mục cache khác chứ không phải cùng một mục vừa cũ đi.
    organizationTickets: (organizationId: string, params: object) =>
      ['ticketing', 'organizations', organizationId, 'tickets', params] as const,
  },
  support: {
    thread: (sessionId: string) => ['support', 'sessions', sessionId, 'messages'] as const,
    queue: (params: object) => ['support', 'handoffs', params] as const,
    handoff: (handoffId: string) => ['support', 'handoffs', handoffId] as const,
    knowledge: (params: object) => ['support', 'knowledge', params] as const,
    // Câu hỏi nằm trong khoá: mỗi câu là một phép thử khác, không phải cùng một kết quả vừa cũ đi.
    knowledgePreview: (question: string) => ['support', 'knowledge', 'preview', question] as const,
    eventRules: (eventId: string) => ['support', 'knowledge', 'rules', eventId] as const,
  },
  analytics: {
    organizationSales: (organizationId: string) =>
      ['analytics', 'organizations', organizationId, 'sales'] as const,
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
  /**
   * Hình dạng khán phòng.
   *
   * Dài hơn hẳn `SEAT_MAP` dù hai thứ nằm cạnh nhau trên cùng màn hình chọn chỗ: trạng thái ghế
   * đổi từng giây lúc mở bán, còn mặt bằng chỉ đổi khi ban tổ chức rút sự kiện xuống rồi publish
   * lại. Dùng chung một nhịp là kéo lại hình học không đổi ở mỗi lần một ghế được giữ.
   */
  FLOOR_PLAN: 600_000,
  /**
   * Hội thoại hỗ trợ.
   *
   * Ngắn vì dữ liệu này đổi do NGƯỜI KHÁC — người trực trả lời, hoặc khách nhắn thêm. Khác mọi
   * mục còn lại ở đây, vốn chỉ đổi do chính người đang xem.
   */
  SUPPORT_THREAD: 2_000,
  ADMIN_TABLE: 30_000,
  /**
   * Ví vé và đơn hàng của chính mình.
   *
   * Ngắn hơn bảng quản trị vì hai màn này là nơi khách quay lại ngay sau khi chuyển khoản để xem
   * đơn đã sang PAID chưa — dữ liệu cũ nửa phút ở đây đọc như thể tiền chưa tới.
   */
  MY_WALLET: 10_000,
} as const;
