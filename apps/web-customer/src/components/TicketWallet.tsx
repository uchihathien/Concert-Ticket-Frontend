'use client';

import { useMyTickets, type Ticket } from '@nexaticket/ts-sdk';
import {
  Badge,
  EmptyState,
  QrCode,
  Skeleton,
  cx,
  foldText,
  formatDateLong,
  formatTime,
  matchesText,
} from '@nexaticket/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { SessionIndex, SessionInfo } from '@/lib/session-index';
import { ApiErrorState } from './ApiErrorState';
import styles from './wallet.module.css';

export interface TicketWalletProps {
  /** Tra ngược `eventSessionId` → sự kiện, dựng ở phía server từ catalog công khai. */
  sessionIndex: SessionIndex;
}

/**
 * Ví vé.
 *
 * Gọi API từ trình duyệt chứ không ở server: đây là dữ liệu riêng của từng người, không cần SEO,
 * và `qrToken` được backend ký lại mỗi lần đọc nên phải tươi. Gateway đã khai CORS cho
 * `http://localhost:3000` với header `authorization`, nên đường này đi được.
 *
 * Nhóm theo suất diễn chứ không liệt kê phẳng: khách mua bốn vé cho một buổi thì đó là *một*
 * việc trong đầu họ, không phải bốn.
 *
 * <h3>Lọc ở client, và ở đây điều đó đúng</h3>
 *
 * Ngược với bảng tra cứu của ban tổ chức (hàng chục nghìn vé, lọc ở database): ví của một người là
 * vài chục vé, đã nằm sẵn trong bộ nhớ. Gọi lại mạng cho mỗi lần gõ phím là thêm độ trễ cho một
 * phép lọc chạy mất chưa tới một mili giây.
 *
 * Mặc định là **Sắp diễn ra**. Ví mở ra mà trên cùng là concert năm ngoái thì việc đầu tiên khách
 * phải làm là cuộn qua chỗ mình không cần.
 */
export function TicketWallet({ sessionIndex }: TicketWalletProps) {
  const { data, isPending, error, refetch } = useMyTickets();
  const [when, setWhen] = useState<WhenFilter>('upcoming');
  const [query, setQuery] = useState('');

  const groups = useMemo(
    () => (data ? filterGroups(groupBySession(data, sessionIndex), when, query) : []),
    [data, sessionIndex, when, query],
  );

  if (isPending) {
    return (
      <div className={styles.list}>
        <Skeleton height={140} />
        <Skeleton height={140} />
      </div>
    );
  }

  if (error) {
    return <ApiErrorState error={error} onRetry={() => void refetch()} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="Chưa có vé nào"
        description="Vé sẽ xuất hiện ở đây ngay sau khi đơn hàng được thanh toán."
        action={
          <Link className={styles.emptyLink} href="/events">
            Xem sự kiện đang bán
          </Link>
        }
      />
    );
  }

  return (
    <div className={styles.list}>
      <div className={styles.filters}>
        <div className={styles.segmented} role="group" aria-label="Lọc theo thời gian">
          {WHEN_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cx(styles.segment, when === option.value && styles.segmentOn)}
              aria-pressed={when === option.value}
              onClick={() => setWhen(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className={styles.searchLabel} htmlFor="wallet-search">
          Tìm vé
        </label>
        <input
          id="wallet-search"
          type="search"
          className={styles.search}
          value={query}
          placeholder="Tên sự kiện, hạng vé hoặc ghế"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {groups.length === 0 ? (
        // Khác hẳn "chưa có vé nào" ở trên: ở đây khách CÓ vé, chỉ là bộ lọc đang giấu chúng đi.
        // Gộp hai câu làm một sẽ nói với người vừa mua vé rằng họ chưa mua gì.
        <EmptyState
          title="Không có vé nào khớp"
          description={
            when === 'upcoming'
              ? 'Không có vé cho sự kiện sắp diễn ra. Thử xem mục “Đã qua”.'
              : 'Thử bỏ bớt từ khoá tìm kiếm.'
          }
        />
      ) : null}

      {groups.map((group) => (
        <section key={group.eventSessionId} className={styles.group}>
          <header className={styles.groupHead}>
            <div>
              <h2 className={styles.groupTitle}>
                {group.info ? (
                  <Link href={`/events/${group.info.slug}`}>{group.info.eventTitle}</Link>
                ) : (
                  'Sự kiện không còn được đăng bán'
                )}
              </h2>
              <p className={styles.groupMeta}>
                {group.info
                  ? `${formatDateLong(group.info.startsAt)} · ${formatTime(group.info.startsAt)}${
                      group.info.venueName ? ` · ${group.info.venueName}` : ''
                    }`
                  : `Mã suất ${group.eventSessionId}`}
              </p>
            </div>
            <span className={styles.groupCount}>{group.tickets.length} vé</span>
          </header>

          <ul className={styles.tickets}>
            {group.tickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Một vé. Mã QR ẩn cho tới khi bấm.
 *
 * Không hiện sẵn tất cả: một đơn bốn vé sẽ thành bốn mã QR to trên màn, khách dễ chìa nhầm mã ở
 * cửa. Mở từng mã cũng là ranh giới tự nhiên để tránh người đứng cạnh chụp trộm cả loạt.
 */
function TicketRow({ ticket }: { ticket: Ticket }) {
  const [open, setOpen] = useState(false);
  const usable = ticket.status === 'VALID';

  return (
    <li className={styles.ticket}>
      <div className={styles.ticketMain}>
        <div>
          <p className={styles.ticketType}>{ticket.ticketTypeName}</p>
          <p className={styles.ticketSeat}>
            {ticket.seatLabel
              ? `Ghế ${ticket.seatLabel}`
              : `Khu ${ticket.zoneCode} · vé đứng, không đánh số`}
          </p>
        </div>

        <div className={styles.ticketActions}>
          <TicketStatusBadge ticket={ticket} />
          {usable ? (
            <button
              type="button"
              className={styles.qrToggle}
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? 'Ẩn mã' : 'Hiện mã QR'}
            </button>
          ) : null}
        </div>
      </div>

      {open && usable ? (
        <div className={styles.qrBox}>
          <QrCode
            value={ticket.qrToken}
            size={200}
            label={`Mã vào cửa cho ${ticket.ticketTypeName}`}
          />
          <p className={styles.qrNote}>
            Đưa mã này cho nhân viên soát vé. Mã có hạn — mở lại trang nếu máy quét báo hết hạn.
          </p>
        </div>
      ) : null}
    </li>
  );
}

function TicketStatusBadge({ ticket }: { ticket: Ticket }) {
  if (ticket.status === 'CHECKED_IN') {
    return (
      <Badge tone="success">
        {ticket.checkedInAt ? `Đã vào ${formatTime(ticket.checkedInAt)}` : 'Đã vào cửa'}
      </Badge>
    );
  }
  if (ticket.status === 'REVOKED') return <Badge tone="danger">Đã huỷ</Badge>;
  return <Badge tone="neutral">Còn hiệu lực</Badge>;
}

type WhenFilter = 'upcoming' | 'past' | 'all';

const WHEN_FILTERS: Array<{ value: WhenFilter; label: string }> = [
  { value: 'upcoming', label: 'Sắp diễn ra' },
  { value: 'past', label: 'Đã qua' },
  { value: 'all', label: 'Tất cả' },
];

/**
 * Lọc theo thời gian và từ khoá.
 *
 * <p>Suất không tra được (sự kiện đã gỡ đăng bán) **luôn được giữ lại** ở bộ lọc thời gian: không
 * biết ngày thì không có cơ sở gọi nó là đã qua, và giấu đi một cái vé khách đã trả tiền là hỏng
 * nặng hơn nhiều so với hiện thừa một dòng.
 *
 * <p>So khớp trên cả nhóm chứ không trên từng vé: khách gõ tên sự kiện thì họ muốn cả buổi ấy,
 * không phải một vé trong buổi.
 */
function filterGroups(groups: Group[], when: WhenFilter, query: string): Group[] {
  const now = Date.now();

  return groups.filter((group) => {
    if (when !== 'all' && group.info) {
      const startsAt = Date.parse(group.info.startsAt);
      if (!Number.isNaN(startsAt)) {
        const upcoming = startsAt >= now;
        if (when === 'upcoming' && !upcoming) return false;
        if (when === 'past' && upcoming) return false;
      }
    }

    // `matchesText` so khớp trên chuỗi ĐÃ fold, nên needle phải fold trước — nếu không, gõ có
    // dấu sẽ không khớp gì cả.
    const needle = foldText(query.trim());
    if (!needle) return true;

    return matchesText(needle, [
      group.info?.eventTitle ?? null,
      group.info?.venueName ?? null,
      ...group.tickets.map((ticket) => ticket.ticketTypeName),
      ...group.tickets.map((ticket) => ticket.seatLabel),
      ...group.tickets.map((ticket) => ticket.zoneCode),
    ]);
  });
}

interface Group {
  eventSessionId: string;
  info: SessionInfo | null;
  tickets: Ticket[];
}

/**
 * Gộp vé theo suất, suất gần nhất lên trước.
 *
 * Suất không tra được (sự kiện đã gỡ đăng bán) xếp xuống cuối thay vì bị loại: vé đó vẫn là vé
 * khách đã trả tiền, giấu đi thì họ tưởng mình mất vé.
 */
function groupBySession(tickets: Ticket[], index: SessionIndex): Group[] {
  const groups = new Map<string, Group>();

  for (const ticket of tickets) {
    const existing = groups.get(ticket.eventSessionId);
    if (existing) {
      existing.tickets.push(ticket);
      continue;
    }
    groups.set(ticket.eventSessionId, {
      eventSessionId: ticket.eventSessionId,
      info: index[ticket.eventSessionId] ?? null,
      tickets: [ticket],
    });
  }

  return [...groups.values()].sort((a, b) => {
    if (!a.info) return 1;
    if (!b.info) return -1;
    return a.info.startsAt.localeCompare(b.info.startsAt);
  });
}
