import { cx } from '../cx';
import styles from './catalog.module.css';
import { Skeleton } from './Skeleton';

export interface EventCardSkeletonProps {
  className?: string;
}

/**
 * Khối chờ mang đúng hình dạng của {@link EventCard}.
 *
 * <h3>Vì sao nó nằm ở đây, cạnh chính component nó mô phỏng</h3>
 *
 * Dùng chung `catalog.module.css` với `EventCard` chứ không tự dựng kích thước riêng. Một skeleton
 * đặt ở chỗ khác với kích thước chép tay sẽ **lệch dần**: ai đó đổi `aspect-ratio` của `.media`
 * hoặc khoảng cách giữa các dòng chữ, và từ hôm ấy lưới nhảy một nhịp ngay khi dữ liệu về. Đó
 * chính là kiểu giật layout mà skeleton sinh ra để loại bỏ.
 *
 * <h3>Vì sao ba dòng chữ chứ không phải một khối xám</h3>
 *
 * Thẻ thật có tiêu đề, dòng ngày · địa điểm, và dòng giá. Chừa đúng ba chỗ ấy thì chữ hiện ra tại
 * chỗ nó đã chiếm sẵn. Một khối xám đặc chiếm sai chiều cao còn tệ hơn không có gì, vì nó hứa một
 * bố cục rồi đổi ý.
 */
export function EventCardSkeleton({ className }: EventCardSkeletonProps) {
  return (
    <div className={cx(styles.card, className)}>
      <article>
        <div className={styles.media} />
        <h3 className={styles.title}>
          <Skeleton height={18} width="82%" />
        </h3>
        <p className={styles.meta}>
          <Skeleton height={14} width="64%" />
        </p>
        <p className={styles.price}>
          <Skeleton height={14} width="40%" />
        </p>
      </article>
    </div>
  );
}
