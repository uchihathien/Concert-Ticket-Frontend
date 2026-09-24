import type { BadgeTone } from './components/Badge';

/**
 * Nhãn tiếng Việt cho hành động trong nhật ký kiểm toán.
 *
 * Nằm ở `packages/ui` chứ không ở từng app: A-AUDIT (`web-admin`) và P-ORG (`web-platform`) đọc
 * cùng bảng `audit_logs`. Hai bản danh sách chép tay sẽ lệch nhau ngay lần backend thêm một hành
 * động mới, và bản lệch hiện mã thô cho đúng những dòng mà bản kia đã dịch.
 *
 * Hành động lạ thì hiện nguyên mã: thà một dòng khó đọc còn hơn một dòng biến mất. Danh sách này
 * đi sau backend một nhịp là chuyện bình thường — backend thêm hành động trước, ở đây bổ sung sau,
 * và trong khoảng giữa thì mã thô vẫn nói đủ.
 */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  ORGANIZATION_CREATED: 'Tạo tổ chức',
  ORGANIZATION_RENAMED: 'Đổi tên tổ chức',
  ORGANIZATION_SUSPENDED: 'Khoá tổ chức',
  ORGANIZATION_ACTIVATED: 'Mở khoá tổ chức',
  MEMBER_INVITED: 'Mời thành viên',
  MEMBER_JOINED: 'Thành viên tham gia',
  MEMBER_GRANTED: 'Cấp quyền thành viên',
  MEMBER_ROLE_CHANGED: 'Đổi vai trò',
  MEMBER_REMOVED: 'Gỡ thành viên',
  INVITATION_REVOKED: 'Thu hồi lời mời',
  SESSIONS_REVOKED: 'Thu hồi mọi phiên',
  SESSION_REVOKED: 'Thu hồi một phiên',
  PASSWORD_RESET_SENT: 'Gửi thư đặt lại mật khẩu',
  PURCHASE_LIMITS_CHANGED: 'Đổi trần mua vé',
  USER_DISABLED: 'Vô hiệu hoá tài khoản',
  USER_ENABLED: 'Khôi phục tài khoản',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

/** Hành động phá huỷ nổi bật hơn: đó là những dòng người ta mở nhật ký ra để tìm. */
export function auditActionTone(action: string): BadgeTone {
  if (action.includes('REMOVED') || action.includes('REVOKED') || action.includes('DISABLED')) {
    return 'danger';
  }
  if (action.includes('CREATED') || action.includes('JOINED') || action.includes('GRANTED')) {
    return 'success';
  }
  return 'neutral';
}

/**
 * Danh sách cho ô lọc hành động, kèm dòng "tất cả" ở đầu.
 *
 * `organization` bỏ những hành động cấp nền tảng (`USER_*`): chúng không gắn với tổ chức nào nên
 * chọn chúng ở màn của tổ chức luôn cho ra bảng trống — một bộ lọc không bao giờ khớp gì thì đọc
 * như thể dữ liệu bị mất.
 */
export function auditActionFilters(
  scope: 'organization' | 'platform',
): Array<{ value: string; label: string }> {
  const actions = Object.entries(AUDIT_ACTION_LABELS).filter(
    ([action]) => scope === 'platform' || !action.startsWith('USER_'),
  );
  return [
    { value: '', label: 'Tất cả hành động' },
    ...actions.map(([value, label]) => ({ value, label })),
  ];
}
