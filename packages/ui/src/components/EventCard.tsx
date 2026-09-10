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
  /**
   * Nhãn danh mục ("Nhạc sống", "Thể thao"…), góc trên bên trái poster.
   *
   * Tách khỏi `badge` vì hai thứ khác loại: danh mục luôn đúng và luôn có, còn `badge` chỉ xuất
   * hiện khi có tin đáng nói. Gộp chung thì một sự kiện sắp hết vé sẽ mất luôn nhãn danh mục.
   */
  tag?: ReactNode;
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
  tag,
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
          {tag ? <span className={styles.tag}>{tag}</span> : null}
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
