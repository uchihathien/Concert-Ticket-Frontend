'use client';

import type { SalesStatsParams, StatsBucket } from '@nexaticket/ts-sdk';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * Bộ lọc chung của các trang thống kê, lưu trên URL.
 *
 * <h3>Vì sao là URL chứ không phải `useState`</h3>
 *
 * Ban tổ chức gửi cho nhau đúng cái họ đang nhìn ("doanh thu 7 ngày của đêm diễn này"), và tải lại
 * trang không được làm mất nó.
 *
 * <h3>Ngày luôn là ngày Việt Nam</h3>
 *
 * "Hôm nay" tính theo `Asia/Ho_Chi_Minh`, không theo múi giờ của trình duyệt: server gom theo giờ
 * Việt Nam, và một người mở trang ở múi giờ khác không được thấy một "hôm nay" khác.
 */

export type StatsRange = 'today' | '7d' | '30d' | 'all' | 'custom';
export type BucketChoice = StatsBucket | 'auto';

export interface StatsFilters {
  eventIds: string[];
  sessionId: string;
  ticketTypeId: string;
  range: StatsRange;
  /** Chỉ có nghĩa khi `range === 'custom'`. */
  from: string;
  to: string;
  bucket: BucketChoice;
  compare: boolean;
}

/** Server chặn 731 ngày; "toàn thời gian" là đúng trần ấy. */
export const ALL_TIME_DAYS = 731;
/** Server chặn gom theo giờ ở 14 ngày. */
export const HOURLY_MAX_DAYS = 14;

const RANGES: StatsRange[] = ['today', '7d', '30d', 'all', 'custom'];
const BUCKETS: BucketChoice[] = ['auto', 'hour', 'day', 'week'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function todayInVietnam(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

function list(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

export function parseFilters(search: URLSearchParams): StatsFilters {
  const range = search.get('range') as StatsRange | null;
  const bucket = search.get('bucket') as BucketChoice | null;
  const from = search.get('from') ?? '';
  const to = search.get('to') ?? '';
  const customOk = DATE.test(from) && DATE.test(to) && from <= to;
  return {
    eventIds: list(search.get('events')),
    sessionId: search.get('session') ?? '',
    ticketTypeId: search.get('type') ?? '',
    // Một URL `range=custom` thiếu ngày (hoặc ngày ngược) rơi về mặc định thay vì gửi lên server
    // một yêu cầu chắc chắn bị từ chối.
    range: range && RANGES.includes(range) && (range !== 'custom' || customOk) ? range : '30d',
    from: customOk ? from : '',
    to: customOk ? to : '',
    bucket: bucket && BUCKETS.includes(bucket) ? bucket : 'auto',
    compare: search.get('compare') !== '0',
  };
}

export interface ResolvedFilters {
  params: SalesStatsParams;
  bucket: StatsBucket;
  /** So sánh thực sự được gửi đi: tắt với "toàn thời gian" vì không có kỳ trước nào có nghĩa. */
  compare: boolean;
  days: number;
}

export function resolveFilters(filters: StatsFilters): ResolvedFilters {
  const today = todayInVietnam();
  let from = today;
  let to = today;
  if (filters.range === '7d') from = addDays(today, -6);
  if (filters.range === '30d') from = addDays(today, -29);
  if (filters.range === 'all') from = addDays(today, -(ALL_TIME_DAYS - 1));
  if (filters.range === 'custom') {
    from = filters.from;
    // Kỳ tự chọn dài hơn trần thì cắt đầu xa: người dùng vẫn thấy số, và ô ngày nói rõ đã cắt.
    to = filters.to;
    if (daysBetween(from, to) > ALL_TIME_DAYS) from = addDays(to, -(ALL_TIME_DAYS - 1));
  }
  const days = daysBetween(from, to);

  let bucket: StatsBucket;
  if (filters.bucket === 'auto') {
    bucket = days <= 2 ? 'hour' : days <= 92 ? 'day' : 'week';
  } else {
    bucket = filters.bucket === 'hour' && days > HOURLY_MAX_DAYS ? 'day' : filters.bucket;
  }

  return {
    params: {
      from,
      to,
      eventIds: filters.eventIds.length > 0 ? filters.eventIds : undefined,
      sessionIds: filters.sessionId ? [filters.sessionId] : undefined,
      ticketTypeIds: filters.ticketTypeId ? [filters.ticketTypeId] : undefined,
    },
    bucket,
    compare: filters.compare && filters.range !== 'all',
    days,
  };
}

export function useStatsFilters() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(() => parseFilters(new URLSearchParams(search.toString())), [search]);
  const resolved = useMemo(() => resolveFilters(filters), [filters]);

  const update = useCallback(
    (patch: Partial<StatsFilters>) => {
      const next = { ...filters, ...patch };
      // Suất và loại vé là thuộc tính của MỘT sự kiện. Đổi tập sự kiện mà giữ chúng lại sẽ cho ra
      // một bộ lọc không bao giờ khớp dòng nào, và không có gì nói vì sao.
      if (patch.eventIds && next.eventIds.join() !== filters.eventIds.join()) {
        next.sessionId = '';
        next.ticketTypeId = '';
      }
      const query = new URLSearchParams();
      // `org` không phải bộ lọc của trang này nhưng nằm chung URL: làm rơi nó là đổi tổ chức đang xem.
      const org = search.get('org');
      if (org) query.set('org', org);
      if (next.eventIds.length > 0) query.set('events', next.eventIds.join(','));
      if (next.sessionId) query.set('session', next.sessionId);
      if (next.ticketTypeId) query.set('type', next.ticketTypeId);
      if (next.range !== '30d') query.set('range', next.range);
      if (next.range === 'custom') {
        query.set('from', next.from);
        query.set('to', next.to);
      }
      if (next.bucket !== 'auto') query.set('bucket', next.bucket);
      if (!next.compare) query.set('compare', '0');
      const text = query.toString();
      // `replace`: mỗi lần đổi bộ lọc không nên là một bước trong lịch sử — nút Quay lại phải đưa
      // người dùng về trang trước, không phải về bộ lọc trước.
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    },
    [filters, pathname, router, search],
  );

  const reset = useCallback(() => {
    const org = search.get('org');
    router.replace(org ? `${pathname}?org=${encodeURIComponent(org)}` : pathname, { scroll: false });
  }, [pathname, router, search]);

  return { filters, resolved, update, reset, queryString: search.toString() };
}
