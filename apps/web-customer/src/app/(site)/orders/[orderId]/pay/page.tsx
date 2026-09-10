import { BookingSteps } from '@/components/BookingSteps';
import { PaymentPanel } from '@/components/PaymentPanel';
import { loadSessionIndex } from '@/lib/session-index';
import styles from './pay-page.module.css';

/**
 * C-PAY — chuyển khoản cho một đơn đang chờ thanh toán.
 *
 * Vỏ trang là server component nhưng KHÔNG tải đơn ở server: đơn đổi trạng thái khi ngân hàng báo
 * tiền về, và cả màn hình này sống bằng việc hỏi lại liên tục. Tải ở server chỉ để rồi client tải
 * lại ngay là thêm một vòng khứ hồi mà không đổi được gì.
 *
 * Không nằm trong `publicPaths` của middleware nên phải đăng nhập — và backend cũng trả 404 cho
 * đơn của người khác, nên không có đường nào xem trộm đơn qua id.
 */
export default async function PayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  // Bảng tra suất diễn nạp ở server: khách đang trả tiền cần thấy MÌNH ĐANG MUA VÉ GÌ, và đơn
  // hàng chỉ mang `eventSessionId` chứ không mang tên sự kiện. Nạp ở đây thay vì trong panel để
  // client không phải chờ thêm một vòng khứ hồi ngay lúc màn hình vừa mở.
  const sessionIndex = await loadSessionIndex();

  return (
    <main className={styles.page}>
      <BookingSteps current="pay" />
      <h1 className={styles.title}>Thanh toán</h1>
      <PaymentPanel orderId={orderId} sessionIndex={sessionIndex} />
    </main>
  );
}
