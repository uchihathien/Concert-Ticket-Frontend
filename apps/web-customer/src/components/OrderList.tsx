'use client';

import {
  ApiError,
  useCancelOrder,
  useMyOrders,
  useMyTickets,
  type Order,
  type OrderItem,
  type OrderStatus,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  CopyField,
  Countdown,
  EmptyState,
  MoneyText,
  QrCode,
  Skeleton,
  cx,
  formatDateLong,
  formatDateTime,
  formatTime,
  useToast,
} from '@nexaticket/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { SessionIndex, SessionInfo } from '@/lib/session-index';
import { ApiErrorState } from './ApiErrorState';
import styles from './wallet.module.css';

export interface OrderListProps {
  sessionIndex: SessionIndex;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  EXPIRED: 'Quá hạn chuyển khoản',
  CANCELLED: 'Bạn đã huỷ',
  REFUNDED: 'Đã hoàn tiền',
  MANUAL_REVIEW: 'Đang đối soát',
};

const STATUS_TONE: Record<OrderStatus, 'neutral' | 'accent' | 'success' | 'warn' | 'danger'> = {
  AWAITING_PAYMENT: 'warn',
  PAID: 'success',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',
  REFUNDED: 'accent',
  // Không dùng 'danger': với khách thì đây không phải lỗi của họ, và một nhãn đỏ ở màn ví đơn
  // hàng đọc như "bạn đã làm sai gì đó". Tiền đã tới, việc còn lại là của nền tảng.
  MANUAL_REVIEW: 'warn',
};

type StatusGroup = 'all' | 'awaiting' | 'paid' | 'closed';

/**
 * Gộp sáu trạng thái thành ba việc.
 *
 * <p>Dùng `Set` chứ không dùng chuỗi `||`: thêm một trạng thái mới ở backend thì đây là chỗ duy
 * nhất phải sửa, và quên sửa sẽ làm đơn ấy biến mất khỏi MỌI tab thay vì lặng lẽ rơi nhầm nhóm.
 *
 * <p>`MANUAL_REVIEW` nằm cùng nhóm "đã thanh toán": tiền đã tới, việc còn lại là của nền tảng.
 * Xếp nó vào nhóm "đã đóng" sẽ nói với khách rằng đơn hỏng, trong khi họ vừa trả tiền xong.
 */
const STATUS_GROUPS: Record<StatusGroup, ReadonlySet<OrderStatus>> = {
  all: new Set<OrderStatus>([
    'AWAITING_PAYMENT',
    'PAID',
    'EXPIRED',
    'CANCELLED',
    'REFUNDED',
    'MANUAL_REVIEW',
  ]),
  awaiting: new Set<OrderStatus>(['AWAITING_PAYMENT']),
  paid: new Set<OrderStatus>(['PAID', 'MANUAL_REVIEW']),
  closed: new Set<OrderStatus>(['EXPIRED', 'CANCELLED', 'REFUNDED']),
};

const STATUS_FILTERS: Array<{ value: StatusGroup; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'awaiting', label: 'Chờ thanh toán' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'closed', label: 'Đã đóng' },
];

/**
 * Danh sách đơn hàng của khách.
 *
 * `OrderView` của backend **không có** `eventSessionId`, nên bản thân đơn hàng không nói được nó
 * thuộc sự kiện nào. Ở đây bắc cầu qua ví vé: vé mang cả `orderId` lẫn `eventSessionId`. Cầu này
 * chỉ bắc được cho đơn ĐÃ thanh toán — đơn đang chờ tiền thì chưa có vé nào, và ta chỉ hiện được
 * tên hạng vé.
 *
 * Việc cần báo backend: thêm `eventSessionId` vào `OrderView`. Không có nó thì mọi client đều
 * phải bịa ra một cách bắc cầu riêng, và cách nào cũng hỏng ở đơn chưa thanh toán.
 */
export function OrderList({ sessionIndex }: OrderListProps) {
  const orders = useMyOrders({ limit: 50 });
  const tickets = useMyTickets({ limit: 100 });
  const cancel = useCancelOrder();
  const toast = useToast();
  const [group, setGroup] = useState<StatusGroup>('all');

  // Lọc tại chỗ: 50 đơn đã nằm trong bộ nhớ, và `GET /v1/me/orders` không nhận tham số trạng thái.
  // Thêm nó vào backend chỉ đáng khi một người có hàng nghìn đơn — chuyện không xảy ra với ví của
  // khách mua vé.
  const visible = useMemo(
    () => (orders.data ?? []).filter((order) => STATUS_GROUPS[group].has(order.status)),
    [orders.data, group],
  );

  if (orders.isPending) {
    return (
      <div className={styles.list}>
        <Skeleton height={160} />
        <Skeleton height={160} />
      </div>
    );
  }

  if (orders.error) {
    return <ApiErrorState error={orders.error} onRetry={() => void orders.refetch()} />;
  }

  if (orders.data.length === 0) {
    return (
      <EmptyState
        title="Chưa có đơn hàng nào"
        description="Đơn hàng xuất hiện ở đây ngay khi bạn đặt vé, kể cả khi chưa chuyển khoản."
        action={
          <Link className={styles.emptyLink} href="/events">
            Xem sự kiện đang bán
          </Link>
        }
      />
    );
  }

  // orderId → suất diễn, bắc qua ví vé. Ví chưa tải xong thì bảng rỗng và phần tên sự kiện tạm ẩn
  // — không chặn cả danh sách đơn chỉ vì thiếu phần trang trí.
  const sessionOf = new Map<string, SessionInfo>();
  for (const ticket of tickets.data ?? []) {
    const info = sessionIndex[ticket.eventSessionId];
    if (info && !sessionOf.has(ticket.orderId)) sessionOf.set(ticket.orderId, info);
  }

  return (
    <div className={styles.list}>
      {/*
        Nhóm theo VIỆC PHẢI LÀM, không theo từng mã trạng thái. Khách không phân biệt EXPIRED với
        CANCELLED — cả hai đều là "đơn này hỏng rồi". Thứ họ thật sự tìm là "đơn nào tôi còn phải
        chuyển khoản" và "vé của tôi đâu".
      */}
      <div className={styles.filters}>
        <div className={styles.segmented} role="group" aria-label="Lọc đơn hàng">
          {STATUS_FILTERS.map((option) => {
            const count = (orders.data ?? []).filter((order) =>
              STATUS_GROUPS[option.value].has(order.status),
            ).length;

            return (
              <button
                key={option.value}
                type="button"
                className={cx(styles.segment, group === option.value && styles.segmentOn)}
                aria-pressed={group === option.value}
                onClick={() => setGroup(option.value)}
              >
                {option.label}
                {/* Số đếm để khách biết nhóm nào rỗng TRƯỚC khi bấm vào một tab trống. */}
                <span className={styles.segmentCount}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Không có đơn nào trong mục này"
          description="Chọn “Tất cả” để xem lại toàn bộ đơn hàng của bạn."
        />
      ) : null}

      {visible.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          session={sessionOf.get(order.id) ?? null}
          onCancel={() => {
            cancel.mutate(order.id, {
              onSuccess: () => toast.show({ tone: 'success', message: 'Đã huỷ đơn' }),
              onError: (error) => toast.showError(error instanceof ApiError ? error : null),
            });
          }}
          cancelling={cancel.isPending && cancel.variables === order.id}
        />
      ))}
    </div>
  );
}

function OrderCard({
  order,
  session,
  onCancel,
  cancelling,
}: {
  order: Order;
  session: SessionInfo | null;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const awaiting = order.status === 'AWAITING_PAYMENT';

  return (
    <section className={styles.group}>
      <header className={styles.groupHead}>
        <div>
          <h2 className={styles.groupTitle}>
            {session ? (
              <Link href={`/events/${session.slug}`}>{session.eventTitle}</Link>
            ) : (
              `Đơn ${order.orderNumber}`
            )}
          </h2>
          <p className={styles.groupMeta}>
            {session ? (
              <>
                {formatDateLong(session.startsAt)} · {formatTime(session.startsAt)}
                {session.venueName ? ` · ${session.venueName}` : ''}
                <span className={styles.orderNumber}>Đơn {order.orderNumber}</span>
              </>
            ) : (
              statusTimestamp(order)
            )}
          </p>
        </div>
        <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
      </header>

      <ul className={styles.orderItems}>
        {summarise(order.items).map((line) => (
          <li key={line.key} className={styles.orderItem}>
            <span>
              {line.ticketTypeName}
              {line.seats ? <span className={styles.orderSeats}> · {line.seats}</span> : null}
            </span>
            <span className={styles.orderQty}>×{line.quantity}</span>
            <MoneyText amountVnd={line.totalVnd} />
          </li>
        ))}
      </ul>

      <div className={styles.orderTotals}>
        {order.discountVnd > 0 ? (
          <p className={styles.orderDiscount}>
            Giảm giá <MoneyText amountVnd={-order.discountVnd} />
          </p>
        ) : null}
        <p className={styles.orderTotal}>
          Tổng cộng <MoneyText amountVnd={order.totalVnd} strong />
        </p>
      </div>

      {awaiting ? <PaymentPanel order={order} onCancel={onCancel} cancelling={cancelling} /> : null}
    </section>
  );
}

/**
 * Khối thanh toán của đơn chưa trả tiền.
 *
 * Người mở lại danh sách đơn thường là người đã bỏ dở giữa đường, nên thứ họ cần trước tiên là một
 * đường đi tiếp — link sang payOS. Mã QR và nội dung chuyển khoản đứng sau, cho người muốn tự làm
 * trong app ngân hàng.
 *
 * Từ ADR-0016, thiếu nội dung chuyển khoản **không** còn làm tiền mồ côi: payOS khớp tiền với đơn
 * bằng mã link trong một webhook đã ký, không bằng chuỗi khách gõ.
 */
function PaymentPanel({
  order,
  onCancel,
  cancelling,
}: {
  order: Order;
  onCancel: () => void;
  cancelling: boolean;
}) {
  return (
    <div className={styles.payment}>
      {order.vietQrPayload ? (
        <QrCode
          value={order.vietQrPayload}
          size={180}
          label={`Mã VietQR để chuyển khoản cho đơn ${order.orderNumber}`}
        />
      ) : null}

      <div className={styles.paymentBody}>
        {/* Thẻ `a` chứ không phải button + router: đây là điều hướng sang site khác, nên khách phải
            mở được bằng chuột giữa và quay lại được bằng nút Back. */}
        {order.checkoutUrl ? (
          <a className={styles.payLink} href={order.checkoutUrl}>
            Thanh toán qua payOS
          </a>
        ) : null}

        {order.paymentReference ? (
          <CopyField label="Nội dung chuyển khoản" value={order.paymentReference} />
        ) : null}

        <p className={styles.paymentNote}>
          Mã QR đã chứa sẵn số tiền và nội dung. Chuyển khoản tay thì giữ nguyên nội dung này để dễ
          tra soát.
        </p>

        <div className={styles.paymentFoot}>
          {order.paymentExpiresAt ? (
            <span className={styles.paymentDeadline}>
              Còn <Countdown deadline={order.paymentExpiresAt} warnBelowMs={120_000} />
            </span>
          ) : null}
          <Button variant="ghost" onClick={onCancel} loading={cancelling}>
            Huỷ đơn
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Mốc thời gian có nghĩa nhất của đơn, tuỳ trạng thái. */
function statusTimestamp(order: Order): string {
  if (order.paidAt) return `Thanh toán ${formatDateTime(order.paidAt)}`;
  if (order.paymentExpiresAt) return `Hạn chuyển khoản ${formatDateTime(order.paymentExpiresAt)}`;
  return `Đơn ${order.orderNumber}`;
}

interface SummaryLine {
  key: string;
  ticketTypeName: string;
  seats: string;
  quantity: number;
  totalVnd: number;
}

/**
 * Gộp các dòng cùng hạng vé.
 *
 * Đơn mười vé đứng cùng khu sinh ra mười dòng giống hệt nhau; liệt kê hết chỉ làm khách phải cuộn.
 * Vé ngồi thì gom số ghế vào một dòng vì số ghế là thứ họ cần đọc.
 */
function summarise(items: OrderItem[]): SummaryLine[] {
  const lines = new Map<string, SummaryLine & { seatList: string[] }>();

  for (const item of items) {
    const key = `${item.ticketTypeName}|${item.zoneCode}`;
    const existing = lines.get(key);
    const price = item.unitPriceVnd - item.discountVnd;

    if (existing) {
      existing.quantity += 1;
      existing.totalVnd += price;
      if (item.seatLabel) existing.seatList.push(item.seatLabel);
      continue;
    }

    lines.set(key, {
      key,
      ticketTypeName: item.ticketTypeName,
      seats: '',
      seatList: item.seatLabel ? [item.seatLabel] : [],
      quantity: 1,
      totalVnd: price,
    });
  }

  return [...lines.values()].map((line) => ({
    key: line.key,
    ticketTypeName: line.ticketTypeName,
    seats: line.seatList.join(', '),
    quantity: line.quantity,
    totalVnd: line.totalVnd,
  }));
}
