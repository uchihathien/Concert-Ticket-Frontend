'use client';

import { useEffect, useRef, useState } from 'react';

export interface CountdownOptions {
  /**
   * Giờ của server tại lúc nhận `deadline` (ví dụ header `Date`, hoặc thời điểm tạo hold).
   *
   * Máy khách đặt sai giờ là chuyện thường. Nếu tính hạn giữ chỗ bằng đồng hồ máy khách thì
   * người lệch giờ 3 phút sẽ thấy "còn 4:00" trong khi server đã nhả ghế.
   */
  serverNow?: string | number | Date;
  onExpire?: () => void;
  intervalMs?: number;
}

export interface CountdownState {
  remainingMs: number;
  expired: boolean;
}

/**
 * Đếm ngược tới một mốc tuyệt đối.
 *
 * Mỗi nhịp tính lại từ `Date.now()` chứ không trừ dần: tab chạy nền bị trình duyệt bóp còn 1
 * nhịp/phút, cách trừ dần sẽ đứng yên và khách quay lại thấy đồng hồ sai hẳn.
 */
export function useCountdown(
  deadline: string | number | Date | null | undefined,
  options: CountdownOptions = {},
): CountdownState {
  const { serverNow, onExpire, intervalMs = 1000 } = options;
  const deadlineMs = deadline == null ? null : new Date(deadline).getTime();

  // Chênh lệch đồng hồ đo đúng một lần, ở lần render đầu có `serverNow`.
  const skewRef = useRef<number | null>(null);
  if (skewRef.current === null && serverNow != null) {
    skewRef.current = Date.now() - new Date(serverNow).getTime();
  }
  const skew = skewRef.current ?? 0;

  const compute = () => {
    if (deadlineMs === null || Number.isNaN(deadlineMs)) return 0;
    return Math.max(0, deadlineMs - (Date.now() - skew));
  };

  const [remainingMs, setRemainingMs] = useState(compute);

  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [deadlineMs]);

  useEffect(() => {
    if (deadlineMs === null || Number.isNaN(deadlineMs)) {
      setRemainingMs(0);
      return;
    }

    const tick = () => {
      const next = Math.max(0, deadlineMs - (Date.now() - skew));
      setRemainingMs(next);
      if (next === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current?.();
      }
    };

    tick();
    const timer = setInterval(tick, intervalMs);

    // Quay lại tab sau khi bị bóp nhịp: đồng bộ ngay, đừng chờ hết một chu kỳ.
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [deadlineMs, intervalMs, skew]);

  const hasDeadline = deadlineMs !== null && !Number.isNaN(deadlineMs);
  return { remainingMs, expired: hasDeadline && remainingMs === 0 };
}
