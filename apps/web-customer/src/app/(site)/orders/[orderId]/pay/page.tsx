import { PaymentPanel } from '@/components/PaymentPanel';
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

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Thanh toán</h1>
      <PaymentPanel orderId={orderId} />
    </main>
  );
}
