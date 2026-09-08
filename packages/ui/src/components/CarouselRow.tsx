import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './catalog.module.css';

export interface CarouselRowProps {
  title: string;
  /** "Xem tất cả" dẫn tới trang lọc đầy đủ — bắt buộc theo ui-direction.md §9. */
  seeAllHref?: string;
  seeAllLabel?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Dải sự kiện cuộn ngang.
 *
 * Cuộn bằng bàn phím hoạt động vì mỗi thẻ bên trong là một link nhận focus, và trình duyệt tự
 * cuộn tới phần tử đang focus. Không dựng nút mũi tên tự chế: trên điện thoại không ai bấm, còn
 * trên máy tính chúng thường ăn mất tiêu điểm bàn phím.
 */
export function CarouselRow({
  title,
  seeAllHref,
  seeAllLabel = 'Xem tất cả',
  children,
  className,
}: CarouselRowProps) {
  return (
    <section className={cx(styles.row, className)} aria-label={title}>
      <div className={styles.rowHead}>
        <h2 className={styles.rowTitle}>{title}</h2>
        {seeAllHref ? (
          <Link href={seeAllHref} className={styles.rowLink}>
            {seeAllLabel}
          </Link>
        ) : null}
      </div>
      <div className={styles.track}>{children}</div>
    </section>
  );
}
