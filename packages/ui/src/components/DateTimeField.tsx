'use client';

import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import { cx } from '../cx';
import styles from './primitives.module.css';

export interface DateTimeFieldProps {
  label: ReactNode;
  /** Tên field trong FormData — form không kiểm soát (uncontrolled) đọc giá trị qua input ẩn này. */
  name?: string;
  /** `2026-09-12T19:00` (giờ Việt Nam, dạng `isoToVnLocal`). */
  defaultValue?: string;
  /** Dùng khi form kiểm soát giá trị bằng state. */
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, step) => String(step * 5).padStart(2, '0'));

/**
 * Ô chọn ngày + giờ, thay cho `<input type="datetime-local">`.
 *
 * <h3>Vì sao không dùng datetime-local</h3>
 *
 * Bảng chọn của nó khác nhau giữa các trình duyệt: Safari và Chrome (giao diện tối) chỉ bật lịch
 * chọn NGÀY; phần giờ phải bấm vào từng ô "--:--" rồi gõ số, và người dùng tưởng là không chọn được
 * giờ. Ở đây tách hẳn: lịch cho ngày, hai danh sách cho giờ và phút (bước 5 phút) — chọn được bằng
 * chuột trên mọi trình duyệt.
 *
 * Giá trị vẫn đúng dạng của datetime-local (`YYYY-MM-DDTHH:mm`, giờ Việt Nam), nên `vnLocalToIso`
 * đọc được như trước. Phút lẻ (dữ liệu cũ, vd 17:48) vẫn giữ nguyên trong danh sách.
 */
export function DateTimeField({
  label,
  name,
  defaultValue,
  value,
  onChange,
  required,
  disabled,
  hint,
  className,
}: DateTimeFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [inner, setInner] = useState(defaultValue ?? '');
  const current = value ?? inner;
  const [date = '', time = ''] = current.split('T');
  const [hour = '', minute = ''] = time.slice(0, 5).split(':');

  const update = (nextDate: string, nextHour: string, nextMinute: string) => {
    // Chọn ngày mà chưa chọn giờ thì lấy 00:00 — một ô bỏ dở không được thành giá trị rỗng âm thầm.
    const combined = nextDate ? `${nextDate}T${nextHour || '00'}:${nextMinute || '00'}` : '';
    if (value === undefined) setInner(combined);
    onChange?.(combined);
  };

  const minutes = minute && !MINUTES.includes(minute) ? [...MINUTES, minute].sort() : MINUTES;

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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          id={id}
          type="date"
          className={styles.control}
          style={{ flex: '1 1 150px', minWidth: 0 }}
          value={date}
          required={required}
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          onChange={(change) => update(change.target.value, hour, minute)}
        />
        <select
          aria-label="Giờ"
          className={styles.control}
          style={{ flex: '0 0 84px' }}
          value={hour}
          disabled={disabled || !date}
          onChange={(change) => update(date, change.target.value, minute)}
        >
          {!hour ? <option value="">Giờ</option> : null}
          {HOURS.map((option) => (
            <option key={option} value={option}>
              {option} giờ
            </option>
          ))}
        </select>
        <select
          aria-label="Phút"
          className={styles.control}
          style={{ flex: '0 0 84px' }}
          value={minute}
          disabled={disabled || !date}
          onChange={(change) => update(date, hour, change.target.value)}
        >
          {!minute ? <option value="">Phút</option> : null}
          {minutes.map((option) => (
            <option key={option} value={option}>
              {option} phút
            </option>
          ))}
        </select>
      </div>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      {hint ? (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
