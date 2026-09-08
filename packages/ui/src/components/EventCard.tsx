import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from './Badge';
import { coverGradient } from '../cover';
import { cx } from '../cx';
import { formatVnd } from '../format';
import styles from './catalog.module.css';

export interface EventCardProps {
  href: string;
  title: string;
  /** Suất gần nhất, đã định dạng sẵn ở nơi gọi (server component biết múi giờ). */
  dateLabel: string;
  /** Tỉnh/thành, không phải địa chỉ đầy đủ — thẻ chỉ có một dòng cho chỗ này. */
  venueLabel: string;
  /** Giá thấp nhất còn bán. `null` khi chưa mở bán. */
  fromPriceVnd: number | null;
  imageUrl?: string;
  /**
   * Khoá sinh ảnh bìa tạm khi chưa có `imageUrl`. Thường là `slug` của sự kiện.
   *
   * Truyền cùng một khoá ở mọi nơi hiện sự kiện đó — thẻ ở trang chủ, thẻ ở trang danh sách và
   * băng rôn ở trang chi tiết phải cùng màu, nếu không người dùng không nhận ra mình vừa bấm vào
   * cái gì.
   */
  coverSeed?: string;
  /** "Sắp mở bán" / "Sắp hết vé". Chỉ một nhãn, và chỉ khi thật sự có ý nghĩa. */
  badge?: ReactNode;
  className?: string;
}

/**
 * Thẻ sự kiện — bốn dòng, thứ tự cố định (ui-direction.md §5).
 *
 * Cùng một component cho trang chủ và trang danh sách. Hai thẻ vẽ riêng là hai thẻ sẽ lệch nhau
 * sau vài lần sửa, và người dùng đọc chúng cạnh nhau nên lệch là thấy ngay.
 */
export function EventCard({
  href,
  title,
  dateLabel,
  venueLabel,
  fromPriceVnd,
  imageUrl,
  coverSeed,
  badge,
  className,
}: EventCardProps) {
  return (
    <Link href={href} className={cx(styles.card, className)}>
      <article>
        <div
          className={styles.media}
          style={imageUrl ? undefined : { background: coverGradient(coverSeed ?? title) }}
        >
          {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : null}
          {badge ? (
            <span className={styles.badge}>
              <Badge tone="accent">{badge}</Badge>
            </span>
          ) : null}
        </div>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.meta}>
          {dateLabel} · {venueLabel}
        </p>
        <p className={styles.price}>
          {fromPriceVnd === null ? 'Chưa mở bán' : `Từ ${formatVnd(fromPriceVnd)}`}
        </p>
      </article>
    </Link>
  );
}
