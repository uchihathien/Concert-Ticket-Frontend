import Link from 'next/link';
import styles from './notfound.module.css';

/**
 * Nội dung trang 404, dùng chung cho hai chỗ.
 *
 * Trang 404 là trang có người thật đi vào: link sự kiện đã gỡ được chia sẻ lại, kết quả tìm kiếm
 * cũ của Google, hoặc đường dẫn gõ sai. Bản mặc định của Next là chữ tiếng Anh trên nền tối gần
 * như đọc không ra, không có tiêu đề, và không có một đường nào đi tiếp — người dùng chỉ còn cách
 * bấm Back.
 *
 * Ba lối đi ở đây là ba việc người ta thật sự định làm khi tới đây, theo thứ tự khả năng: tìm sự
 * kiện khác, xem vé đã mua, hoặc về trang chủ.
 */
export function NotFoundBody() {
  return (
    <main className={styles.page}>
      <p className={styles.code}>404</p>
      <h1 className={styles.title}>Không tìm thấy trang này</h1>
      <p className={styles.note}>
        Sự kiện có thể đã kết thúc hoặc bị gỡ khỏi trang bán vé. Đường dẫn cũ cũng có thể đã đổi.
      </p>

      <div className={styles.actions}>
        <Link className={styles.primary} href="/events">
          Xem sự kiện đang bán
        </Link>
        <Link className={styles.secondary} href="/me/tickets">
          Vé của tôi
        </Link>
        <Link className={styles.secondary} href="/">
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
