import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from '../cx';
import styles from './primitives.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  /** Đang gửi request. Khoá nút luôn — bấm hai lần là hai hold (plan §8.2). */
  loading?: boolean;
  block?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANT_CLASS: Record<ButtonVariant, string | undefined> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  danger: styles.danger,
  'danger-soft': styles.dangerSoft,
};

/**
 * Nút.
 *
 * `loading` vừa khoá nút vừa đặt `aria-busy`: khoá để không tạo hai hold, `aria-busy` để trình
 * đọc màn hình biết là đang chờ chứ không phải nút hỏng.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  disabled,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cx(
        styles.button,
        styles[size],
        VARIANT_CLASS[variant],
        block && styles.block,
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
