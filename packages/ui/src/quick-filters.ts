/**
 * Bộ lọc nhanh theo thời gian và theo giá.
 *
 * Hai hàm ở đây dịch một **lựa chọn trên giao diện** ("cuối tuần này", "dưới 500.000đ") thành một
 * **khoảng số** để gửi cho `GET /v1/events`. Backend nhận `from`/`to` và `minPrice`/`maxPrice`,
 * nên việc lọc và phân trang đều do database làm.
 *
 * Trước đây hai bộ lọc này chạy tại chỗ trên tối đa 60 sự kiện lấy về — nghĩa là chúng chỉ đúng
 * trong phạm vi 60 cái ấy. `applyQuickFilters` và `needsLocalFiltering` đã bị bỏ cùng với giới
 * hạn đó.
 *
 * Phép tính vẫn ở phía client, có lý do: "cuối tuần này" phụ thuộc hôm nay là thứ mấy **ở Việt
 * Nam**, mà tiến trình backend chạy giờ UTC — 07:00 giờ Việt Nam là 00:00 UTC, nên để backend tự
 * giải nghĩa thì "hôm nay" nhảy sang hôm khác đúng vào buổi sáng. Danh sách lựa chọn cũng là
 * quyết định giao diện: thêm mốc "3 tháng tới" chỉ nên sửa một hằng số ở đây.
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

/**
 * Lựa chọn trên giao diện → tham số của `GET /v1/events`.
 *
 * Trả về đúng những khoá cần gửi; khoá vắng mặt nghĩa là không lọc theo chiều đó. `maxPrice` vắng
 * mặt với "trên 1.000.000đ" là cách biểu diễn "không có trần" — gửi `Infinity` thì query string
 * mang chữ "Infinity" và backend từ chối.
 */
export function quickFilterParams(
  when: string,
  price: string,
  now = new Date(),
): { from?: string; to?: string; minPrice?: number; maxPrice?: number } {
  const time = timeRange(when, now);
  const money = priceRange(price);

  return {
    ...(time ? { from: new Date(time.from).toISOString(), to: new Date(time.to).toISOString() } : {}),
    ...(money
      ? {
          minPrice: money.min,
          ...(Number.isFinite(money.max) ? { maxPrice: money.max } : {}),
        }
      : {}),
  };
}
