import { getMyPendingInvitations, getMyPermissions } from '@nexaticket/ts-sdk';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api } from './api';
import { storageKey } from './app-variant';

/**
 * Một vai = một nhóm màn hình trong `app/`. Quản trị nền tảng chỉ làm trên web, nên không có ở đây.
 *
 * Bản NexaTicket chỉ mở `customer`; bản NexaTicket Staff chỉ mở `organizer` và `scanner`.
 */
export type AppRole = 'customer' | 'organizer' | 'scanner';

const activeRoleKey = storageKey('active-role');
const allRoles: readonly AppRole[] = ['customer', 'organizer', 'scanner'];

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
  // Quyền nền tảng không mở vai nào trên điện thoại, nhưng vẫn chặn vai khách như trước: tài khoản
  // quản trị không phải tài khoản mua vé.
  const platformAccount = permissions.superAdmin || permissions.platformPermissions.length > 0;

  if (organizations.some((granted) => granted.includes('CATALOG_MANAGE'))) roles.push('organizer');
  if (organizations.some((granted) => granted.includes('CHECKIN_SCAN'))) roles.push('scanner');

  if (roles.length === 0 && !platformAccount) {
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
