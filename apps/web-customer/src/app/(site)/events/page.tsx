import { listPublicEvents } from '@nexaticket/ts-sdk';
import {
  CategoryChips,
  EVENT_CATEGORY_FILTERS,
  EmptyState,
  EventCard,
  eventCategoryLabel,
  formatDate,
  quickFilterParams,
} from '@nexaticket/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FilterSidebar } from '@/components/FilterSidebar';
import { serverApi } from '@/lib/server-api';
import styles from './events.module.css';

export const metadata: Metadata = {
  title: 'Sự kiện — NexaTicket',
  description: 'Tìm sự kiện theo thể loại, thành phố, thời gian và mức giá.',
};

/** Backend đặt Cache-Control 2 phút; ISR khớp theo để hai lớp cache không đá nhau. */
export const revalidate = 120;

const PAGE_SIZE = 24;

/**
 * C-LIST — search params là nguồn chân lý duy nhất.
 *
 * **Cả sáu bộ lọc đều do backend làm**: tìm kiếm, thể loại, thành phố, thời gian, mức giá và phân
 * trang. Trang này chỉ dịch lựa chọn trên URL thành tham số API.
 *
 * Trước đây thời gian và giá được lọc tại chỗ trên tối đa 60 sự kiện lấy về, vì endpoint chưa nhận
 * hai tham số ấy — nghĩa là chúng chỉ đúng trong phạm vi 60 cái đó, và `total` hiện trên màn hình
 * cũng chỉ đếm trong phạm vi ấy. `GET /v1/events` giờ nhận `from`/`to` và `minPrice`/`maxPrice`,
 * nên giới hạn đó không còn.
 *
 * Là server component: trang này khách vào từ Google, nên nó phải trả HTML đầy đủ.
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
  const when = read('when', 'all');
  const price = read('price', 'all');
  const page = Math.max(0, Number.parseInt(read('page', '0'), 10) || 0);

  const result = await listPublicEvents(serverApi, {
    ...(query ? { query } : {}),
    ...(category !== 'all' ? { category } : {}),
    ...(city !== 'all' ? { city } : {}),
    // Dịch lựa chọn giao diện ("cuối tuần này") thành khoảng số cho backend. Phép tính ở phía
    // client vì "cuối tuần" phụ thuộc hôm nay là thứ mấy ở Việt Nam — xem `quickFilterParams`.
    ...quickFilterParams(when, price),
    page,
    size: PAGE_SIZE,
  });

  const items = result.items;
  const total = result.total;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  const linkWith = (patch: Record<string, string | number>) => {
    const next = new URLSearchParams();
    const merged = { q: query, category, city, when, price, page, ...patch };
    if (merged.q) next.set('q', String(merged.q));
    if (merged.category !== 'all') next.set('category', String(merged.category));
    if (merged.city !== 'all') next.set('city', String(merged.city));
    if (merged.when !== 'all') next.set('when', String(merged.when));
    if (merged.price !== 'all') next.set('price', String(merged.price));
    if (Number(merged.page) > 0) next.set('page', String(merged.page));
    const search = next.toString();
    return search ? `/events?${search}` : '/events';
  };

  const filtered =
    Boolean(query) || category !== 'all' || city !== 'all' || when !== 'all' || price !== 'all';

  return (
    <main className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>{query ? `Kết quả cho “${query}”` : 'Sự kiện'}</h1>
        <p className={styles.count}>{total === 0 ? 'Không có sự kiện nào' : `${total} sự kiện`}</p>
      </div>

      <CategoryChips
        className={styles.chips}
        items={[...EVENT_CATEGORY_FILTERS]}
        activeValue={category}
        hrefFor={(value) => linkWith({ category: value, page: 0 })}
      />

      <div className={styles.layout}>
        <FilterSidebar
          when={when}
          price={price}
          city={city}
          cities={result.cities}
          linkWith={linkWith}
          filtered={filtered}
        />

        <div className={styles.results}>
          {items.length === 0 ? (
            <EmptyState
              title="Không tìm thấy sự kiện nào"
              description="Thử bỏ bớt từ khoá, nới khoảng thời gian, hoặc chọn thành phố khác."
            />
          ) : (
            <>
              <div className={styles.grid}>
                {items.map((event) => (
                  <EventCard
                    key={event.slug}
                    href={`/events/${event.slug}`}
                    title={event.title}
                    tag={eventCategoryLabel(event.category)}
                    dateLabel={
                      event.nextSessionAt ? formatDate(event.nextSessionAt) : 'Chưa có suất'
                    }
                    venueLabel={event.venueName ?? event.city ?? '—'}
                    fromPriceVnd={event.fromPriceVnd}
                    imageUrl={event.posterUrl ?? undefined}
                    coverSeed={event.slug}
                  />
                ))}
              </div>

              {lastPage > 0 ? (
                <nav className={styles.pager} aria-label="Phân trang">
                  {page > 0 ? (
                    <Link href={linkWith({ page: page - 1 })}>← Trang trước</Link>
                  ) : (
                    <span />
                  )}
                  <span className={styles.pagerStatus}>
                    Trang {page + 1} / {lastPage + 1}
                  </span>
                  {page < lastPage ? (
                    <Link href={linkWith({ page: page + 1 })}>Trang sau →</Link>
                  ) : (
                    <span />
                  )}
                </nav>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
