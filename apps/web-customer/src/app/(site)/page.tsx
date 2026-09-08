import { CarouselRow, CategoryChips, EventCard, coverGradient, formatDate } from '@nexaticket/ui';
import { HeroCarousel, type HeroSlide } from '@/components/HeroCarousel';
import {
  CATEGORIES,
  PLACEHOLDER_EVENTS,
  nextSession,
  type PlaceholderEvent,
} from '@/lib/placeholder-events';
import styles from './page.module.css';

/**
 * C-HOME — bố cục theo ui-direction.md §4.
 *
 * Thứ tự cố ý: header ưu tiên tìm kiếm → hero xoay vòng → chip thể loại → dải sự kiện cuộn ngang.
 * Nội dung đặt TRƯỚC thương hiệu, khác v1 vốn dành nguyên màn đầu cho brand hero.
 *
 * Dữ liệu là placeholder (`@/lib/placeholder-events`) vì catalog-service chưa có API. Cấu trúc
 * component thì đã đúng chỗ — nối API là thay nguồn dữ liệu, không phải vẽ lại màn.
 */

const HERO_SLIDES: HeroSlide[] = [
  {
    href: '/events/live-concert-thanh-pho',
    kicker: 'Đang bán chạy',
    title: 'Live Concert · Thành Phố Không Ngủ',
    meta: '10/10/2026 · Sân vận động Quốc gia, Hà Nội',
    background: coverGradient('live-concert-thanh-pho'),
  },
  {
    href: '/events/dem-nhac-mua-thu',
    kicker: 'Sắp hết vé',
    title: 'Đêm nhạc Mùa Thu',
    meta: '19/09/2026 · Nhà hát Lớn, Hà Nội',
    background: coverGradient('dem-nhac-mua-thu'),
  },
  {
    href: '/events/hoi-thao-cong-nghe',
    kicker: 'Sắp diễn ra',
    title: 'Hội thảo Công nghệ & Thanh toán',
    meta: '14/11/2026 · Trung tâm Hội nghị Quốc gia',
    background: coverGradient('hoi-thao-cong-nghe'),
  },
];

const ROWS: Array<{ title: string; pick: (events: PlaceholderEvent[]) => PlaceholderEvent[] }> = [
  { title: 'Đang bán chạy', pick: (events) => events.slice(0, 6) },
  { title: 'Sắp diễn ra', pick: (events) => [...events].reverse().slice(0, 6) },
  {
    title: 'Cuối tuần này',
    pick: (events) => events.filter((event) => event.category !== 'hoi-thao').slice(0, 6),
  },
];

export default function HomePage() {
  return (
    <main>
      <section className={styles.hero}>
        <HeroCarousel slides={HERO_SLIDES} />
      </section>

      <div className={styles.chips}>
        <CategoryChips
          items={[...CATEGORIES]}
          activeValue="all"
          hrefFor={(value) => (value === 'all' ? '/events' : `/events?category=${value}`)}
        />
      </div>

      {ROWS.map((row) => (
        <div key={row.title} className={styles.row}>
          <CarouselRow title={row.title} seeAllHref="/events">
            {row.pick(PLACEHOLDER_EVENTS).map((event) => {
              const session = nextSession(event);
              return (
                <EventCard
                  key={event.slug}
                  href={`/events/${event.slug}`}
                  title={event.title}
                  dateLabel={session ? formatDate(session.startsAt) : 'Chưa có suất'}
                  venueLabel={session?.city ?? '—'}
                  fromPriceVnd={session?.fromPriceVnd ?? null}
                  coverSeed={event.slug}
                  badge={event.badge}
                />
              );
            })}
          </CarouselRow>
        </div>
      ))}
    </main>
  );
}
