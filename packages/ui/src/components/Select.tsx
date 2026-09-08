import type { ReactNode, Ref, SelectHTMLAttributes } from 'react';
import { useId } from 'react';
import { cx } from '../cx';
import styles from './primitives.module.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: ReactNode;
  options: SelectOption[];
  hint?: ReactNode;
  error?: ReactNode;
  /** Dòng rỗng đầu danh sách, ví dụ "Chọn vai trò". */
  placeholder?: string;
  ref?: Ref<HTMLSelectElement>;
}

export function Select({
  label,
  options,
  hint,
  error,
  placeholder,
  required,
  className,
  ...rest
}: SelectProps) {
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
      <select
        {...rest}
        id={id}
        required={required}
        className={styles.control}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(hint ? hintId : undefined, error ? errorId : undefined) || undefined}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
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
