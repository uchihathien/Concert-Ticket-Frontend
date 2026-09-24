/**
 * Catalog công khai — không cần đăng nhập.
 *
 * Nguồn: `PublicCatalogController` + `CatalogViews`. Hình dạng dưới đây đã đối chiếu với JSON
 * thật do backend trả về, không phải đọc từ record Java rồi suy ra.
 */

export interface PublicTier {
  id: string;
  name: string;
  priceVnd: number;
  zoneCode: string;
  zoneName: string;
  capacity: number;
}

/**
 * Một suất diễn trên trang công khai.
 *
 * `CatalogViews.PublicSession` có phương thức `fromPriceVnd()`, nhưng nó **không nằm trong JSON**:
 * Jackson chỉ serialize các thành phần của record, còn accessor dẫn xuất thì không. Giá "từ" phải
 * tính ở client — xem `fromPriceOf`.
 */
export interface PublicSession {
  id: string;
  /** ISO-8601. */
  startsAt: string;
  endsAt: string | null;
  salesOpenAt: string | null;
  salesCloseAt: string | null;
  tiers: PublicTier[];
}

/** Một thẻ sự kiện trên trang danh sách. */
export interface PublicEventCard {
  slug: string;
  title: string;
  summary: string | null;
  category: string;
  posterUrl: string | null;
  city: string | null;
  venueName: string | null;
  nextSessionAt: string | null;
  /** Ở đây backend có tính sẵn — khác với `PublicSession`. */
  fromPriceVnd: number | null;
  sessionCount: number;
}

export interface PublicEventDetail {
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: string;
  posterUrl: string | null;
  city: string | null;
  venueName: string | null;
  venueAddress: string | null;
  sessions: PublicSession[];
}

export interface EventPage {
  items: PublicEventCard[];
  total: number;
  page: number;
  size: number;
  /**
   * Danh sách thành phố có sự kiện đang bán, backend gửi kèm để trang danh sách dựng bộ lọc mà
   * không phải gọi thêm một request nữa.
   */
  cities: string[];
}

/**
 * Tham số của `GET /v1/events`.
 *
 * Thời gian và giá đi dưới dạng **khoảng**, không phải tên lựa chọn ("weekend", "under-500"):
 * "cuối tuần này" phụ thuộc hôm nay là thứ mấy ở Việt Nam, và backend chạy giờ UTC thì giải nghĩa
 * sai đúng vào buổi sáng. Phép tính ấy nằm ở `timeRange`/`priceRange` của `@nexaticket/ui`.
 */
export interface ListEventsParams {
  query?: string;
  city?: string;
  category?: string;
  /** ISO-8601. Mốc sớm nhất của **suất kế tiếp** — cùng con số hiện trên thẻ sự kiện. */
  from?: string;
  /** ISO-8601, **không** lấy mốc này: hai lựa chọn liền nhau phải rời nhau. */
  to?: string;
  /** VND. So với **giá thấp nhất** của sự kiện. */
  minPrice?: number;
  /** Không lấy mốc này. Bỏ trống nghĩa là không có trần — đó là "trên 1.000.000đ". */
  maxPrice?: number;
  page?: number;
  /** Backend chặn trần ở 60. */
  size?: number;
}

/** Giá thấp nhất của một suất. Không có hạng vé nào thì `null` và nơi hiển thị ẩn nhãn giá. */
export function fromPriceOf(session: PublicSession): number | null {
  if (session.tiers.length === 0) return null;
  return session.tiers.reduce((min, tier) => Math.min(min, tier.priceVnd), Infinity);
}
