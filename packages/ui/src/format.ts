/** Định dạng theo vi-VN. Tiền là số nguyên đồng — backend không dùng số lẻ (Money.amountVnd). */

const VND = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const NUMBER = new Intl.NumberFormat('vi-VN');

export function formatVnd(amount: number): string {
  return VND.format(amount);
}

export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

/**
 * Giờ luôn hiện theo múi giờ Việt Nam, không theo máy người xem.
 *
 * Nhân viên soát vé ở cửa và khách xem vé phải thấy cùng một giờ suất diễn; máy đặt sai múi giờ
 * là chuyện thường và không được phép làm lệch giờ vào cửa.
 */
/**
 * Ngày luôn đủ bốn chữ số năm và hai chữ số ngày/tháng: `01/11/2026`.
 *
 * `dateStyle: 'short'` của vi-VN cho ra `1/11/26`. Trên thẻ sự kiện, năm hai chữ số dễ đọc nhầm
 * và ngày một chữ số làm các thẻ cạnh nhau lệch hàng — ui-direction.md §5 chốt dạng đầy đủ.
 */
const DATE_ONLY = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ho_Chi_Minh',
});

const TIME_ONLY = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Ho_Chi_Minh',
});

export function formatDate(value: string | number | Date): string {
  return DATE_ONLY.format(new Date(value));
}

export function formatTime(value: string | number | Date): string {
  return TIME_ONLY.format(new Date(value));
}

/** `01/11/2026 · 19:00` — ngày trước, giờ sau, ngăn bằng dấu chấm giữa như phần còn lại của app. */
export function formatDateTime(value: string | number | Date): string {
  const date = new Date(value);
  return `${DATE_ONLY.format(date)} · ${TIME_ONLY.format(date)}`;
}

/** mm:ss cho đồng hồ giữ chỗ và thanh toán. Quá 59 phút thì hiện h:mm:ss. */
export function formatDuration(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
