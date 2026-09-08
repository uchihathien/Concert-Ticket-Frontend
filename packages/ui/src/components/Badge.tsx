import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';
import styles from './primitives.module.css';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

const TONE_CLASS: Record<BadgeTone, string | undefined> = {
  neutral: styles.badgeNeutral,
  accent: styles.badgeAccent,
  success: styles.badgeSuccess,
  warn: styles.badgeWarn,
  danger: styles.badgeDanger,
};

/**
 * Huy hiệu trạng thái.
 *
 * Màu không bao giờ là kênh thông tin duy nhất (ui-direction.md §9) — nội dung chữ phải tự nói
 * đủ nghĩa kể cả khi in đen trắng.
 */
export function Badge({ tone = 'neutral', className, children, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={cx(styles.badge, TONE_CLASS[tone], className)}>
      {children}
    </span>
  );
}
