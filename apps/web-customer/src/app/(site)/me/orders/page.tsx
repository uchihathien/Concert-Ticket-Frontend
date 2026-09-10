import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderList } from '@/components/OrderList';
import { loadSessionIndex } from '@/lib/session-index';
import styles from './wallet-page.module.css';

export const metadata: Metadata = {
  title: 'Đơn hàng của tôi — NexaTicket',
};

/**
 * C-ORDERS.
 *
 * Tách khỏi ví vé vì hai câu hỏi khác nhau: "vé của tôi đâu" hỏi lúc đứng ở cửa, còn "đơn của tôi
 * đã trả tiền chưa" hỏi lúc vừa chuyển khoản xong. Gộp một màn thì cả hai đều bị chôn.
 */
export default async function MyOrdersPage() {
  const sessionIndex = await loadSessionIndex();

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Đơn hàng của tôi</h1>
        <p className={styles.subtitle}>
          Vé đã phát hành nằm ở <Link href="/me/tickets">Vé của tôi</Link>.
        </p>
      </header>

      <OrderList sessionIndex={sessionIndex} />
    </main>
  );
}
