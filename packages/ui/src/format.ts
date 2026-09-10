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

/**
 * `Thứ Bảy, 12/09/2026` — có thứ trong tuần.
 *
 * Dùng ở trang chi tiết, chỗ người dùng đang cân nhắc "hôm đó mình có rảnh không". Thẻ sự kiện
 * thì vẫn dùng `formatDate`: thêm thứ vào thẻ làm dòng ngày dài gấp đôi mà không giúp gì cho
 * việc lướt qua hàng chục thẻ.
 */
const DATE_LONG = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ho_Chi_Minh',
});

export function formatDate(value: string | number | Date): string {
  return DATE_ONLY.format(new Date(value));
}

export function formatDateLong(value: string | number | Date): string {
  return DATE_LONG.format(new Date(value));
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

// ---------------------------------------------------------------------------
// Cầu nối với ô `datetime-local`
// ---------------------------------------------------------------------------

/**
 * Ô `datetime-local` không mang múi giờ: trình duyệt hiểu nó theo múi giờ của **máy người dùng**.
 * Cả app thì hiển thị mọi mốc theo `Asia/Ho_Chi_Minh` (xem `formatDateTime`). Để mặc thì một ban tổ
 * chức đang ở nước ngoài gõ "19:00", lưu xong màn hình hiện "01:00 hôm sau", và không có gì trên
 * màn hình giải thích vì sao. Nên hai hàm dưới đây quy ước: thứ nằm trong ô là giờ Việt Nam.
 */
const VN_OFFSET = '+07:00';

const VN_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  // `hour12: false` vẫn cho "24:00" ở một số bản ICU; `h23` mới là thứ ô nhập chấp nhận.
  hourCycle: 'h23',
});

/** `2026-09-12T19:00` (giờ VN) → ISO instant. Rỗng hoặc không hợp lệ → `undefined`. */
export function vnLocalToIso(value: string | null | undefined): string | undefined {
  const raw = String(value ?? '').trim();
  if (raw === '') return undefined;

  // Ô nhập cho `2026-09-12T19:00`; có trình duyệt thêm cả giây.
  const withSeconds = raw.length === 16 ? `${raw}:00` : raw;
  const date = new Date(`${withSeconds}${VN_OFFSET}`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** ISO instant → `2026-09-12T19:00` theo giờ VN, để đổ vào `defaultValue` của ô nhập. */
export function isoToVnLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = Object.fromEntries(
    VN_PARTS.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
