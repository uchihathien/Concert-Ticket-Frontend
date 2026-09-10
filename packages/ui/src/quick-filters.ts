/**
 * Bộ lọc nhanh theo thời gian và theo giá.
 *
 * Cả hai đều chạy ở **phía server, trên kết quả đã lấy về**, không phải tham số gửi cho backend:
 * `GET /v1/events` chỉ nhận `query`, `city`, `category`, `page`, `size`. Hệ quả phải nói rõ —
 * khi một trong hai bộ lọc này bật, trang danh sách lấy một lượt tối đa 60 sự kiện (trần của
 * backend) rồi lọc và phân trang tại chỗ. Vượt quá 60 sự kiện đang bán thì kết quả chỉ đúng
 * trong phạm vi đó.
 *
 * Cách sửa tử tế nằm ở backend: thêm `from`/`to` và `minPrice`/`maxPrice` cho `/v1/events`.
 * Đây là thay đổi contract nên phải do người quyết định, không tự thêm.
 */

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

/**
 * Chỉ hai trường mà bộ lọc thật sự đọc, không phải cả `PublicEventCard`.
 *
 * Khai theo cấu trúc để `packages/ui` không phải phụ thuộc vào `ts-sdk`: gói này dùng chung cho
 * bốn app, thêm một cạnh phụ thuộc chỉ vì một kiểu dữ liệu là cái giá không đáng.
 */
export interface FilterableEvent {
  nextSessionAt: string | null;
  fromPriceVnd: number | null;
}

export interface QuickFilterOption {
  value: string;
  label: string;
}

export const TIME_FILTERS: QuickFilterOption[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'weekend', label: 'Cuối tuần này' },
  { value: 'month', label: 'Tháng này' },
];

export const PRICE_FILTERS: QuickFilterOption[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'free', label: 'Miễn phí' },
  { value: 'under-500', label: 'Dưới 500.000đ' },
  { value: '500-1000', label: '500.000đ – 1.000.000đ' },
  { value: 'over-1000', label: 'Trên 1.000.000đ' },
];

/**
 * Ngày hôm nay theo giờ Việt Nam, dạng `{ y, m, d, weekday }`.
 *
 * Tính qua `Intl` chứ không qua `getDate()`: tiến trình Next thường chạy UTC, mà 07:00 giờ Việt
 * Nam là 00:00 UTC — lệch múi giờ ở đây làm "hôm nay" nhảy sang hôm khác đúng vào buổi sáng.
 */
function todayInVietnam(now: Date): { y: number; m: number; d: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    weekday: Math.max(0, names.indexOf(get('weekday'))),
  };
}

/** Mốc `00:00` giờ Việt Nam của ngày `y-m-d` cộng thêm `plusDays`, dưới dạng timestamp. */
function vnMidnight(y: number, m: number, d: number, plusDays = 0): number {
  // `+07:00` cố định: Việt Nam không có giờ mùa hè, nên không cần tra bảng múi giờ.
  return (
    Date.parse(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+07:00`) +
    plusDays * 86_400_000
  );
}

/** Khoảng `[from, to)` của một lựa chọn thời gian. `null` nghĩa là không lọc. */
export function timeRange(value: string, now = new Date()): { from: number; to: number } | null {
  const { y, m, d, weekday } = todayInVietnam(now);
  const startOfToday = vnMidnight(y, m, d);

  switch (value) {
    case 'today':
      return { from: startOfToday, to: startOfToday + 86_400_000 };

    case 'weekend': {
      // Thứ Bảy gần nhất. Đang là thứ Bảy hoặc Chủ nhật thì "cuối tuần này" là chính hôm nay —
      // đẩy người dùng sang tuần sau khi họ hỏi vào tối thứ Bảy là trả lời sai câu hỏi.
      const daysToSaturday = weekday === 0 ? 0 : 6 - weekday;
      const from = weekday === 0 ? startOfToday : vnMidnight(y, m, d, daysToSaturday);
      const to = weekday === 0 ? startOfToday + 86_400_000 : from + 2 * 86_400_000;
      return { from: Math.max(from, startOfToday), to };
    }

    case 'month': {
      const from = vnMidnight(y, m, 1);
      const to = m === 12 ? vnMidnight(y + 1, 1, 1) : vnMidnight(y, m + 1, 1);
      return { from: Math.max(from, startOfToday), to };
    }

    default:
      return null;
  }
}

/** Khoảng giá `[min, max)` tính bằng VND. `null` nghĩa là không lọc. */
export function priceRange(value: string): { min: number; max: number } | null {
  switch (value) {
    case 'free':
      return { min: 0, max: 1 };
    case 'under-500':
      return { min: 0, max: 500_000 };
    case '500-1000':
      return { min: 500_000, max: 1_000_001 };
    case 'over-1000':
      // Bắt đầu từ 1.000.001: đúng 1.000.000 đã thuộc khoảng trên, hai nhóm không được chồng nhau.
      return { min: 1_000_001, max: Number.POSITIVE_INFINITY };
    default:
      return null;
  }
}

/** Có bộ lọc nào phải xử lý ở client không — quyết định trang danh sách lấy một trang hay lấy hết. */
export function needsLocalFiltering(when: string, price: string): boolean {
  return timeRange(when) !== null || priceRange(price) !== null;
}

/**
 * Áp bộ lọc thời gian và giá lên danh sách.
 *
 * Sự kiện chưa có suất (`nextSessionAt === null`) hoặc chưa mở bán (`fromPriceVnd === null`) bị
 * loại khi bộ lọc tương ứng đang bật: không biết ngày thì không thể nói nó diễn ra hôm nay.
 */
export function applyQuickFilters<T extends FilterableEvent>(
  items: T[],
  when: string,
  price: string,
  now = new Date(),
): T[] {
  const time = timeRange(when, now);
  const money = priceRange(price);
  if (!time && !money) return items;

  return items.filter((event) => {
    if (time) {
      if (!event.nextSessionAt) return false;
      const at = Date.parse(event.nextSessionAt);
      if (Number.isNaN(at) || at < time.from || at >= time.to) return false;
    }

    if (money) {
      if (event.fromPriceVnd === null) return false;
      if (event.fromPriceVnd < money.min || event.fromPriceVnd >= money.max) return false;
    }

    return true;
  });
}
