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

/** `MemberView` — cả ba trường đều là chuỗi; `joinedAt` là `Instant.toString()` (ISO-8601 UTC). */
export interface Member {
  userId: string;
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
