'use client';

import { useOrder, type Order, type PaymentCard as PaymentCardData } from '@nexaticket/ts-sdk';
import { Countdown, CopyField, MoneyText, QrPanel, Skeleton } from '@nexaticket/ui';
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
export function PaymentCard({ card, onSettled }: PaymentCardProps) {
  const { data: order, isPending, error, refetch } = useOrder(card.orderId);
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
      <div className={styles.card} role="status">
        <p className={styles.title}>Thanh toán</p>
        <p className={styles.doneTitle}>Đã nhận được thanh toán</p>
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
      <div className={styles.card} role="status">
        <p className={styles.title}>Thanh toán</p>
        <p className={styles.closedTitle}>{closedTitle(order.status)}</p>
        <p className={styles.closedNote}>{closedNote(order.status)}</p>
      </div>
    );
  }

  const qrPayload = order.vietQrPayload ?? card.vietQrPayload;
  const reference = order.paymentReference ?? card.paymentReference;
  const checkoutUrl = order.checkoutUrl ?? card.checkoutUrl;
  const deadline = order.paymentExpiresAt ?? card.paymentExpiresAt;

  return (
    <div className={styles.card}>
      <p className={styles.title}>Thanh toán</p>
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
    </div>
  );
}
