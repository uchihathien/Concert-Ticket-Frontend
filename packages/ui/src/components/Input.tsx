import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useId } from 'react';
import { cx } from '../cx';
import styles from './primitives.module.css';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  /** Câu lỗi inline. Có giá trị là ô bị đánh dấu `aria-invalid`. */
  error?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/**
 * Ô nhập có nhãn thật.
 *
 * Nhãn luôn là `<label for>` chứ không phải placeholder: placeholder biến mất khi gõ, và trên
 * form nhiều ô thì người dùng không còn biết ô đang gõ là ô gì.
 */
export function Input({ label, hint, error, required, className, ...rest }: InputProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required ? (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <input
        {...rest}
        id={id}
        required={required}
        className={styles.control}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(hint ? hintId : undefined, error ? errorId : undefined) || undefined}
      />
      {hint ? (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className={styles.error} id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
