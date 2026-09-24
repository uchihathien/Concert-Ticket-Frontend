'use client';

import { useOrder, useOrderTickets, type Ticket } from '@nexaticket/ts-sdk';
import {
  Badge,
  Modal,
  QrCode,
  Skeleton,
  TicketPoster,
  formatDateLong,
  formatTime,
} from '@nexaticket/ui';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { SessionIndex, SessionInfo } from '@/lib/session-index';
import { ApiErrorState } from './ApiErrorState';
import styles from './order-tickets.module.css';

export interface OrderTicketsProps {
  orderId: string;
  /** Tra ngược `eventSessionId` → sự kiện, dựng ở server từ catalog công khai. */
  sessionIndex: SessionIndex;
}

/** Vé phát hành bất đồng bộ nên phải hỏi lại; 2 giây là đủ nhanh mà không ồn. */
const POLL_MS = 2_000;

/**
 * Bước "Nhận vé" — vé của **đúng một đơn**, mã QR hiện sẵn.
 *
 * <h3>Vì sao không đổ về ví vé chung</h3>
 *
 * Bản trước, trả tiền xong là `router.replace('/me/tickets')`. Ví vé là danh sách **mọi** vé đã
 * mua, nên người vừa mua hai vé rơi vào một trang có ba mươi vé và phải tự tìm hai cái của mình —
 * đúng vào lúc câu hỏi duy nhất trong đầu họ là "tôi đã lấy được vé chưa". Thanh ba bước cũng hứa
 * "Nhận vé" là một bước riêng, mà bước đó lại không có trang nào.
 *
 * <h3>Vì sao mã QR mở sẵn ở đây, còn trong ví vé thì không</h3>
 *
 * Hai màn trả lời hai câu khác nhau. Ở đây là "vé của tôi đây rồi" — khách muốn thấy tận mắt, và
 * thường chụp lại màn hình ngay. Trong ví vé thì câu hỏi là "đưa mã nào cho nhân viên soát", nên
 * mở sẵn bốn mã cạnh nhau chỉ làm tăng khả năng chìa nhầm mã ở cửa.
 *
 * <h3>Vé chưa có ngay</h3>
 *
 * `ticketing-service` phát vé khi nhận sự kiện `order.paid` qua hàng đợi — chậm hơn lúc đơn sang
 * `PAID` vài giây. Trang này chịu được khoảng đó: nó nói rõ đang phát vé và tự hỏi lại, thay vì
 * để trang thanh toán chờ hộ rồi mới chuyển. Nhờ vậy khách thấy "đã thanh toán" ngay lập tức.
 */
export function OrderTickets({ orderId, sessionIndex }: OrderTicketsProps) {
  /** Vé đang mở ảnh. `null` là đóng — một state cho cả hai câu hỏi "mở hay chưa" và "mở vé nào". */
  const [posterFor, setPosterFor] = useState<Ticket | null>(null);

  const order = useOrder(orderId);
  const paid = order.data?.status === 'PAID';

  const tickets = useOrderTickets(orderId);
  const issued = (tickets.data?.length ?? 0) > 0;

  // Chỉ hỏi lại khi đơn đã trả tiền mà vé chưa về. Đơn chưa trả thì hỏi lại là vô nghĩa.
  const shouldPoll = paid && !issued;

  if (order.isPending) {
    return (
      <div className={styles.loading} aria-busy="true">
        <Skeleton height={200} />
      </div>
    );
  }

  if (order.error) {
    return <ApiErrorState error={order.error} onRetry={() => void order.refetch()} />;
  }

  if (order.data && order.data.status !== 'PAID') {
    // Vào đây bằng đường dẫn tay, hoặc đơn hết hạn giữa lúc đang mở tab. Không hiện vé — không có
    // vé nào — và dẫn về đúng chỗ xử lý tiếp.
    return (
      <div className={styles.notice} role="status">
        <p className={styles.noticeTitle}>Đơn này chưa được thanh toán</p>
        <p className={styles.noticeNote}>
          Vé chỉ phát hành sau khi tiền về. Mở lại trang thanh toán để hoàn tất, hoặc xem trạng thái
          đơn.
        </p>
        <div className={styles.noticeActions}>
          <Link className={styles.primary} href={`/orders/${orderId}/pay`}>
            Tới trang thanh toán
          </Link>
          <Link className={styles.secondary} href="/me/orders">
            Đơn hàng của tôi
          </Link>
        </div>
      </div>
    );
  }

  if (tickets.error) {
    return <ApiErrorState error={tickets.error} onRetry={() => void tickets.refetch()} />;
  }

  if (!issued) {
    return (
      <div className={styles.notice} role="status" aria-live="polite">
        <p className={styles.noticeTitle}>Đã nhận được thanh toán</p>
        <p className={styles.noticeNote}>
          Đang phát vé, thường mất vài giây. Trang tự cập nhật, bạn không cần bấm gì.
        </p>
        <Poller onTick={() => void tickets.refetch()} enabled={shouldPoll} />
        <div className={styles.noticeActions}>
          <Link className={styles.secondary} href="/me/tickets">
            Xem ví vé
          </Link>
        </div>
      </div>
    );
  }

  // `issued` đã bảo đảm có vé, nhưng TypeScript không suy ra được điều đó từ một biến boolean —
  // lấy ra một biến riêng để phần dưới không phải rắc `?.` khắp nơi.
  const issuedTickets = tickets.data ?? [];
  const groups = groupBySession(issuedTickets, sessionIndex);
  const posterInfo = posterFor ? sessionIndex[posterFor.eventSessionId] : undefined;

  return (
    <div className={styles.wrap}>
      <p className={styles.count} role="status">
        Đã phát {issuedTickets.length} vé cho đơn {order.data?.orderNumber ?? ''}. Đưa mã QR cho
        nhân viên soát vé ở cửa vào.
      </p>

      {groups.map((group) => (
        <section key={group.eventSessionId} className={styles.group}>
          <header className={styles.groupHead}>
            <h2 className={styles.groupTitle}>
              {group.info ? (
                <Link href={`/events/${group.info.slug}`}>{group.info.eventTitle}</Link>
              ) : (
                'Sự kiện'
              )}
            </h2>
            {group.info ? (
              <p className={styles.groupMeta}>
                {formatDateLong(group.info.startsAt)} · {formatTime(group.info.startsAt)}
                {group.info.venueName ? ` · ${group.info.venueName}` : ''}
              </p>
            ) : null}
          </header>

          <ul className={styles.tickets}>
            {group.tickets.map((ticket) => (
              <li key={ticket.id} className={styles.ticket}>
                <div className={styles.qrBox}>
                  {ticket.status === 'VALID' ? (
                    <QrCode
                      value={ticket.qrToken}
                      size={168}
                      label={`Mã vào cửa cho ${ticket.ticketTypeName}`}
                    />
                  ) : (
                    // Vé đã soát hoặc đã huỷ thì mã không còn dùng được — hiện nó ra chỉ tạo hy
                    // vọng sai ở cửa vào.
                    <div className={styles.qrVoid} aria-hidden="true" />
                  )}
                </div>

                <p className={styles.ticketType}>{ticket.ticketTypeName}</p>
                <p className={styles.ticketSeat}>
                  {ticket.seatLabel ? `Ghế ${ticket.seatLabel}` : `Khu ${ticket.zoneCode}`}
                </p>
                <TicketBadge ticket={ticket} />

                {/*
                  Poster dựng theo yêu cầu, không dựng sẵn cho cả danh sách: mỗi cái là một mã QR
                  vài nghìn ô cộng một khổ ảnh 800×1200. Ba mươi vé dựng sẵn là ba mươi lần việc
                  đó, cho một thứ phần lớn khách không mở tới.
                */}
                {ticket.status === 'VALID' ? (
                  <button
                    type="button"
                    className={styles.posterButton}
                    onClick={() => setPosterFor(ticket)}
                  >
                    Tạo ảnh vé
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className={styles.footActions}>
        <Link className={styles.primary} href="/me/tickets">
          Xem tất cả vé của tôi
        </Link>
        <Link className={styles.secondary} href="/events">
          Tiếp tục xem sự kiện
        </Link>
      </div>

      <Modal
        open={posterFor !== null}
        onClose={() => setPosterFor(null)}
        title="Ảnh vé"
      >
        {posterFor ? (
          <TicketPoster
            eventTitle={posterInfo?.eventTitle ?? 'Sự kiện'}
            // Định dạng ở đây, không ở backend: chỗ này biết ngôn ngữ và múi giờ của người đang xem.
            sessionAt={
              posterInfo
                ? `${formatDateLong(posterInfo.startsAt)} · ${formatTime(posterInfo.startsAt)}`
                : ''
            }
            venueLine={
              posterInfo?.venueName
                ? `${posterInfo.venueName}${posterInfo.city ? `, ${posterInfo.city}` : ''}`
                : null
            }
            zoneCode={posterFor.zoneCode}
            seatLabel={posterFor.seatLabel}
            ticketTypeName={posterFor.ticketTypeName}
            ticketCode={posterFor.id.slice(0, 8).toUpperCase()}
            qrToken={posterFor.qrToken}
          />
        ) : null}
      </Modal>

      <p className={styles.hint}>
        Vé luôn nằm trong <Link href="/me/tickets">Vé của tôi</Link> — không cần chụp lại màn hình,
        nhưng chụp cũng không sao.
      </p>
    </div>
  );
}

/**
 * Hỏi lại theo nhịp, tách riêng thành component.
 *
 * Không đặt `useEffect` ở component cha vì cha có nhiều nhánh `return` sớm — hook nào nằm sau một
 * `return` có điều kiện là vi phạm luật hook. Đưa vòng lặp vào một component chỉ được render đúng
 * lúc cần thì nhánh nào cũng an toàn.
 */
function Poller({ onTick, enabled }: { onTick: () => void; enabled: boolean }) {
  // Giữ hàm mới nhất trong ref: `onTick` là closure mới mỗi lần render, đưa nó vào deps thì
  // interval bị dựng lại liên tục và nhịp hỏi lại trở thành ngẫu nhiên.
  const latest = useRef(onTick);
  latest.current = onTick;

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => latest.current(), POLL_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  return null;
}

function TicketBadge({ ticket }: { ticket: Ticket }) {
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
  return [...groups.values()];
}
