import { EventCardSkeleton, Skeleton } from '@nexaticket/ui';
import styles from './events.module.css';

/**
 * Màn chờ của danh sách sự kiện.
 *
 * <h3>Vì sao dùng lại chính `events.module.css`</h3>
 *
 * Skeleton dựng bằng đúng những lớp mà trang thật dùng — `.page`, `.head`, `.grid` — nên lưới chờ
 * và lưới thật có cùng số cột ở cùng các ngưỡng màn hình. Dựng một lưới riêng thì đến ngưỡng
 * 1240px hoặc 900px hai bên sẽ lệch số cột, và khoảnh khắc dữ liệu về là một cú nhảy bố cục.
 *
 * <h3>Vì sao tám thẻ</h3>
 *
 * Hai hàng ở màn hình rộng, và vẫn còn đủ dày ở ba cột. Nhiều hơn thì phần dưới nằm ngoài màn hình
 * — vẽ những ô không ai thấy chỉ tốn công dựng hình đúng lúc trình duyệt đang bận nhất.
 */
export default function EventsLoading() {
  return (
    <main className={styles.page} aria-busy="true">
      <div className={styles.head}>
        <h1 className={styles.title}>
          <Skeleton height={28} width="24ch" />
        </h1>
        <p className={styles.count}>
          <Skeleton height={14} width="12ch" />
        </p>
      </div>

      <div className={styles.layout}>
        <div className={styles.results}>
          <div className={styles.grid}>
            {Array.from({ length: 8 }, (unused, index) => (
              <EventCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
