import { Panel } from './AppShell';
import { Skeleton } from './Skeleton';
import styles from './page-skeleton.module.css';

export interface PageSkeletonProps {
  /** Số ô thống kê ở đầu trang. `0` là không có khối đó. */
  stats?: number;
  /** Có thanh bộ lọc phía trên bảng hay không. */
  filters?: boolean;
  /** Số dòng bảng giả. Đặt bằng số dòng thường thấy, không phải số dòng tối đa. */
  rows?: number;
}

/**
 * Khung chờ cho một trang quản trị, dùng trong `loading.tsx` của App Router.
 *
 * <h3>Vì sao cần nó khi `Table` đã tự vẽ skeleton</h3>
 *
 * `Table` chỉ vẽ skeleton khi component đó đã nằm trên màn hình — tức là sau khi JS của trang tải
 * và chạy xong. Còn `loading.tsx` là thứ Next stream ra **ngay** trong lúc server component còn
 * đang chờ dữ liệu. Không có nó, khoảng thời gian đó là một trang trắng: hai app quản trị hiện có
 * 0 file `loading.tsx` trên 14 route.
 *
 * <h3>Vì sao không phải một spinner giữa trang</h3>
 *
 * Spinner nói "đang chờ" nhưng không nói "sẽ ra cái gì", và nó chiếm một chiều cao khác hẳn nội
 * dung thật nên lúc dữ liệu về là cả trang nhảy. Khối chờ theo đúng hình dạng trang thì mắt người
 * đọc đã ở sẵn chỗ mà chữ sắp hiện ra.
 */
export function PageSkeleton({ stats = 0, filters = false, rows = 5 }: PageSkeletonProps) {
  return (
    // `aria-busy` đặt ở vùng chứa, còn từng khối xám thì `aria-hidden` — trình đọc màn hình nghe
    // "đang tải" một lần, không phải nghe mô tả tám hình chữ nhật.
    <div className={styles.wrap} aria-busy="true" aria-label="Đang tải nội dung trang">
      <div className={styles.head}>
        <Skeleton width="min(320px, 60%)" height={30} />
        <Skeleton width="min(560px, 90%)" height={18} />
      </div>

      {stats > 0 ? (
        <div className={styles.stats}>
          {Array.from({ length: stats }, (_, index) => (
            <Panel key={index}>
              <Skeleton width="50%" height={13} />
              <div style={{ marginTop: 8 }}>
                <Skeleton width="35%" height={24} />
              </div>
            </Panel>
          ))}
        </div>
      ) : null}

      {filters ? (
        <Panel>
          <div className={styles.filters}>
            <Skeleton height={44} />
            <Skeleton height={44} />
            <Skeleton height={44} />
          </div>
        </Panel>
      ) : null}

      <div className={styles.table}>
        <div className={styles.tableHead}>
          <Skeleton width="25%" height={13} />
        </div>
        {Array.from({ length: rows }, (_, index) => (
          <div className={styles.tableRow} key={index}>
            <Skeleton width={index % 3 === 0 ? '45%' : '70%'} height={18} />
          </div>
        ))}
      </div>
    </div>
  );
}
