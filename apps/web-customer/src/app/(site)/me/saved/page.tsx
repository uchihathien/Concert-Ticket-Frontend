import type { Metadata } from 'next';
import { SavedEventsList } from '@/components/SavedEventsList';
import styles from '../tickets/wallet-page.module.css';

export const metadata: Metadata = {
  title: 'Sự kiện đã lưu — NexaTicket',
};

/** Không cần đăng nhập: danh sách nằm trong trình duyệt (xem lib/saved-events.ts). */
export default function SavedEventsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Sự kiện đã lưu</h1>
        <p className={styles.subtitle}>Lưu trên trình duyệt này — chưa đồng bộ với app điện thoại.</p>
      </header>

      <SavedEventsList />
    </main>
  );
}
