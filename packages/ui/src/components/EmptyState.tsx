import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './feedback.module.css';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  /** Nút dẫn tới việc tiếp theo. Màn rỗng mà không có lối đi tiếp là ngõ cụt. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx(styles.state, className)}>
      <h3 className={styles.stateTitle}>{title}</h3>
      {description ? <p className={styles.stateBody}>{description}</p> : null}
      {action}
    </div>
  );
}
