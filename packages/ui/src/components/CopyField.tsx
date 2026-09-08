'use client';

import { useEffect, useState } from 'react';
import { cx } from '../cx';
import { Button } from './Button';
import styles from './feedback.module.css';

export interface CopyFieldProps {
  label: string;
  value: string;
  className?: string;
}

/**
 * Ô giá trị + nút chép một chạm.
 *
 * Dùng cho nội dung chuyển khoản ở C-PAY: gõ tay sai một ký tự là tiền về mà không khớp đơn, nên
 * chép phải là đường dễ nhất trên màn hình.
 */
export function CopyField({ label, value, className }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Trình duyệt từ chối quyền hoặc chạy trên http: người dùng vẫn bôi đen chép tay được,
      // nên đừng dựng modal lỗi cho một tiện ích.
      setCopied(false);
    }
  };

  return (
    <div className={cx(styles.copyField, className)}>
      <span className={styles.copyValue} aria-label={label}>
        {value}
      </span>
      <Button variant="secondary" onClick={copy} aria-label={`Chép ${label}`}>
        {copied ? 'Đã chép' : 'Chép'}
      </Button>
      <span aria-live="polite" className={styles.copied}>
        {copied ? 'Đã chép' : ''}
      </span>
    </div>
  );
}
