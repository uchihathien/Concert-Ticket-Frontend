import type { BadgeTone } from './components/Badge';

/**
 * Nhãn tiếng Việt cho vai trò.
 *
 * Ở đây chứ không ở từng app: A-MEMBERS (`web-admin`) và P-ORG (`web-platform`) hiện cùng những
 * vai trò đó cho cùng những con người đó. Hai bản chép tay là hai chỗ để một cái tên dịch lệch, và
 * người dùng chuyển giữa hai cổng sẽ thấy hai chữ khác nhau cho một quyền.
 *
 * Khoá là `string` chứ không phải kiểu `Role` của SDK: `packages/ui` không phụ thuộc `ts-sdk` —
 * component dùng chung không được biết hình dạng API. Vai trò lạ thì hiện nguyên mã, cùng luật với
 * nhật ký kiểm toán.
 */
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Quản trị nền tảng',
  ORG_OWNER: 'Chủ sở hữu',
  ORG_ADMIN: 'Quản trị',
  EVENT_MANAGER: 'Quản lý sự kiện',
  CHECKIN_STAFF: 'Nhân viên soát vé',
  CUSTOMER: 'Khách hàng',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/** Chủ sở hữu nổi bật: đó là người duy nhất không được gỡ đi khi tổ chức chỉ còn một. */
export function roleTone(role: string): BadgeTone {
  if (role === 'ORG_OWNER') return 'accent';
  if (role === 'SUPER_ADMIN') return 'danger';
  return 'neutral';
}
