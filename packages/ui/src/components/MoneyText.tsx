import { cx } from '../cx';
import { formatVnd } from '../format';
import styles from './primitives.module.css';

export interface MoneyTextProps {
  /** Số nguyên đồng. Backend không dùng số lẻ (kernel Money.amountVnd). */
  amountVnd: number;
  /** Giá chính của màn — đậm, màu thương hiệu (ui-direction.md §5). */
  strong?: boolean;
  /** Tiền tệ đọc thành chữ cho trình đọc màn hình khỏi đọc "đ" thành ký tự lạ. */
  label?: string;
  className?: string;
}

export function MoneyText({ amountVnd, strong = false, label, className }: MoneyTextProps) {
  const text = formatVnd(amountVnd);
  return (
    <span
      className={cx(styles.money, strong && styles.moneyStrong, className)}
      aria-label={label ?? `${amountVnd.toLocaleString('vi-VN')} đồng`}
    >
      {text}
    </span>
  );
}
