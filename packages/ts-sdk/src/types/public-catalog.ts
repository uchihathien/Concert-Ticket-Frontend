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

export interface ListEventsParams {
  query?: string;
  city?: string;
  category?: string;
  page?: number;
  /** Backend chặn trần ở 60. */
  size?: number;
}

/** Giá thấp nhất của một suất. Không có hạng vé nào thì `null` và nơi hiển thị ẩn nhãn giá. */
export function fromPriceOf(session: PublicSession): number | null {
  if (session.tiers.length === 0) return null;
  return session.tiers.reduce((min, tier) => Math.min(min, tier.priceVnd), Infinity);
}
