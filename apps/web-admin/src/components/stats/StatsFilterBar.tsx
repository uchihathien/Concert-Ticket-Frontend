'use client';

import { useAdminEvent, useOrganizationDashboard } from '@nexaticket/ts-sdk';
import { Button, FilterBar, Input, Select, formatDateTime } from '@nexaticket/ui';
import { useMemo } from 'react';
import {
  ALL_TIME_DAYS,
  HOURLY_MAX_DAYS,
  addDays,
  todayInVietnam,
  type BucketChoice,
  type ResolvedFilters,
  type StatsFilters,
  type StatsRange,
} from '@/lib/stats-filters';
import { formatDay } from '@/lib/stats-math';
import { EventPicker } from './EventPicker';

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'all', label: 'Toàn thời gian' },
  { value: 'custom', label: 'Tùy chọn' },
];

/**
 * Hàng bộ lọc chung của các trang thống kê.
 *
 * Suất diễn và loại vé chỉ chọn được khi đang xem ĐÚNG MỘT sự kiện: chúng là thuộc tính của sự kiện
 * ấy, và danh sách suất của ba mươi sự kiện gộp lại là một danh sách không ai chọn nổi.
 */
export function StatsFilterBar({
  organizationId,
  filters,
  resolved,
  onChange,
  onReset,
  showTicketType = true,
  showBucket = true,
  showCompare = true,
}: {
  organizationId: string;
  filters: StatsFilters;
  resolved: ResolvedFilters;
  onChange: (patch: Partial<StatsFilters>) => void;
  onReset: () => void;
  showTicketType?: boolean;
  showBucket?: boolean;
  showCompare?: boolean;
}) {
  const dashboard = useOrganizationDashboard(organizationId);
  const singleEventId = filters.eventIds.length === 1 ? filters.eventIds[0] : null;
  const event = useAdminEvent(organizationId, singleEventId);

  const eventOptions = useMemo(
    () =>
      (dashboard.data?.events ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        hint: row.venueName ?? undefined,
      })),
    [dashboard.data],
  );

  const sessions = useMemo(() => event.data?.sessions ?? [], [event.data]);
  // Loại vé của suất đang chọn, hoặc của mọi suất nếu chưa chọn suất — gộp theo mã để không lặp.
  const ticketTypes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const session of sessions) {
      if (filters.sessionId && session.id !== filters.sessionId) continue;
      for (const type of session.ticketTypes) {
        seen.set(type.id, sessions.length > 1 && !filters.sessionId ? `${type.name} · ${formatDateTime(session.startsAt)}` : type.name);
      }
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [sessions, filters.sessionId]);

  const today = todayInVietnam();
  const dirty =
    filters.eventIds.length > 0 ||
    filters.sessionId !== '' ||
    filters.ticketTypeId !== '' ||
    filters.range !== '30d' ||
    filters.bucket !== 'auto' ||
    !filters.compare;

  const bucketOptions: { value: BucketChoice; label: string; disabled?: boolean }[] = [
    { value: 'auto', label: 'Tự động' },
    // Server từ chối gom theo giờ quá 14 ngày; khoá sẵn lựa chọn thay vì để người dùng gặp lỗi.
    { value: 'hour', label: 'Giờ', disabled: resolved.days > HOURLY_MAX_DAYS },
    { value: 'day', label: 'Ngày' },
    { value: 'week', label: 'Tuần' },
  ];

  return (
    <FilterBar
      count={
        <>
          {formatDay(resolved.params.from)} – {formatDay(resolved.params.to)} · {resolved.days} ngày · giờ Việt Nam
          {filters.range === 'all' ? ` · tối đa ${ALL_TIME_DAYS} ngày gần nhất` : ''}
        </>
      }
      actions={
        dirty ? (
          <Button variant="secondary" onClick={onReset}>
            Xoá bộ lọc
          </Button>
        ) : undefined
      }
    >
      <EventPicker
        options={eventOptions}
        selected={filters.eventIds}
        loading={dashboard.isPending}
        onChange={(eventIds) => onChange({ eventIds })}
      />
      <Select
        label="Suất diễn"
        placeholder={singleEventId ? 'Mọi suất' : 'Chọn một sự kiện trước'}
        value={filters.sessionId}
        disabled={!singleEventId}
        options={sessions.map((session) => ({ value: session.id, label: formatDateTime(session.startsAt) }))}
        // Đổi suất thì loại vé của suất cũ không còn nghĩa.
        onChange={(e) => onChange({ sessionId: e.target.value, ticketTypeId: '' })}
      />
      {showTicketType ? (
        <Select
          label="Loại vé"
          placeholder={singleEventId ? 'Mọi loại vé' : 'Chọn một sự kiện trước'}
          value={filters.ticketTypeId}
          disabled={!singleEventId}
          options={ticketTypes}
          onChange={(e) => onChange({ ticketTypeId: e.target.value })}
        />
      ) : null}
      <Select
        label="Khoảng thời gian"
        value={filters.range}
        options={RANGE_OPTIONS}
        onChange={(e) => {
          const range = e.target.value as StatsRange;
          // Vào "Tùy chọn" với sẵn 30 ngày gần nhất: hai ô ngày trống là một bộ lọc chưa dùng được.
          onChange(range === 'custom' ? { range, from: addDays(today, -29), to: today } : { range });
        }}
      />
      {filters.range === 'custom' ? (
        <>
          <Input
            label="Từ ngày"
            type="date"
            value={filters.from}
            max={filters.to || today}
            onChange={(e) => e.target.value && onChange({ from: e.target.value })}
          />
          <Input
            label="Đến ngày"
            type="date"
            value={filters.to}
            min={filters.from}
            max={today}
            onChange={(e) => e.target.value && onChange({ to: e.target.value })}
          />
        </>
      ) : null}
      {showBucket ? (
        <Select
          label="Đơn vị biểu đồ"
          value={filters.bucket === 'hour' && resolved.days > HOURLY_MAX_DAYS ? 'day' : filters.bucket}
          options={bucketOptions}
          onChange={(e) => onChange({ bucket: e.target.value as BucketChoice })}
        />
      ) : null}
      {showCompare ? (
        <Select
          label="So sánh"
          value={resolved.compare ? '1' : '0'}
          disabled={filters.range === 'all'}
          options={[
            { value: '1', label: 'Với kỳ trước' },
            { value: '0', label: 'Không so sánh' },
          ]}
          onChange={(e) => onChange({ compare: e.target.value === '1' })}
        />
      ) : null}
    </FilterBar>
  );
}
