import type { EventStatus } from '@nexaticket/ts-sdk';
import type { BadgeTone } from '@nexaticket/ui';

/**
 * Nhãn và màu của trạng thái sự kiện — một chỗ cho cả danh sách lẫn trang chi tiết.
 *
 * Trước đây danh sách chỉ phân biệt "Đang bán" với "Nháp", nên một sự kiện đã gỡ bán hoặc đã huỷ
 * cũng hiện là "Nháp" — người tổ chức tưởng sự kiện chưa từng lên bán.
 */
export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: 'Nháp',
  PUBLISHED: 'Đang bán',
  UNPUBLISHED: 'Đã gỡ bán',
  CANCELLED: 'Đã huỷ',
};

export function eventStatusLabel(status: EventStatus): string {
  return EVENT_STATUS_LABELS[status] ?? status;
}

export function eventStatusTone(status: EventStatus): BadgeTone {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'UNPUBLISHED') return 'warn';
  if (status === 'CANCELLED') return 'danger';
  return 'neutral';
}

/**
 * Huỷ là trạng thái cuối ở catalog (`Event.cancel`), nên sự kiện đã huỷ không xuất bản lại được.
 * Ẩn nút đi thay vì để người dùng bấm rồi nhận lỗi từ server.
 */
export function canTogglePublish(status: EventStatus): boolean {
  return status !== 'CANCELLED';
}
