import { CategoryChips, EmptyState, EventCard, formatDate } from '@nexaticket/ui';
import type { Metadata } from 'next';
import { EventFilters } from '@/components/EventFilters';
import { CATEGORIES, cities, filterEvents, nextSession } from '@/lib/placeholder-events';
import styles from './events.module.css';

export const metadata: Metadata = {
  title: 'Sự kiện — NexaTicket',
  description: 'Tìm sự kiện theo thể loại, thành phố và thời gian.',
};

/**
 * C-LIST — search params là nguồn chân lý duy nhất.
 *
 * Không giữ bộ lọc trong state React: người dùng phải chia sẻ được kết quả lọc, mở tab mới được,
 * và bấm Back phải quay về đúng bộ lọc trước đó. Trang là server component nên bộ lọc chạy cả
 * khi JavaScript chưa tải xong.
 *
 * Dữ liệu là placeholder — catalog-service chưa có API. Phân trang và infinite scroll để dành
 * tới lúc có API thật, vì cách phân trang phụ thuộc vào hình dạng response của backend.
 */
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const read = (key: string, fallback: string) =>
    typeof params[key] === 'string' ? (params[key] as string) : fallback;

  const category = read('category', 'all');
  const query = read('q', '');
  const city = read('city', 'all');
  const window = read('window', 'upcoming');
  const sort = read('sort', 'soonest');

  const events = filterEvents({ category, query, city, window, sort });

  const chipHref = (value: string) => {
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (value !== 'all') next.set('category', value);
    if (city !== 'all') next.set('city', city);
    if (window !== 'upcoming') next.set('window', window);
    if (sort !== 'soonest') next.set('sort', sort);
    const search = next.toString();
    return search ? `/events?${search}` : '/events';
  };

  return (
    <main className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>{query ? `Kết quả cho “${query}”` : 'Sự kiện'}</h1>
        <p className={styles.count}>
          {events.length === 0 ? 'Không có sự kiện nào' : `${events.length} sự kiện`}
        </p>
      </div>

      <CategoryChips
        className={styles.chips}
        items={[...CATEGORIES]}
        activeValue={category}
        hrefFor={chipHref}
      />

      <EventFilters
        cities={cities()}
        query={query}
        category={category}
        city={city}
        window={window}
        sort={sort}
      />

      {events.length === 0 ? (
        <EmptyState
          title="Không tìm thấy sự kiện nào"
          description="Thử nới khoảng thời gian, bỏ bớt từ khoá, hoặc chọn thành phố khác."
        />
      ) : (
        <div className={styles.grid}>
          {events.map((event) => {
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
        </div>
      )}
    </main>
  );
}
