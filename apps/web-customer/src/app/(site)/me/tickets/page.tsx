import type { Metadata } from 'next';
import { TicketWallet } from '@/components/TicketWallet';
import { loadSessionIndex } from '@/lib/session-index';
import styles from './wallet-page.module.css';

export const metadata: Metadata = {
  title: 'Vé của tôi — NexaTicket',
};

/**
 * C-WALLET.
 *
 * Middleware đã chặn khách chưa đăng nhập, nên trang không phải tự kiểm lại.
 *
 * Chia đôi trách nhiệm: bảng tra sự kiện là dữ liệu công khai nên dựng ở server một lần và dùng
 * chung cho mọi người; còn vé là dữ liệu riêng, tải từ trình duyệt để mã QR luôn tươi và để
 * không phải chuyển token của người dùng qua thêm một chặng.
 */
export default async function MyTicketsPage() {
  const sessionIndex = await loadSessionIndex();

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Vé của tôi</h1>
        <p className={styles.subtitle}>Mã vào cửa nằm trong từng vé, mở ngay tại đây.</p>
      </header>

      <TicketWallet sessionIndex={sessionIndex} />
    </main>
  );
}
