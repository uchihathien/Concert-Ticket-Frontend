/**
 * Hợp đồng của `identity-service` — chép từ record Java ở `interfaces/rest`, không suy diễn.
 *
 * Nguồn: `OrganizationController`, `PlatformOrganizationController`, `MemberView`,
 * `CreateOrganization`.
 */

/** `com.nexaticket.kernel.access.Role`. */
export type Role =
  'SUPER_ADMIN' | 'ORG_OWNER' | 'ORG_ADMIN' | 'EVENT_MANAGER' | 'CHECKIN_STAFF' | 'CUSTOMER';

/** Vai trò gán được cho thành viên của một tổ chức (SUPER_ADMIN và CUSTOMER không thuộc tổ chức). */
export const ORGANIZATION_ROLES = [
  'ORG_OWNER',
  'ORG_ADMIN',
  'EVENT_MANAGER',
  'CHECKIN_STAFF',
] as const satisfies ReadonlyArray<Role>;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

/** `OrganizationStatus`. */
export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED';

export interface OrganizationSummary {
  id: string;
  slug: string;
  name: string;
  status: OrganizationStatus;
  memberCount: number;
}

/**
 * `MemberView`. `joinedAt` là `Instant.toString()` (ISO-8601 UTC).
 *
 * `email` và `fullName` có thể `null` — backend khai `@JsonInclude(ALWAYS)` cho record này đúng để
 * chúng là `null` tường minh chứ không biến mất khỏi JSON. Một bảng thành viên chỉ toàn UUID thì
 * không ai biết mình đang gỡ nhầm ai, nên hai trường này là thứ màn hình phải hiện.
 */
export interface Member {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: Role;
  joinedAt: string;
}

export interface InviteMemberRequest {
  email: string;
  role: OrganizationRole;
}

/** Token chỉ trả về đúng một lần, để notification-service gửi email. */
export interface InvitationCreated {
  email: string;
  role: Role;
  token: string;
}

export interface CreateOrganizationProfile {
  legalName?: string;
  taxCode?: string;
  representativeName?: string;
  contactPhone?: string;
  note?: string;
}

export interface CreateOrganizationRequest {
  name: string;
  /** Bỏ trống thì backend sinh từ `name`. */
  slug?: string;
  ownerEmail: string;
  profile?: CreateOrganizationProfile;
}

export interface CreatedOrganization {
  id: string;
  slug: string;
  name: string;
  status: OrganizationStatus;
  ownerEmail: string;
  /** Token thô của lời mời chủ sở hữu — chỉ có ở response này, không đọc lại được. */
  invitationToken: string;
}

/* ---------------------------------------------------------------------------
 * Phân quyền
 *
 * Chép từ `com.nexaticket.kernel.access.Permission` và `AccessQueries`. Frontend hỏi QUYỀN, không
 * hỏi tên vai trò: danh sách vai trò nào được làm gì là việc của ma trận ở backend, và một câu
 * `role === 'ORG_ADMIN' || role === 'ORG_OWNER'` viết trong app là bản sao thứ hai của ma trận đó
 * — đặt ở nơi backend không thấy, nên nó sẽ lệch mà không ai biết.
 * ------------------------------------------------------------------------- */

export type Permission =
  | 'CATALOG_MANAGE'
  | 'EVENT_PUBLISH'
  | 'CHECKIN_SCAN'
  | 'ORG_METRICS_VIEW'
  | 'ORG_MEMBERS_MANAGE'
  | 'ORG_PROFILE_MANAGE'
  | 'ORG_LIMITS_SET'
  | 'ORG_SESSION_REVOKE'
  | 'ORG_AUDIT_READ'
  | 'PLATFORM_ORG_MANAGE'
  | 'PLATFORM_TEMPLATE_MANAGE'
  | 'PLATFORM_USER_MANAGE'
  | 'PLATFORM_FINANCE_VIEW'
  | 'PLATFORM_AUDIT_READ';

/** `AccessQueries.RoleView` — một dòng của ma trận. */
export interface RoleView {
  role: Role;
  scope: 'ORGANIZATION' | 'GLOBAL';
  permissions: Permission[];
}

/**
 * `AccessQueries.MyPermissions`.
 *
 * `organizations` khoá theo id tổ chức. Superadmin không phải thành viên của tổ chức nào nên
 * `organizations` của họ rỗng — quyền của họ nằm ở `platformPermissions`.
 */
export interface MyPermissions {
  userId: string;
  superAdmin: boolean;
  platformPermissions: Permission[];
  organizations: Record<string, Permission[]>;
}

/** `InvitationView` — cố ý KHÔNG có token, kể cả dạng hash. */
export interface PendingInvitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  expired: boolean;
}

/** Invitation metadata visible only to its authenticated recipient. */
export interface MyInvitation {
  id: string;
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
  expiresAt: string;
  expired: boolean;
}

/**
 * `GrantMembershipHandler.Result`.
 *
 * Hai kết quả, và đó là hệ quả của việc Keycloak giữ danh tính: người đã từng đăng nhập thì gắn
 * được ngay (`GRANTED`); người chưa từng thì phía ta chưa có bản ghi nào để gắn membership vào,
 * nên rơi về lời mời (`INVITED`).
 */
export interface GrantMemberResult {
  outcome: 'GRANTED' | 'INVITED';
  email: string;
  role: Role;
  userId: string | null;
  invitationToken: string | null;
}

export interface GrantMemberRequest {
  email: string;
  role: OrganizationRole;
}

/**
 * `AuditQueries.AuditEntry`.
 *
 * `beforeState` / `afterState` là JSON đã parse sẵn, hình dạng khác nhau theo từng hành động — ép
 * tất cả vào một kiểu chung sẽ mất chính những chi tiết mà người đọc nhật ký đang tìm.
 */
export interface AuditEntry {
  id: string;
  actorUserId: string | null;
  organizationId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  correlationId: string | null;
  createdAt: string;
}

export interface AuditLogParams {
  /** Lọc theo tên hành động, ví dụ `MEMBER_ROLE_CHANGED`. Bỏ trống thì lấy hết. */
  action?: string | null;
  /**
   * ISO-8601. Mốc sớm nhất.
   *
   * Lọc ở **server**, không ở client: nhật ký phân trang ở backend, nên một bộ lọc client-side chỉ
   * lọc trong trang đang xem — trông như tìm kiếm nhưng nói dối về phần còn lại.
   */
  from?: string | null;
  /** ISO-8601, **không** lấy mốc này: "hôm nay" và "hôm qua" không được cùng trả về một dòng. */
  to?: string | null;
  limit?: number;
  offset?: number;
}

/* ---------------------------------------------------------------------------
 * Thêm thành viên đã đăng ký — `/v1/organizations/{id}/members`
 *
 * Nguồn: `OrganizationController`, `AddMemberHandler`.
 *
 * Hệ thống KHÔNG tạo tài khoản hộ: nhân viên tự đăng ký NexaTicket như khách, rồi ban tổ chức tìm
 * đúng email hoặc số điện thoại của họ và thêm vào tổ chức với một vai.
 * ------------------------------------------------------------------------- */

/**
 * Một tài khoản tìm thấy theo email/SĐT chính xác. Email và SĐT đã bị che một phần — đủ để người
 * thêm nhận ra đúng người, không hơn.
 *
 * Không tìm thấy thì API trả `ApiError` 404 `USER_NOT_REGISTERED`; nhiều tài khoản cùng SĐT thì 409
 * `CONTACT_AMBIGUOUS`.
 */
export interface MemberCandidate {
  userId: string;
  fullName: string | null;
  maskedEmail: string | null;
  maskedPhone: string | null;
  alreadyMember: boolean;
  /** Vai hiện tại trong tổ chức này, `null` nếu chưa là thành viên. */
  currentRole: Role | null;
}

export interface AddMemberRequest {
  /** Email hoặc số điện thoại, đúng như người đó đã đăng ký. */
  contact: string;
  role: OrganizationRole;
}

/* ---------------------------------------------------------------------------
 * Phân công soát vé — `/v1/organizations/{id}/staff`
 *
 * Nguồn: `StaffController`, `StaffQueries`, `CheckinAssignmentHandler`; dữ liệu phân công nằm ở
 * ticketing-service.
 *
 * Mỗi dòng là một thành viên vai Staff (`CHECKIN_STAFF`). Phân công tự hết hạn khi suất cuối trong
 * phạm vi được gán kết thúc quá 6 giờ; phân công hết hạn vẫn trả về để xem lịch sử.
 * ------------------------------------------------------------------------- */

/**
 * Trạng thái tài khoản của dòng. Thành viên thêm theo cách mới luôn `ACTIVE`; ba trạng thái kia chỉ
 * còn gặp ở nhân viên được mời bằng email theo luồng cũ (đã ngừng).
 */
export type StaffStatus = 'INVITED' | 'ACTIVE' | 'EXPIRED' | 'SEND_FAILED';

/** `UNKNOWN` khi backend chưa đọc được lịch diễn để tính hạn. */
export type CheckinAssignmentStatus = 'UPCOMING' | 'ONGOING' | 'EXPIRED' | 'UNKNOWN';

export interface StaffAssignment {
  eventId: string;
  /** `null` khi gán cả sự kiện (mọi suất, kể cả suất thêm sau). */
  eventSessionId: string | null;
  eventTitle: string | null;
  /** Giờ bắt đầu của suất đầu tiên trong phạm vi được gán. */
  startsAt: string | null;
  /** Hết hiệu lực lúc này — suất cuối kết thúc + 6 giờ. */
  expiresAt: string | null;
  status: CheckinAssignmentStatus;
}

export interface StaffMember {
  userId: string;
  email: string | null;
  fullName: string | null;
  status: StaffStatus;
  /** `null` với nhân viên không đến từ lời mời bằng email. */
  invitedAt: string | null;
  invitedBy: string | null;
  expiresAt: string | null;
  activatedAt: string | null;
  /** Sự kiện của các phân công CÒN HIỆU LỰC. */
  eventIds: string[];
  /** Mọi phân công, kể cả đã hết hạn. */
  assignments: StaffAssignment[];
}

/** Một mục cần gán. Bỏ trống `eventSessionId` là gán cả sự kiện. */
export interface AssignmentTarget {
  eventId: string;
  eventSessionId?: string | null;
}

/**
 * Phân công còn hiệu lực của CHÍNH người gọi trong một tổ chức — màn đầu tiên của app Staff.
 * Nguồn: ticketing `GET /v1/organizations/{id}/checkin-assignments/me`.
 *
 * `restricted: false` nghĩa là người gọi quản lý được sự kiện của tổ chức nên soát mọi suất; khi
 * đó `assignments` rỗng.
 */
export interface MyCheckinAssignments {
  restricted: boolean;
  assignments: MyCheckinAssignment[];
}

export interface MyCheckinAssignment {
  eventId: string;
  eventSessionId: string | null;
  eventTitle: string | null;
  venueName: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  status: CheckinAssignmentStatus;
  /** Các suất trong phạm vi được gán, sớm nhất trước. */
  sessions: { eventSessionId: string; startsAt: string; endsAt: string | null }[];
}

/**
 * @deprecated dùng `MyCheckinAssignments` — bản này không có hạn và không gán theo suất.
 */
export interface MyCheckinEvents {
  restricted: boolean;
  eventIds: string[];
}
