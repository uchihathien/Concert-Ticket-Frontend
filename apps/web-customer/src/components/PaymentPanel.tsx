'use client';

import { ApiError, useOrder, useOrderTickets, type Order } from '@nexaticket/ts-sdk';
import {
  Button,
  Countdown,
  CopyField,
  ErrorState,
  MoneyText,
  QrCode,
  Skeleton,
} from '@nexaticket/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import styles from './payment.module.css';

export interface PaymentPanelProps {
  orderId: string;
}

/** Trong lúc chờ tiền về thì hỏi lại mỗi 5 giây; xong rồi thì thôi. */
const POLL_MS = 5_000;

/**
 * Màn thanh toán chuyển khoản.
 *
 * <h3>Vì sao phải hỏi lại liên tục</h3>
 *
 * Không có tín hiệu nào đi từ ngân hàng tới trình duyệt. Tiền về thì SePay gọi webhook của
 * payment-service, service đó xác nhận đơn, và trang này chỉ biết bằng cách hỏi lại. Trước khi có
 * realtime-gateway, hỏi lại mỗi 5 giây là cách rẻ nhất mà vẫn đủ nhanh: người vừa chuyển khoản
 * xong thường nhìn màn hình chờ, và 5 giây là ngưỡng họ chưa kịp nghi ngờ.
 *
 * <h3>Vì sao QR dựng ở client</h3>
 *
 * Backend trả chuỗi EMVCo (`vietQrPayload`), không trả ảnh. Nhờ vậy nó không phải phụ thuộc một
 * dịch vụ sinh ảnh QR nào, và chuỗi đó vẫn hiện ra dạng chữ cho người muốn tự nhập tay.
 *
 * <h3>Nội dung chuyển khoản là thứ quan trọng nhất trên màn hình này</h3>
 *
 * Webhook khớp tiền về với đơn bằng đúng chuỗi `paymentReference`. Khách gõ thiếu hoặc thêm chữ
 * thì tiền vào tài khoản mà đơn không được xác nhận — trường hợp tệ nhất của cả luồng, vì nó phải
 * xử lý bằng tay. Nên nó được đặt ở khối riêng, có nút sao chép, và có câu cảnh báo.
 */
export function PaymentPanel({ orderId }: PaymentPanelProps) {
  const router = useRouter();
  const { data: order, isPending, isError, error, refetch } = useOrder(orderId);

  const settled = order !== undefined && order.status !== 'AWAITING_PAYMENT';

  useEffect(() => {
    if (settled) return;
    const timer = setInterval(() => void refetch(), POLL_MS);
    return () => clearInterval(timer);
  }, [settled, refetch]);

  const paid = order?.status === 'PAID';

  // Vé KHÔNG có ngay khi đơn chuyển sang PAID.
  //
  // ticketing-service phát vé khi nhận sự kiện `order.paid` qua hàng đợi — bất đồng bộ, và đo thực
  // tế là vài giây sau. Chuyển sang ví vé ngay lúc thấy PAID thì khách vừa trả tiền xong lại nhìn
  // vào một cái ví rỗng: đó là giây phút tệ nhất có thể để làm người ta nghi ngờ.
  //
  // Nên chờ vé xuất hiện thật rồi mới chuyển. Trong lúc đó màn hình nói rõ đang làm gì.
  const tickets = useOrderTickets(paid ? orderId : null);
  const issued = (tickets.data?.length ?? 0) > 0;
  const refetchTickets = tickets.refetch;

  useEffect(() => {
    if (!paid || issued) return;
    const timer = setInterval(() => void refetchTickets(), 2_000);
    return () => clearInterval(timer);
  }, [paid, issued, refetchTickets]);

  useEffect(() => {
    if (issued) router.replace('/me/tickets');
  }, [issued, router]);

  if (isPending) {
    return (
      <div className={styles.loading} aria-busy="true">
        <Skeleton height={28} width="50%" />
        <Skeleton height={240} />
      </div>
    );
  }

  if (isError || !order) {
    const apiError = error instanceof ApiError ? error : null;
    return (
      <ErrorState
        error={apiError}
        correlationId={apiError?.correlationId ?? null}
        onRetry={() => void refetch()}
      />
    );
  }

  if (order.status === 'PAID') {
    return (
      <div className={styles.done} role="status">
        <p className={styles.doneTitle}>Đã nhận được thanh toán</p>
        <p className={styles.doneNote}>
          {issued ? 'Đang mở ví vé của bạn…' : 'Đang phát vé, thường mất vài giây…'}
        </p>
        {/* Vẫn có link tay: nếu việc phát vé chậm bất thường thì khách không bị kẹt ở màn hình
            này mà không làm gì được. */}
        <Link className={styles.doneLink} href="/me/tickets">
          Tới ví vé
        </Link>
      </div>
    );
  }

  if (order.status !== 'AWAITING_PAYMENT') {
    // EXPIRED / CANCELLED / REFUNDED. Không hiện QR nữa: chuyển khoản vào một đơn đã đóng là mất
    // tiền oan và phải hoàn thủ công.
    return (
      <div className={styles.closed} role="status">
        <p className={styles.closedTitle}>{closedTitle(order.status)}</p>
        <p className={styles.closedNote}>
          Chỗ đã được mở lại cho người khác. Nếu bạn vẫn muốn mua, hãy chọn chỗ lại từ đầu.
        </p>
        <Link className={styles.doneLink} href="/me/orders">
          Xem đơn hàng của tôi
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <section className={styles.transfer}>
        <header className={styles.head}>
          <h2 className={styles.headTitle}>Chuyển khoản để hoàn tất</h2>
          {order.paymentExpiresAt ? (
            <Countdown
              deadline={order.paymentExpiresAt}
              warnBelowMs={120_000}
              onExpire={() => void refetch()}
              className={styles.countdown}
            />
          ) : null}
        </header>

        {order.vietQrPayload ? (
          <div className={styles.qr}>
            <QrCode value={order.vietQrPayload} size={220} label="Mã VietQR của đơn hàng" />
            <p className={styles.qrNote}>Mở app ngân hàng và quét mã này.</p>
          </div>
        ) : null}

        {order.paymentReference ? (
          <div className={styles.reference}>
            <p className={styles.referenceLabel}>Nội dung chuyển khoản</p>
            <CopyField value={order.paymentReference} label="Sao chép nội dung chuyển khoản" />
            <p className={styles.referenceWarn}>
              Ghi <strong>đúng</strong> nội dung này. Sai một ký tự thì hệ thống không khớp được
              tiền với đơn của bạn.
            </p>
          </div>
        ) : null}
      </section>

      <aside className={styles.summary}>
        <h2 className={styles.summaryTitle}>Đơn {order.orderNumber}</h2>

        <ul className={styles.items}>
          {order.items.map((item, index) => (
            // Đơn hàng là ảnh chụp bất biến, không sắp xếp lại và không thêm bớt — chỉ số làm khoá
            // là đủ, và vé đứng thì không có seatCode để làm khoá tự nhiên.
            <li key={`${item.zoneCode}-${item.seatCode ?? index}`}>
              <span>
                {item.seatLabel
                  ? `${item.zoneCode} · ${item.seatLabel}`
                  : `${item.zoneCode} · ${item.ticketTypeName}`}
              </span>
              <MoneyText amountVnd={item.unitPriceVnd} />
            </li>
          ))}
        </ul>

        {order.discountVnd > 0 ? (
          <div className={styles.line}>
            <span>Giảm giá</span>
            <MoneyText amountVnd={-order.discountVnd} />
          </div>
        ) : null}

        <div className={styles.total}>
          <span>Cần chuyển</span>
          <MoneyText amountVnd={order.totalVnd} strong />
        </div>

        <p className={styles.note}>
          Trang này tự cập nhật khi ngân hàng báo tiền về — bạn không cần bấm gì thêm. Thường mất
          vài giây.
        </p>

        <Button variant="secondary" block onClick={() => void refetch()}>
          Kiểm tra lại ngay
        </Button>
      </aside>
    </div>
  );
}

function closedTitle(status: Order['status']): string {
  if (status === 'EXPIRED') return 'Đơn đã hết hạn thanh toán';
  if (status === 'CANCELLED') return 'Đơn đã bị huỷ';
  return 'Đơn đã được hoàn tiền';
}
