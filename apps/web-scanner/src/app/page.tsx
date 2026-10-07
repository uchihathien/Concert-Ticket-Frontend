import { SessionPicker } from '@/components/SessionPicker';
import { TopBar } from '@/components/TopBar';
import styles from './home.module.css';

/**
 * Màn chọn suất — cùng bố cục và câu chữ với màn chính của app Scanner (apps/mobile-scanner/app/index.tsx).
 * Middleware đã chặn khách chưa đăng nhập ở `/login`, nên màn này luôn ở trạng thái "đã đăng nhập".
 */
export default function SessionPickerPage() {
  return (
    <div className={styles.screen}>
      <TopBar />

      <main className={styles.content}>
        <p className={styles.kicker}>STAFF SCANNER</p>
        <h1 className={styles.title}>
          Bắt đầu ca
          <br />
          soát vé.
        </h1>
        <p className={styles.subtitle}>Chọn suất bạn được giao để mở camera soát vé.</p>

        <div className={styles.form}>
          <SessionPicker />
        </div>
      </main>

      <footer className={styles.footer}>
        <p className={styles.footerLabel}>CHECK-IN PROTOCOL</p>
        <p className={styles.footerText}>
          Mỗi vé chỉ được chấp nhận một lần. Kết quả được xác thực trực tiếp với máy chủ.
        </p>
      </footer>
    </div>
  );
}
