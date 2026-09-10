'use client';

import { useMyTickets, type Ticket } from '@nexaticket/ts-sdk';
import { Badge, EmptyState, QrCode, Skeleton, formatDateLong, formatTime } from '@nexaticket/ui';
import Link from 'next/link';
import { useState } from 'react';
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
 */
export function TicketWallet({ sessionIndex }: TicketWalletProps) {
  const { data, isPending, error, refetch } = useMyTickets();

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

  const groups = groupBySession(data, sessionIndex);

  return (
    <div className={styles.list}>
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
