'use client';

import { cx } from '../cx';
import { formatDuration } from '../format';
import { useCountdown } from '../hooks/useCountdown';
import styles from './feedback.module.css';

export interface CountdownProps {
  /** Mốc hết hạn tuyệt đối do server trả về (ví dụ `HoldCreated.expiresAt`). */
  deadline: string | number | Date | null | undefined;
  /** Giờ server lúc nhận `deadline`, để bù lệch đồng hồ máy khách. */
  serverNow?: string | number | Date;
  /** Dưới ngưỡng này thì đổi sang màu cảnh báo. Giữ chỗ: 60s. Thanh toán: 120s. */
  warnBelowMs?: number;
  onExpire?: () => void;
  className?: string;
}

/**
 * Đồng hồ đếm ngược giữ chỗ / thanh toán.
 *
 * `role="timer"` + `aria-live="off"`: đọc lại từng giây thì trình đọc màn hình nói không ngừng.
 * Người dùng tự hỏi khi cần; ứng dụng chỉ thông báo lúc hết giờ.
 */
export function Countdown({
  deadline,
  serverNow,
  warnBelowMs = 60_000,
  onExpire,
  className,
}: CountdownProps) {
  const { remainingMs, expired } = useCountdown(deadline, { serverNow, onExpire });
  const warning = !expired && remainingMs <= warnBelowMs;

  return (
    <span
      role="timer"
      aria-live="off"
      aria-label={expired ? 'Đã hết giờ' : `Còn ${formatDuration(remainingMs)}`}
      data-state={expired ? 'expired' : warning ? 'warn' : 'normal'}
      className={cx(
        styles.countdown,
        warning && styles.countdownWarn,
        expired && styles.countdownExpired,
        className,
      )}
    >
      {formatDuration(remainingMs)}
    </span>
  );
}
