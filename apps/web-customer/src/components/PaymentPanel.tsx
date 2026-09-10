'use client';

import { useOrder, type Order } from '@nexaticket/ts-sdk';
import {
  Button,
  Countdown,
  CopyField,
  MoneyText,
  QrCode,
  Skeleton,
  formatDateLong,
  formatTime,
} from '@nexaticket/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { SessionIndex, SessionInfo } from '@/lib/session-index';
import { ApiErrorState } from './ApiErrorState';
import styles from './payment.module.css';

export interface PaymentPanelProps {
  orderId: string;
  /** Bảng tra suất diễn → sự kiện. Trang nạp ở server rồi truyền xuống. */
  sessionIndex: SessionIndex;
}

/** Trong lúc chờ tiền về thì hỏi lại mỗi 5 giây; xong rồi thì thôi. */
const POLL_MS = 5_000;

/**
 * Màn thanh toán.
 *
 * <h3>Hai đường trả tiền, và thứ tự giữa chúng là cố ý</h3>
 *
 * Từ khi chuyển sang payOS (ADR-0016), `checkoutUrl` là **đường chính**: khách bấm một nút, payOS
 * dẫn họ chọn ngân hàng, và họ không phải tự gõ gì cả. Quét QR là **đường phụ** cho người đã quen
 * làm trong app ngân hàng.
 *
 * Thứ tự này đảo so với bản trước, và nó đảo vì một lý do cụ thể: ở luồng cũ, nội dung chuyển khoản
 * là khoá đối soát duy nhất, nên mọi thiết kế đều phải xoay quanh việc làm khách gõ đúng chuỗi đó.
 * Bây giờ payOS khớp tiền với đơn bằng `orderCode` trong một webhook đã ký — **gõ sai nội dung không
 * còn làm tiền mồ côi**. Cái đắt nhất của màn hình cũ đã không còn đắt nữa, nên nó lùi xuống.
 *
 * <h3>Vì sao vẫn phải hỏi lại liên tục</h3>
 *
 * Không có tín hiệu nào đi từ payOS tới trình duyệt này. Tiền về thì payOS gọi webhook của
 * payment-service, service đó xác nhận đơn, và trang này chỉ biết bằng cách hỏi lại. Trước khi có
 * realtime-gateway, hỏi lại mỗi 5 giây là cách rẻ nhất mà vẫn đủ nhanh: người vừa chuyển khoản xong
 * thường nhìn màn hình chờ, và 5 giây là ngưỡng họ chưa kịp nghi ngờ.
 *
 * Hỏi lại cũng là lý do **không tin các tham số payOS gắn vào URL khi quay về** (`status`, `cancel`).
 * Chúng do trình duyệt mang về nên người dùng sửa được; trạng thái đơn từ backend là thứ duy nhất
 * đáng tin.
 *
 * <h3>Vì sao QR dựng ở client</h3>
 *
 * Backend trả chuỗi EMVCo (`vietQrPayload`), không trả ảnh. Nhờ vậy nó không phải phụ thuộc một dịch
 * vụ sinh ảnh QR nào, và chuỗi đó vẫn hiện ra dạng chữ cho người muốn tự nhập tay.
 */
export function PaymentPanel({ orderId, sessionIndex }: PaymentPanelProps) {
  const router = useRouter();
  const { data: order, isPending, isError, error, refetch } = useOrder(orderId);

  const settled = order !== undefined && order.status !== 'AWAITING_PAYMENT';

  useEffect(() => {
    if (settled) return;
    const timer = setInterval(() => void refetch(), POLL_MS);
    return () => clearInterval(timer);
  }, [settled, refetch]);

  const paid = order?.status === 'PAID';

  // Trả tiền xong là chuyển NGAY sang bước nhận vé, không chờ vé về.
  //
  // Vé phát hành bất đồng bộ: ticketing-service nhận sự kiện `order.paid` qua hàng đợi và mất vài
  // giây. Bản trước chờ ở đây cho tới khi vé xuất hiện rồi mới chuyển — nghĩa là mấy giây đó khách
  // ngồi trên trang thanh toán, đúng lúc họ cần một lời khẳng định là tiền đã tới.
  //
  // Giờ trang nhận vé tự chịu khoảng chờ đó và nói rõ "đang phát vé". Đổi lại, khách thấy mình đã
  // sang bước 3 ngay lập tức.
  //
  // `replace` chứ không `push`: bấm Back về trang thanh toán của một đơn đã trả tiền chỉ dẫn tới
  // một mã QR không còn dùng được.
  useEffect(() => {
    if (paid) router.replace(`/orders/${orderId}/tickets`);
  }, [paid, orderId, router]);

  if (isPending) {
    return (
      <div className={styles.loading} aria-busy="true">
        <Skeleton height={28} width="50%" />
        <Skeleton height={240} />
      </div>
    );
  }

  if (isError || !order) {
    return <ApiErrorState error={error} onRetry={() => void refetch()} />;
  }

  if (order.status === 'PAID') {
    // `useEffect` ở trên đang chuyển trang; khung này chỉ hiện trong một nhịp render. Vẫn có link
    // tay vì nếu điều hướng hỏng (JS lỗi, tab bị treo) thì khách không được kẹt lại đây.
    return (
      <div className={styles.done} role="status">
        <p className={styles.doneTitle}>Đã nhận được thanh toán</p>
        <p className={styles.doneNote}>Đang mở vé của bạn…</p>
        <Link className={styles.doneLink} href={`/orders/${orderId}/tickets`}>
          Xem vé ngay
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
          {order.status === 'MANUAL_REVIEW'
            ? // Nói thẳng là tiền đã tới. Câu "chỗ đã mở lại cho người khác" một mình sẽ khiến
              // người vừa chuyển khoản nghĩ tiền của họ biến mất, và họ sẽ chuyển lần thứ hai.
              'Chúng tôi đã nhận được khoản chuyển khoản của bạn, nhưng nó tới sau khi đơn hết hạn và chỗ đã được mở lại. Bộ phận hỗ trợ sẽ liên hệ để hoàn tiền cho bạn.'
            : 'Chỗ đã được mở lại cho người khác. Nếu bạn vẫn muốn mua, hãy chọn chỗ lại từ đầu.'}
        </p>
        {/*
          Câu trên bảo "chọn chỗ lại từ đầu" nên trên màn phải có đường làm việc đó. Bản trước chỉ
          có link sang danh sách đơn — hứa một hành động rồi bắt khách tự đi tìm.

          Không quay thẳng về đúng suất diễn được: `OrderView` không mang `eventSessionId`, nên từ
          một đơn ta không suy ra được suất nào. Đó là khoảng trống phía backend; ở đây dẫn về
          danh sách sự kiện là điểm gần nhất còn đúng.
        */}
        <div className={styles.closedActions}>
          <Link className={styles.doneLink} href="/events">
            Chọn sự kiện khác
          </Link>
          <Link className={styles.closedSecondary} href="/me/orders">
            Đơn hàng của tôi
          </Link>
        </div>
      </div>
    );
  }

  const hasManual = Boolean(order.vietQrPayload ?? order.paymentReference);

  return (
    <div className={styles.layout}>
      <section className={styles.transfer}>
        <header className={styles.head}>
          <div className={styles.headMain}>
            <h2 className={styles.headTitle}>Thanh toán để hoàn tất</h2>
            {/*
              Số tiền lặp lại ở đây CHỈ để phục vụ màn hẹp (CSS ẩn nó ở desktop, chỗ cột tóm tắt
              luôn nhìn thấy được).

              Trên điện thoại, khối tóm tắt từng phải nằm TRÊN khối thanh toán để khách biết mình
              cần chuyển bao nhiêu. Cái giá là nút trả tiền bị đẩy xuống dưới màn hình đầu — người
              vào đây để trả tiền phải cuộn mới thấy chỗ trả. Mang riêng con số lên đây gỡ được thế
              kẹt đó: nút lên trên, mà vẫn không ai phải đoán số tiền.
            */}
            <p className={styles.payAmount}>
              Cần trả <MoneyText amountVnd={order.totalVnd} strong />
            </p>
          </div>
          {order.paymentExpiresAt ? (
            /*
              Đồng hồ là KHỐI RIÊNG, không phải một dòng chữ xám nhạt ở góc phải.

              Đây là thông tin có hạn duy nhất trên màn hình: hết giờ thì ghế được nhả cho người
              khác. Bản trước để nó cùng hàng với tiêu đề, cỡ chữ như chú thích — nó đọc như một
              ghi chú, không như một cái đồng hồ đang chạy.

              Nhãn nằm TRÊN con số, không phải quanh nó: "Còn 14:58 để thanh toán" bắt mắt phải
              nhảy qua con số rồi quay lại, còn hai dòng thì đọc một lượt.
            */
            <p className={styles.deadline}>
              <span className={styles.deadlineLabel}>Còn lại</span>
              <Countdown
                deadline={order.paymentExpiresAt}
                warnBelowMs={120_000}
                onExpire={() => void refetch()}
                className={styles.countdown}
              />
            </p>
          ) : null}
        </header>

        {/*
          KHÔNG có link payOS thì khối quét QR phải mở sẵn và đứng làm đường chính.

          Đây không phải trường hợp lý thuyết: đơn tạo trước ADR-0016 không có `checkoutUrl`, và
          trong lúc rolling deploy thì ordering-service bản cũ cũng không trả trường này. Bản
          trước gặp cảnh đó thì cả thẻ chỉ còn một dòng "Tôi muốn tự quét mã QR" gập lại — một
          trang thanh toán không có chỗ nào để trả tiền, trừ khi khách đoán ra phải bấm vào dòng
          chữ đó.
        */}
        {order.checkoutUrl ? (
          <div className={styles.checkout}>
            {/* Thẻ `a` chứ không phải `button` + router: đây là điều hướng sang một site khác, nên
                khách phải mở được bằng chuột giữa, xem được đích ở thanh trạng thái, và quay lại
                được bằng nút Back. Một onClick giả làm mất cả ba.

                Không `target="_blank"`: trang này là trang đang chờ tiền và nó phải là trang khách
                quay về. payOS đưa họ về đúng đây qua returnUrl, và mở tab mới chỉ để lại một tab
                cũ hiển thị trạng thái đã lỗi thời. */}
            <a className={styles.checkoutLink} href={order.checkoutUrl}>
              Thanh toán qua payOS
            </a>
            <p className={styles.checkoutNote}>
              Chọn ngân hàng và làm theo hướng dẫn. Bạn sẽ được đưa về trang này khi xong.
            </p>
          </div>
        ) : null}

        {order.checkoutUrl ? (
          /*
            QR hiện SẴN, không gập trong <details>.
            
            Bản trước gập nó lại vì payOS là đường chính. Nhưng đo trên màn thật thì cả thẻ chỉ còn
            một nút và một dòng chữ — cao 225px cạnh cột tóm tắt cao 330px, và phần dưới trống
            hoác. Trong khi đó phần lớn người Việt trả tiền bằng cách quét QR trong app ngân hàng,
            tức là đường "phụ" lại là đường họ dùng. Bắt họ bấm một dòng chữ mới thấy mã là thêm
            một bước cho việc phổ biến nhất.
          */
          <details className={styles.manual} open>
            <summary className={styles.manualToggle}>Hoặc quét mã QR trong app ngân hàng</summary>
            <ManualTransfer order={order} />
          </details>
        ) : hasManual ? (
          // Không thêm tiêu đề riêng: tiêu đề mục đã là "Thanh toán để hoàn tất", và khi đây là
          // đường duy nhất thì hai dòng tiêu đề chồng nhau chỉ tốn chỗ.
          <div className={styles.manualPrimary}>
            <ManualTransfer order={order} />
          </div>
        ) : (
          // Không có đường nào để trả tiền. Nói thẳng thay vì hiện một thẻ trống — đơn vẫn còn
          // hạn, nên thứ khách cần là biết phải làm gì tiếp.
          <p className={styles.noPayment} role="alert">
            Chưa tạo được liên kết thanh toán cho đơn này. Bấm “Kiểm tra lại ngay” sau ít giây; nếu
            vẫn vậy, huỷ đơn ở trang Đơn hàng của tôi rồi đặt lại.
          </p>
        )}
      </section>

      <OrderSummary
        order={order}
        session={sessionIndex[order.eventSessionId]}
        onRefetch={() => void refetch()}
      />
    </div>
  );
}

/** Mã QR + nội dung chuyển khoản. Dùng ở cả hai nhánh nên tách ra, không chép hai lần. */
function ManualTransfer({ order }: { order: Order }) {
  return (
    <div className={styles.transferBody}>
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
          {/* Không còn câu cảnh báo "sai một ký tự là mất tiền" của bản trước: với payOS nó
                    không còn đúng. Tiền được khớp với đơn bằng mã link, không bằng chuỗi này. Giữ
                    lại một lời cảnh báo đã hết đúng chỉ làm khách lo về một việc không xảy ra. */}
          <p className={styles.referenceWarn}>
            Mã QR đã chứa sẵn số tiền và nội dung. Chuyển khoản tay thì giữ nguyên nội dung này để
            dễ tra soát.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function OrderSummary({
  order,
  session,
  onRefetch,
}: {
  order: Order;
  session: SessionInfo | undefined;
  onRefetch: () => void;
}) {
  return (
    <aside className={styles.summary}>
      {/*
        KHÁCH ĐANG MUA VÉ GÌ — thứ mà bản trước không hề nói.

        Màn hình này từng mở đầu bằng "Đơn NT-260909-KFNAA4" rồi liệt kê "Khán đài A · ghế 20".
        Một người sắp chuyển 1.800.000đ không có cách nào biết đó là vé của sự kiện nào, ngày nào,
        ở đâu — trong khi đó đúng là thứ họ cần đối chiếu trước khi trả tiền.

        Không hiện được thì cũng không bịa: `session` rỗng khi Catalog không trả lời hoặc khi sự
        kiện đã gỡ bán, và lúc đó mã đơn vẫn là thứ tra soát được.
      */}
      {session ? (
        <header className={styles.event}>
          <h2 className={styles.eventTitle}>{session.eventTitle}</h2>
          <p className={styles.eventMeta}>
            {formatDateLong(session.startsAt)} · {formatTime(session.startsAt)}
          </p>
          {session.venueName ? (
            <p className={styles.eventMeta}>
              {session.venueName}
              {session.city ? ` · ${session.city}` : ''}
            </p>
          ) : null}
        </header>
      ) : null}

      <h3 className={styles.summaryTitle}>Đơn {order.orderNumber}</h3>

      <ul className={styles.items}>
        {order.items.map((item, index) => (
          // Đơn hàng là ảnh chụp bất biến, không sắp xếp lại và không thêm bớt — chỉ số làm khoá
          // là đủ, và vé đứng thì không có seatCode để làm khoá tự nhiên.
          <li key={`${item.zoneCode}-${item.seatCode ?? index}`}>
            {/* `ticketTypeName` trước, vì đó là thứ khách đã chọn và nhận ra ("Hạng A"), còn
                  `zoneCode` là mã nội bộ ("A") — bản trước hiện "A · 17" thì không ai đọc được. */}
            <span>
              {item.ticketTypeName}
              {item.seatLabel ? ` · ghế ${item.seatLabel}` : ' · vé đứng'}
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
        <span>Cần trả</span>
        <MoneyText amountVnd={order.totalVnd} strong />
      </div>

      <p className={styles.note}>
        Trang này tự cập nhật khi payOS báo tiền về — bạn không cần bấm gì thêm. Thường mất vài
        giây.
      </p>

      <Button variant="secondary" block onClick={onRefetch}>
        Kiểm tra lại ngay
      </Button>
    </aside>
  );
}

function closedTitle(status: Order['status']): string {
  if (status === 'EXPIRED') return 'Đơn đã hết hạn thanh toán';
  if (status === 'CANCELLED') return 'Đơn đã bị huỷ';
  if (status === 'MANUAL_REVIEW') return 'Tiền tới sau khi đơn hết hạn';
  return 'Đơn đã được hoàn tiền';
}
