/**
 * DỮ LIỆU GIẢ — xoá cả file này khi `catalog-service` có API.
 *
 * `catalog-service` hiện chưa có controller nào, nên các trang công khai dựng bằng dữ liệu dựng
 * sẵn ở đây. Gom về một file để lúc nối API thật chỉ phải xoá một chỗ, và để không ai nhầm nó
 * với hợp đồng thật của backend — hình dạng dưới đây là **giả định của frontend**, không phải
 * DTO đã chốt.
 *
 * Khi nối thật: thay bằng hook trong `@nexaticket/ts-sdk`, giữ nguyên các component.
 */

export interface PlaceholderSession {
  id: string;
  /** ISO-8601 UTC. Định dạng ở nơi hiển thị, theo múi giờ Việt Nam. */
  startsAt: string;
  venue: string;
  city: string;
  fromPriceVnd: number | null;
}

export interface PlaceholderEvent {
  slug: string;
  title: string;
  category: CategoryValue;
  summary: string;
  description: string[];
  badge?: string;
  sessions: PlaceholderSession[];
}

export const CATEGORIES = [
  { value: 'all', label: 'Tất cả' },
  { value: 'nhac-song', label: 'Nhạc sống' },
  { value: 'san-khau', label: 'Sân khấu' },
  { value: 'the-thao', label: 'Thể thao' },
  { value: 'hoi-thao', label: 'Hội thảo' },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]['value'];

export const PLACEHOLDER_EVENTS: PlaceholderEvent[] = [
  {
    slug: 'dem-nhac-mua-thu',
    title: 'Đêm nhạc Mùa Thu',
    category: 'nhac-song',
    summary: 'Đêm nhạc acoustic với dàn nhạc thính phòng.',
    description: [
      'Một đêm nhạc acoustic kết hợp dàn dây thính phòng, không dùng nhạc nền thu sẵn.',
      'Chương trình kéo dài khoảng 120 phút, không có giải lao.',
    ],
    badge: 'Sắp hết vé',
    sessions: [
      {
        id: 'ses-thu-1',
        startsAt: '2026-09-19T12:00:00Z',
        venue: 'Nhà hát Lớn',
        city: 'Hà Nội',
        fromPriceVnd: 500_000,
      },
      {
        id: 'ses-thu-2',
        startsAt: '2026-09-20T12:00:00Z',
        venue: 'Nhà hát Lớn',
        city: 'Hà Nội',
        fromPriceVnd: 500_000,
      },
    ],
  },
  {
    slug: 'live-concert-thanh-pho',
    title: 'Live Concert · Thành Phố Không Ngủ',
    category: 'nhac-song',
    summary: 'Sân khấu ngoài trời, khu vực đứng và khán đài đánh số.',
    description: [
      'Sân vận động mở, gồm sân trung tâm vé đứng và bốn khán đài ghế đánh số.',
      'Cổng mở trước giờ diễn 90 phút.',
    ],
    sessions: [
      {
        id: 'ses-tp-1',
        startsAt: '2026-10-10T12:30:00Z',
        venue: 'Sân vận động Quốc gia',
        city: 'Hà Nội',
        fromPriceVnd: 800_000,
      },
    ],
  },
  {
    slug: 'vo-kich-nguoi-tot',
    title: 'Vở kịch: Người Tốt Của Thành Tứ Xuyên',
    category: 'san-khau',
    summary: 'Kịch nói, suất diễn cuối tuần.',
    description: ['Kịch nói dài 150 phút, có một lần giải lao 15 phút.'],
    sessions: [
      {
        id: 'ses-kich-1',
        startsAt: '2026-09-26T13:00:00Z',
        venue: 'Nhà hát Tuổi Trẻ',
        city: 'Hà Nội',
        fromPriceVnd: 300_000,
      },
    ],
  },
  {
    slug: 'giao-huong-mua-dong',
    title: 'Hòa nhạc Giao hưởng Mùa Đông',
    category: 'san-khau',
    summary: 'Chương trình giao hưởng thường niên.',
    description: ['Dàn nhạc giao hưởng trình diễn chương trình thường niên.'],
    badge: 'Sắp mở bán',
    sessions: [
      {
        id: 'ses-gh-1',
        startsAt: '2026-12-19T12:00:00Z',
        venue: 'Học viện Âm nhạc',
        city: 'Hà Nội',
        fromPriceVnd: null,
      },
    ],
  },
  {
    slug: 'derby-thanh-pho',
    title: 'Derby Thành Phố',
    category: 'the-thao',
    summary: 'Vòng 12 giải vô địch quốc gia.',
    description: ['Trận đấu vòng 12. Khán đài A và B là ghế đánh số, khán đài C vé đứng.'],
    sessions: [
      {
        id: 'ses-derby-1',
        startsAt: '2026-09-13T10:00:00Z',
        venue: 'Sân Thống Nhất',
        city: 'TP. Hồ Chí Minh',
        fromPriceVnd: 150_000,
      },
    ],
  },
  {
    slug: 'giai-chay-dem',
    title: 'Giải chạy đêm 10K',
    category: 'the-thao',
    summary: 'Cự ly 5K và 10K, xuất phát buổi tối.',
    description: ['Hai cự ly 5K và 10K. Nhận racekit trước ngày thi đấu.'],
    sessions: [
      {
        id: 'ses-chay-1',
        startsAt: '2026-10-24T12:00:00Z',
        venue: 'Công viên Thống Nhất',
        city: 'Hà Nội',
        fromPriceVnd: 250_000,
      },
    ],
  },
  {
    slug: 'hoi-thao-cong-nghe',
    title: 'Hội thảo Công nghệ & Thanh toán',
    category: 'hoi-thao',
    summary: 'Một ngày, hai phiên song song.',
    description: ['Chương trình một ngày, hai phiên song song, có phiên hỏi đáp cuối ngày.'],
    sessions: [
      {
        id: 'ses-ht-1',
        startsAt: '2026-11-14T01:30:00Z',
        venue: 'Trung tâm Hội nghị Quốc gia',
        city: 'Hà Nội',
        fromPriceVnd: 1_200_000,
      },
    ],
  },
  {
    slug: 'workshop-nhiep-anh',
    title: 'Workshop Nhiếp ảnh Đường phố',
    category: 'hoi-thao',
    summary: 'Lớp thực hành, giới hạn 30 chỗ.',
    description: ['Buổi thực hành ngoài trời, giới hạn 30 chỗ.'],
    sessions: [
      {
        id: 'ses-wa-1',
        startsAt: '2026-09-12T02:00:00Z',
        venue: 'Phố cổ',
        city: 'Hà Nội',
        fromPriceVnd: 450_000,
      },
    ],
  },
];

/** Khoảng thời gian ở bộ lọc. `all` gồm cả suất đã diễn ra. */
export const TIME_WINDOWS = [
  { value: 'upcoming', label: 'Sắp diễn ra' },
  { value: '30d', label: 'Trong 30 ngày' },
  { value: '90d', label: 'Trong 3 tháng' },
  { value: 'all', label: 'Mọi thời điểm' },
] as const;

export type TimeWindow = (typeof TIME_WINDOWS)[number]['value'];

export const SORTS = [
  { value: 'soonest', label: 'Sắp diễn ra trước' },
  { value: 'price-asc', label: 'Giá thấp đến cao' },
  { value: 'price-desc', label: 'Giá cao đến thấp' },
] as const;

export type SortValue = (typeof SORTS)[number]['value'];

/** Danh sách thành phố lấy từ chính dữ liệu, không gõ tay — thêm sự kiện là bộ lọc tự có thêm. */
export function cities(): string[] {
  const found = new Set<string>();
  for (const event of PLACEHOLDER_EVENTS) {
    for (const session of event.sessions) found.add(session.city);
  }
  return [...found].sort((a, b) => a.localeCompare(b, 'vi'));
}

/**
 * Suất diễn gần nhất **còn ở phía trước**.
 *
 * Thẻ sự kiện phải nói về suất khách còn mua được. Lấy suất sớm nhất bất kể đã qua hay chưa thì
 * một sự kiện diễn nhiều đêm sẽ mãi hiện ngày của đêm đầu, kể cả khi đêm đó đã diễn xong.
 */
export function nextSession(
  event: PlaceholderEvent,
  now: Date = new Date(),
): PlaceholderSession | undefined {
  const sorted = [...event.sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return sorted.find((session) => new Date(session.startsAt) >= now) ?? sorted[0];
}

export function findEvent(slug: string): PlaceholderEvent | undefined {
  return PLACEHOLDER_EVENTS.find((event) => event.slug === slug);
}

export interface EventFilter {
  category?: string;
  query?: string;
  city?: string;
  window?: string;
  sort?: string;
}

/**
 * Lọc và sắp xếp.
 *
 * Bỏ dấu trước khi so từ khoá: người Việt gõ "dem nhac" phải ra "Đêm nhạc", nếu không thì ô tìm
 * kiếm trông như hỏng.
 */
export function filterEvents(
  {
    category = 'all',
    query = '',
    city = 'all',
    window = 'upcoming',
    sort = 'soonest',
  }: EventFilter,
  now: Date = new Date(),
): PlaceholderEvent[] {
  const needle = normalize(query);
  const until = windowEnd(window, now);

  const matched = PLACEHOLDER_EVENTS.filter((event) => {
    if (category !== 'all' && event.category !== category) return false;
    if (city !== 'all' && !event.sessions.some((session) => session.city === city)) return false;

    if (window !== 'all') {
      // Sự kiện lọt vào khoảng thời gian nếu có *ít nhất một* suất nằm trong đó — không phải mọi
      // suất. Sự kiện diễn nhiều đêm vẫn phải hiện ra khi một đêm rơi vào khoảng khách chọn.
      const inWindow = event.sessions.some((session) => {
        const at = new Date(session.startsAt);
        return at >= now && (until === null || at <= until);
      });
      if (!inWindow) return false;
    }

    if (!needle) return true;
    const haystack = normalize(
      `${event.title} ${event.summary} ${event.sessions.map((s) => `${s.venue} ${s.city}`).join(' ')}`,
    );
    return haystack.includes(needle);
  });

  return sortEvents(matched, sort, now);
}

function windowEnd(window: string, now: Date): Date | null {
  if (window === '30d') return addDays(now, 30);
  if (window === '90d') return addDays(now, 90);
  return null;
}

function addDays(from: Date, days: number): Date {
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  return to;
}

function sortEvents(events: PlaceholderEvent[], sort: string, now: Date): PlaceholderEvent[] {
  const priceOf = (event: PlaceholderEvent) => nextSession(event, now)?.fromPriceVnd;

  return [...events].sort((a, b) => {
    if (sort === 'price-asc' || sort === 'price-desc') {
      const pa = priceOf(a);
      const pb = priceOf(b);
      // Sự kiện chưa mở bán không có giá — đẩy xuống cuối ở cả hai chiều sắp xếp, vì xếp chúng
      // lên đầu danh sách "giá thấp đến cao" là đánh lừa người dùng.
      if (pa === null || pa === undefined) return 1;
      if (pb === null || pb === undefined) return -1;
      return sort === 'price-asc' ? pa - pb : pb - pa;
    }

    const sa = nextSession(a, now)?.startsAt ?? '';
    const sb = nextSession(b, now)?.startsAt ?? '';
    return sa.localeCompare(sb);
  });
}

/** Dấu thanh và dấu phụ sau khi tách bằng NFD nằm trong khối Combining Diacritical Marks. */
const COMBINING_MARKS = /[̀-ͯ]/g;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}
