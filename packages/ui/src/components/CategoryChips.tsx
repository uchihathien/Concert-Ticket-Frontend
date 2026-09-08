import Link from 'next/link';
import { cx } from '../cx';
import styles from './catalog.module.css';

export interface CategoryChipItem {
  value: string;
  label: string;
}

export interface CategoryChipsProps {
  items: CategoryChipItem[];
  /** Giá trị đang chọn. Lấy từ search params, không giữ trong state. */
  activeValue: string;
  /** Đường dẫn cho từng chip — nơi gọi quyết định giữ lại tham số nào khác trên URL. */
  hrefFor: (value: string) => string;
  label?: string;
  className?: string;
}

/**
 * Chip lọc theo thể loại.
 *
 * Là link chứ không phải nút: bộ lọc sống trên URL nên phải chia sẻ được, mở tab mới được, và
 * bấm Back phải quay về đúng bộ lọc trước đó.
 */
export function CategoryChips({
  items,
  activeValue,
  hrefFor,
  label = 'Thể loại',
  className,
}: CategoryChipsProps) {
  return (
    <nav className={cx(styles.chips, className)} aria-label={label}>
      {items.map((item) => {
        const active = item.value === activeValue;
        return (
          <Link
            key={item.value}
            href={hrefFor(item.value)}
            className={cx(styles.chip, active && styles.chipActive)}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
