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
  limit?: number;
  offset?: number;
}
