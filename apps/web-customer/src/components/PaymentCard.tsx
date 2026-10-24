'use client';

import { ApiError, useCancelOrder, useOrder, type Order, type PaymentCard as PaymentCardData } from '@nexaticket/ts-sdk';
import {
  Button,
  Countdown,
  CopyField,
  MoneyText,
  QrPanel,
  Skeleton,
  cx,
  formatDateTime,
  useToast,
} from '@nexaticket/ui';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { closedNote, closedTitle } from '@/lib/order-copy';
import { ApiErrorState } from './ApiErrorState';
import styles from './payment-card.module.css';

/** Trong lúc chờ tiền về thì hỏi lại mỗi 5 giây; xong rồi thì thôi — cùng nhịp với PaymentPanel. */
const POLL_MS = 5_000;

export interface PaymentCardProps {
  card: PaymentCardData;
  /** Gọi ĐÚNG MỘT LẦN khi đơn rời trạng thái chờ tiền (PAID, EXPIRED, …). */
  onSettled?: (status: Order['status']) => void;
  /**
   * Nút "Đặt lại" trên đơn đã hết hạn/đã huỷ: gửi một câu đặt vé lại cùng sự kiện vào khung chat. Vắng
   * thì không có nút (thẻ dùng ngoài chat).
   */
  onRebook?: (text: string) => void;
}

/**
 * Thẻ thanh toán trong chat (story 1.7): VietQR + nội dung chuyển khoản + hạn + link payOS, và tự
 * hỏi lại trạng thái đơn để đổi sang "đã nhận tiền" mà khách không phải rời hội thoại.
 *
 * <h3>Thẻ là mồi, đơn là nguồn</h3>
 *
 * `card` là ảnh chụp lúc xác nhận đề xuất — đủ để vẽ ngay mà không chờ mạng. Nhưng trạng thái đơn
 * (đã trả chưa, còn hạn không) chỉ có `useOrder` biết, nên mọi quyết định hiện gì đều theo `order`;
 * `card` chỉ bù chỗ `order` thiếu (ví dụ đơn tạo trước khi có VietQR). Không có tín hiệu nào từ
 * payOS tới trình duyệt — cùng lý do với PaymentPanel — nên hỏi lại theo chu kỳ.
 *
 * <h3>Không QR khi đơn đã đóng</h3>
 *
 * Chuyển khoản vào một đơn đã hết hạn là mất tiền oan và phải hoàn thủ công; thẻ đóng chỉ còn chữ.
 */
export function PaymentCard({ card, onSettled, onRebook }: PaymentCardProps) {
  const { data: order, isPending, error, refetch } = useOrder(card.orderId);
  const cancelOrder = useCancelOrder();
  const toast = useToast();
  const settled = order !== undefined && order.status !== 'AWAITING_PAYMENT';

  useEffect(() => {
    if (settled) return;
    const timer = window.setInterval(() => void refetch(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [settled, refetch]);

  // Báo lên một lần duy nhất: SupportChat dùng tín hiệu này để làm mới hội thoại (backend ghi lượt
  // "đã nhận tiền"), và làm mới hai lần cho một sự kiện là một lời gọi thừa.
  const announced = useRef(false);
  useEffect(() => {
    if (!settled || announced.current) return;
    announced.current = true;
    onSettled?.(order.status);
  }, [settled, order, onSettled]);

  if (error) {
    return (
      <div className={styles.card}>
        <p className={styles.title}>Thanh toán</p>
        <ApiErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (isPending || order === undefined) {
    return (
      <div className={styles.card} aria-busy="true">
        <p className={styles.title}>Thanh toán</p>
        <Skeleton lines={3} />
      </div>
    );
  }

  if (order.status === 'PAID') {
    return (
      <div className={cx(styles.card, styles.cardPaid)} role="status">
        <p className={styles.title}>Thanh toán</p>
        <p className={styles.doneTitle}>Đã thanh toán — vé đã có trong Vé của tôi</p>
        <EventLine card={card} />
        <p className={styles.orderLine}>
          <span className={styles.orderNumber}>{order.orderNumber}</span>
          <MoneyText amountVnd={order.totalVnd} strong />
        </p>
        <Link className={styles.doneLink} href={`/orders/${card.orderId}/tickets`}>
          Xem vé ngay
        </Link>
      </div>
    );
  }

  if (order.status !== 'AWAITING_PAYMENT') {
    return (
      <div className={cx(styles.card, styles.cardClosed)} role="status">
        <p className={styles.title}>Thanh toán</p>
        <p className={styles.closedTitle}>{closedTitle(order.status)}</p>
        <EventLine card={card} />
        <p className={styles.closedNote}>{closedNote(order.status)}</p>
        {onRebook && card.eventTitle && (order.status === 'EXPIRED' || order.status === 'CANCELLED') ? (
          <Button variant="secondary" onClick={() => onRebook(`Đặt lại vé ${card.eventTitle}`)}>
            Đặt lại
          </Button>
        ) : null}
      </div>
    );
  }

  async function onCancelHold() {
    try {
      await cancelOrder.mutateAsync(card.orderId);
      await refetch();
    } catch (cancelError) {
      toast.showError(cancelError instanceof ApiError ? cancelError : null);
    }
  }

  const qrPayload = order.vietQrPayload ?? card.vietQrPayload;
  const reference = order.paymentReference ?? card.paymentReference;
  const checkoutUrl = order.checkoutUrl ?? card.checkoutUrl;
  const deadline = order.paymentExpiresAt ?? card.paymentExpiresAt;

  return (
    <div className={styles.card}>
      <p className={styles.title}>Thanh toán</p>
      <EventLine card={card} />
      <p className={styles.orderLine}>
        <span className={styles.orderNumber}>Đơn {order.orderNumber}</span>
        <MoneyText amountVnd={order.totalVnd} strong />
      </p>

      {deadline ? (
        <p className={styles.deadline}>
          <span>Còn lại</span>
          <Countdown
            deadline={deadline}
            warnBelowMs={120_000}
            onExpire={() => void refetch()}
            className={styles.countdown}
          />
        </p>
      ) : null}

      {checkoutUrl ? (
        // Không `target="_blank"`: payOS đưa khách về `returnUrl` sau khi trả, cùng tab.
        <a className={styles.payLink} href={checkoutUrl}>
          Thanh toán qua payOS
        </a>
      ) : null}

      {qrPayload ? (
        <div className={styles.qr}>
          <QrPanel
            variant="payment"
            title={checkoutUrl ? 'Hoặc quét VietQR' : 'Chuyển khoản VietQR'}
            value={qrPayload}
            size={180}
            label="Mã VietQR của đơn hàng"
            caption="Mở app ngân hàng và quét mã này."
          />
        </div>
      ) : null}

      {reference ? <CopyField value={reference} label="Sao chép nội dung chuyển khoản" /> : null}

      <p className={styles.note}>Thẻ này tự cập nhật khi tiền về — bạn không cần bấm gì thêm.</p>

      {/*
        Huỷ đơn chờ thanh toán là thao tác ordering cho khách tự làm (POST /orders/{id}/cancel): chỗ được
        trả lại ngay thay vì treo tới hết hạn. Đã chuyển khoản rồi thì đừng bấm — tiền về đơn đã huỷ phải
        hoàn thủ công, nên nút để ở cuối, sau phần thanh toán.
      */}
      <Button variant="secondary" loading={cancelOrder.isPending} onClick={() => void onCancelHold()}>
        Huỷ giữ chỗ
      </Button>
    </div>
  );
}

/**
 * Dòng mô tả đơn: sự kiện, suất, địa điểm, hạng vé. Lấy từ thẻ (backend dựng từ đề xuất đã xác nhận
 * và catalog) — đơn của ordering không mang tên sự kiện. Thẻ dựng từ bản cũ thì không có dòng này.
 */
function EventLine({ card }: { card: PaymentCardData }) {
  if (!card.eventTitle) return null;
  const meta = [card.sessionStartsAt ? formatDateTime(card.sessionStartsAt) : null, card.venueName ?? null]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
  return (
    <div className={styles.eventLine}>
      <p className={styles.eventTitle}>{card.eventTitle}</p>
      {meta ? <p className={styles.eventMeta}>{meta}</p> : null}
      {card.lines?.map((line) => (
        <p key={line.zoneName} className={styles.eventMeta}>
          {line.quantity} × {line.zoneName}
        </p>
      ))}
    </div>
  );
}
