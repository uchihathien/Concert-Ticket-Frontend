import { listPublicEvents, type PublicEventCard } from '@nexaticket/ts-sdk';
import {
  CarouselRow,
  CategoryChips,
  EmptyState,
  EVENT_CATEGORY_FILTERS,
  EventCard,
  coverGradient,
  eventCategoryLabel,
  formatDate,
} from '@nexaticket/ui';
import Link from 'next/link';
import { HeroCarousel, type HeroSlide } from '@/components/HeroCarousel';
import { serverApi } from '@/lib/server-api';
import styles from './page.module.css';

/**
 * C-HOME — bố cục theo ui-direction.md §4.
 *
 * Thứ tự cố ý: header ưu tiên tìm kiếm → hero xoay vòng → chip thể loại → các khối sự kiện.
 * Nội dung đặt TRƯỚC thương hiệu.
 *
 * Mỗi khối là **một truy vấn thật có nghĩa**, không phải cắt một danh sách rồi đặt bốn cái tên
 * khác nhau. Cụ thể:
 *
 * - "Sự kiện nổi bật" — trang đầu của `GET /v1/events`. Backend sắp `ORDER BY published_at DESC`
 *   và **không có** chỉ số phổ biến nào (không lượt xem, không vé đã bán trên catalog), nên
 *   "nổi bật" ở đây nghĩa là *sàn vừa mở bán* — đó là thứ tự do chính nền tảng quyết định, không
 *   phải con số bịa ra.
 * - Ba khối thể loại — lọc thật bằng tham số `category`.
 * - "Sắp diễn ra" — sắp theo `nextSessionAt` tăng dần. Backend chưa nhận tham số sắp xếp nên phải
 *   sắp ở đây, trên một lượt lấy có giới hạn (backend chặn trần `size` ở 60). Khi catalog vượt 60
 *   sự kiện đang bán thì khối này chỉ đúng trong phạm vi đó — cần thêm `sort=startsAt` ở backend
 *   để làm cho tử tế.
 */

/** Backend đặt Cache-Control 2 phút; ISR ở đây khớp theo để hai lớp cache không đá nhau. */
export const revalidate = 120;

/** Trần `size` của backend. Lấy hết trong một lượt để còn sắp theo ngày diễn. */
const MAX_PAGE_SIZE = 60;

const CATEGORY_ROWS = [
  { category: 'nhac-song', title: 'Ca nhạc' },
  { category: 'san-khau', title: 'Sân khấu & Nghệ thuật' },
  { category: 'the-thao', title: 'Thể thao' },
] as const;

/**
 * Tải dữ liệu trang chủ, và **không ném** khi catalog không với tới được.
 *
 * Trang này là trang tĩnh có ISR, nên lần dựng đầu tiên xảy ra lúc `next build`. Để nó ném thì cả
 * bản build chết với `Error occurred prerendering page "/"` — nghĩa là không build được frontend
 * nếu backend chưa chạy. Đó là ràng buộc sai: hai bên deploy độc lập, và CI của frontend không có
 * lý do gì phải dựng cả cụm backend lên chỉ để biên dịch.
 *
 * Đổi lại, hỏng thì phải **nói ra**, không được im lặng hiện một trang trống trông như "chưa có sự
 * kiện nào". Nơi gọi hiện hẳn một khối lỗi, và ISR 2 phút tự thay bằng bản đúng ngay khi backend
 * trở lại — không cần deploy lại.
 */
async function loadHome() {
  try {
    const [latest, ...categoryPages] = await Promise.all([
      listPublicEvents(serverApi, { size: MAX_PAGE_SIZE }),
      ...CATEGORY_ROWS.map((row) =>
        listPublicEvents(serverApi, { category: row.category, size: 12 }),
      ),
    ]);
    return { ok: true as const, latest, categoryPages };
  } catch {
    return { ok: false as const };
  }
}

export default async function HomePage() {
  const result = await loadHome();

  if (!result.ok) {
    return (
      <main className={styles.section}>
        <EmptyState
          title="Chưa tải được danh sách sự kiện"
          description="Máy chủ đang không phản hồi. Trang sẽ tự cập nhật khi có lại — bạn có thể tải lại sau ít phút."
          action={
            <Link className={styles.sectionLink} href="/events">
              Thử mở trang sự kiện
            </Link>
          }
        />
      </main>
    );
  }

  const { latest, categoryPages } = result;
  const featured = latest.items.slice(0, 8);

  // Sự kiện chưa có suất nào thì không thuộc về khối "sắp diễn ra" — xếp nó vào đâu cũng sai.
  const upcoming = latest.items
    .filter((event) => event.nextSessionAt !== null)
    .sort((a, b) => (a.nextSessionAt as string).localeCompare(b.nextSessionAt as string))
    .slice(0, 12);

  const slides: HeroSlide[] = featured.slice(0, 3).map((event) => ({
    href: `/events/${event.slug}`,
    kicker: event.city ?? 'Sắp diễn ra',
    title: event.title,
    meta: [event.nextSessionAt ? formatDate(event.nextSessionAt) : null, event.venueName]
      .filter(Boolean)
      .join(' · '),
    background: coverGradient(event.slug),
    imageUrl: event.posterUrl ?? undefined,
  }));

  return (
    <main>
      {slides.length > 0 ? (
        <section className={styles.hero}>
          <HeroCarousel slides={slides} />
        </section>
      ) : null}

      <div className={styles.chips}>
        <CategoryChips
          items={[...EVENT_CATEGORY_FILTERS]}
          activeValue="all"
          hrefFor={(value) => (value === 'all' ? '/events' : `/events?category=${value}`)}
        />
      </div>

      {featured.length > 0 ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Sự kiện nổi bật</h2>
            <Link className={styles.sectionLink} href="/events">
              Xem tất cả
            </Link>
          </div>
          <div className={styles.grid}>{featured.map(toCard)}</div>
        </section>
      ) : null}

      {CATEGORY_ROWS.map((row, index) => {
        const page = categoryPages[index];
        if (!page || page.items.length === 0) return null;

        return (
          <div key={row.category} className={styles.row}>
            <CarouselRow title={row.title} seeAllHref={`/events?category=${row.category}`}>
              {page.items.map(toCard)}
            </CarouselRow>
          </div>
        );
      })}

      {upcoming.length > 0 ? (
        <div className={styles.row}>
          <CarouselRow title="Sắp diễn ra" seeAllHref="/events">
            {upcoming.map(toCard)}
          </CarouselRow>
        </div>
      ) : null}
    </main>
  );
}

function toCard(event: PublicEventCard) {
  return (
    <EventCard
      key={event.slug}
      href={`/events/${event.slug}`}
      title={event.title}
      tag={eventCategoryLabel(event.category)}
      dateLabel={event.nextSessionAt ? formatDate(event.nextSessionAt) : 'Chưa có suất'}
      venueLabel={event.venueName ?? event.city ?? '—'}
      fromPriceVnd={event.fromPriceVnd}
      imageUrl={event.posterUrl ?? undefined}
      coverSeed={event.slug}
    />
  );
}
