import { isStaffApp } from '@/lib/app-variant';

/**
 * Deep link `nexaticket-staff://login?u=…&p=…` (mã QR trên phiếu nhân viên) mở màn đăng nhập nhân
 * viên kèm sẵn tên đăng nhập và PIN. Màn đó tên là `staff-login` chứ không phải `login`, vì `/login`
 * đã là màn đăng nhập của khách trong nhóm (customer).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  if (!isStaffApp) return path;
  const query = /(?:^|[/:])login\?([^#]*)/.exec(path);
  if (query && !path.includes('staff-login')) return `/staff-login?${query[1]}`;
  return path;
}
