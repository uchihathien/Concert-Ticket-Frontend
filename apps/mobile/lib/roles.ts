import { getMyPendingInvitations, getMyPermissions } from '@nexaticket/ts-sdk';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api } from './api';

/** Một vai = một nhóm màn hình trong `app/`. */
export type AppRole = 'customer' | 'organizer' | 'platform' | 'scanner';

const activeRoleKey = 'nexaticket.mobile.active-role';
const allRoles: readonly AppRole[] = ['customer', 'organizer', 'platform', 'scanner'];

export const ROLE_HOME = {
  customer: '/',
  organizer: '/organizer',
  platform: '/platform',
  scanner: '/scanner',
} as const satisfies Record<AppRole, string>;

export const ROLE_LABEL: Record<AppRole, { title: string; detail: string }> = {
  customer: { title: 'Khách mua vé', detail: 'Khám phá sự kiện, đặt vé và xem vé của bạn.' },
  organizer: { title: 'Ban tổ chức', detail: 'Theo dõi doanh thu, sự kiện và hỗ trợ khách tại cổng.' },
  platform: { title: 'Quản trị nền tảng', detail: 'Tổ chức, nhật ký, sổ cái và hỗ trợ.' },
  scanner: { title: 'Soát vé', detail: 'Chọn suất được giao và quét vé tại cổng.' },
};

/**
 * Vai của tài khoản đang đăng nhập, suy từ `/v1/me/permissions`.
 *
 * Hỏi QUYỀN chứ không hỏi tên vai trò — cùng nguyên tắc với `MyPermissions` trong ts-sdk: realm role
 * của Keycloak chỉ có `ORG_MEMBER` cho cả ban tổ chức lẫn nhân viên soát vé, nên JWT không phân biệt
 * được hai vai đó.
 *
 * Tài khoản có quyền nền tảng hoặc quyền trong tổ chức KHÔNG được vai khách mua vé. Lời mời đang chờ
 * mở thêm vai soát vé vì màn soát vé là nơi nhân viên chấp nhận lời mời.
 */
export async function resolveRoles(): Promise<AppRole[]> {
  const [permissions, invitations] = await Promise.all([
    getMyPermissions(api),
    getMyPendingInvitations(api).catch(() => []),
  ]);
  const organizations = Object.values(permissions.organizations);
  const roles: AppRole[] = [];

  if (permissions.superAdmin || permissions.platformPermissions.length > 0) roles.push('platform');
  if (organizations.some((granted) => granted.includes('CATALOG_MANAGE'))) roles.push('organizer');
  if (organizations.some((granted) => granted.includes('CHECKIN_SCAN'))) roles.push('scanner');

  if (roles.length === 0) {
    roles.push('customer');
    if (invitations.length > 0) roles.push('scanner');
  }
  return roles;
}

export async function loadActiveRole(): Promise<AppRole | null> {
  if (Platform.OS === 'web') return null;
  const stored = await SecureStore.getItemAsync(activeRoleKey).catch(() => null);
  return allRoles.find((role) => role === stored) ?? null;
}

export async function saveActiveRole(role: AppRole | null) {
  if (Platform.OS === 'web') return;
  if (role) await SecureStore.setItemAsync(activeRoleKey, role).catch(() => undefined);
  else await SecureStore.deleteItemAsync(activeRoleKey).catch(() => undefined);
}
