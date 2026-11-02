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
 * Mọi tài khoản NexaTicket đều là tài khoản khách — kể cả Staff và ban tổ chức: nhân viên tự đăng ký
 * như khách rồi mới được thêm vào tổ chức, nên cùng một tài khoản vừa mua vé vừa soát vé. Chỉ tài
 * khoản quản trị NỀN TẢNG không có vai khách: đó không phải tài khoản mua vé. Lời mời đang chờ mở
 * thêm vai soát vé cho tài khoản chưa thuộc tổ chức nào, vì màn soát vé là nơi chấp nhận lời mời.
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
  if (roles.length === 0 && invitations.length > 0) roles.push('scanner');

  // Bản NexaTicket chỉ chặn tài khoản thực sự không có vai khách — quản trị nền tảng.
  if (!platformAccount) roles.push('customer');
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
