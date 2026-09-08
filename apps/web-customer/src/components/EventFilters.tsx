'use client';

import { Select } from '@nexaticket/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SORTS, TIME_WINDOWS } from '@/lib/placeholder-events';
import styles from './filters.module.css';

export interface EventFiltersProps {
  cities: string[];
  query: string;
  category: string;
  city: string;
  window: string;
  sort: string;
}

/**
 * Bộ lọc của trang danh sách.
 *
 * Là `<form method="get">` thật, trỏ vào chính `/events`: không có JavaScript thì chọn xong bấm
 * "Áp dụng" vẫn chạy. Có JavaScript thì đổi lựa chọn là điều hướng luôn, khỏi bấm thêm.
 *
 * Mọi lựa chọn nằm trên URL chứ không trong state — chia sẻ được, mở tab mới được, và bấm Back
 * quay về đúng bộ lọc trước đó.
 */
export function EventFilters({ cities, query, category, city, window, sort }: EventFiltersProps) {
  const router = useRouter();

  const hrefWith = (patch: Record<string, string>) => {
    const params = new URLSearchParams();
    const next = { q: query, category, city, window, sort, ...patch };
    if (next.q) params.set('q', next.q);
    if (next.category !== 'all') params.set('category', next.category);
    if (next.city !== 'all') params.set('city', next.city);
    if (next.window !== 'upcoming') params.set('window', next.window);
    if (next.sort !== 'soonest') params.set('sort', next.sort);
    const search = params.toString();
    return search ? `/events?${search}` : '/events';
  };

  const isFiltered =
    Boolean(query) ||
    category !== 'all' ||
    city !== 'all' ||
    window !== 'upcoming' ||
    sort !== 'soonest';

  return (
    <form className={styles.filters} action="/events" method="get">
      {/* Giữ lại các tham số không có ô nhập riêng, để bấm "Áp dụng" không xoá mất chúng. */}
      <input type="hidden" name="q" value={query} />
      <input type="hidden" name="category" value={category} />

      <Select
        className={styles.field}
        label="Thành phố"
        name="city"
        value={city}
        onChange={(event) => router.push(hrefWith({ city: event.target.value }))}
        options={[
          { value: 'all', label: 'Tất cả' },
          ...cities.map((name) => ({ value: name, label: name })),
        ]}
      />

      <Select
        className={styles.field}
        label="Thời gian"
        name="window"
        value={window}
        onChange={(event) => router.push(hrefWith({ window: event.target.value }))}
        options={TIME_WINDOWS.map((item) => ({ value: item.value, label: item.label }))}
      />

      <Select
        className={styles.field}
        label="Sắp xếp"
        name="sort"
        value={sort}
        onChange={(event) => router.push(hrefWith({ sort: event.target.value }))}
        options={SORTS.map((item) => ({ value: item.value, label: item.label }))}
      />

      <noscript>
        <button className={styles.apply} type="submit">
          Áp dụng
        </button>
      </noscript>

      {isFiltered ? (
        <Link className={styles.clear} href="/events">
          Xoá bộ lọc
        </Link>
      ) : null}
    </form>
  );
}
