import type { Metadata } from 'next';
import { BookingSteps } from '@/components/BookingSteps';
import { OrderTickets } from '@/components/OrderTickets';
import { loadSessionIndex } from '@/lib/session-index';
import styles from './tickets-page.module.css';

export const metadata: Metadata = {
  title: 'Nhận vé — NexaTicket',
};

/**
 * C-TICKETS — bước cuối của luồng mua vé: vé của đúng đơn vừa trả tiền.
 *
 * Tồn tại vì thanh ba bước hứa "Nhận vé" là một bước riêng, mà trước đây bước đó không có trang
 * nào: trả tiền xong là đổ thẳng vào ví vé chung. Người vừa mua hai vé rơi vào danh sách ba mươi
 * vé và phải tự tìm hai cái của mình.
 *
 * Vỏ trang là server component nhưng KHÔNG tải vé ở server: vé phát hành bất đồng bộ nên trang
 * phải hỏi lại, và tải ở server chỉ để client tải lại ngay là thêm một vòng khứ hồi vô ích. Bảng
 * tra sự kiện thì ngược lại — dữ liệu công khai, dùng chung cho mọi người, nên dựng ở server.
 *
 * Không nằm trong `publicPaths` của middleware nên phải đăng nhập, và backend trả 404 cho đơn của
 * người khác.
 */
export default async function OrderTicketsPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const sessionIndex = await loadSessionIndex();

  return (
    <main className={styles.page}>
      <BookingSteps current="tickets" />
      {/* Chỉ tiêu đề ở đây. Câu hướng dẫn "đưa mã QR cho nhân viên soát vé" nằm trong nhánh CÓ vé
          của `OrderTickets`: đơn chưa thanh toán thì chưa có mã nào để đưa, và một câu hướng dẫn
          đặt ngay trên dòng "đơn này chưa được thanh toán" là tự nói ngược mình. */}
      <header className={styles.head}>
        <h1 className={styles.title}>Vé của bạn</h1>
      </header>

      <OrderTickets orderId={orderId} sessionIndex={sessionIndex} />
    </main>
  );
}
