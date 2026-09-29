import { Skeleton } from '@nexaticket/ui';
import styles from './detail.module.css';

/**
 * Màn chờ của trang chi tiết sự kiện.
 *
 * <h3>Vì sao hero giữ nguyên chiều cao thay vì để trống</h3>
 *
 * Khối hero là phần tử lớn nhất của trang, và cũng là LCP của nó. Dựng sẵn đúng khung ấy nghĩa là
 * khi ảnh bìa và tiêu đề về, chúng lấp vào một chỗ đã có sẵn — không đẩy phần còn lại xuống.
 * Để trống rồi chèn sau là nguồn giật bố cục lớn nhất mà một trang như thế này có thể tạo ra.
 *
 * Nền hero không phải khối xám mà là dải màu thật của `heroBackdrop`: nó không cần dữ liệu nào,
 * nên hiện ngay được, và khách thấy một trang đang thành hình chứ không phải một bộ khung rỗng.
 */
export default function EventDetailLoading() {
  return (
    <main aria-busy="true">
      <section className={styles.hero}>
        <div className={styles.heroBackdrop} />

        <div className={styles.heroInner}>
          <nav className={styles.crumbs} aria-label="Đường dẫn">
            <Skeleton height={14} width="24ch" />
          </nav>

          <div className={styles.heroGrid}>
            <div className={styles.heroInfo}>
              <div className={styles.heroTags}>
                <Skeleton height={22} width="10ch" radius="999px" />
              </div>
              <h1 className={styles.title}>
                <Skeleton height={38} width="18ch" />
              </h1>
              <p className={styles.summary}>
                <Skeleton height={16} lines={2} />
              </p>
              <dl className={styles.facts}>
                <Skeleton height={16} lines={3} />
              </dl>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
