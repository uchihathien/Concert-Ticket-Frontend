import type { CSSProperties } from 'react';
import { cx } from '../cx';
import styles from './primitives.module.css';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string;
  className?: string;
  /** Số dòng giả. Dùng cho khối văn bản thay vì gọi Skeleton nhiều lần ở nơi dùng. */
  lines?: number;
}

/**
 * Khối chờ.
 *
 * `aria-hidden` là cố ý: trình đọc màn hình không cần nghe mô tả hình chữ nhật xám. Vùng chứa
 * dữ liệu mới là nơi đặt `aria-busy`.
 */
export function Skeleton({ width, height = 16, radius, className, lines = 1 }: SkeletonProps) {
  const style: CSSProperties = {
    width: width ?? '100%',
    height,
    borderRadius: radius,
  };

  if (lines <= 1) {
    return <span aria-hidden="true" className={cx(styles.skeleton, className)} style={style} />;
  }

  return (
    <span aria-hidden="true" style={{ display: 'grid', gap: 'var(--nt-space-2)' }}>
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          className={cx(styles.skeleton, className)}
          style={{ ...style, width: index === lines - 1 ? '60%' : style.width }}
        />
      ))}
    </span>
  );
}
