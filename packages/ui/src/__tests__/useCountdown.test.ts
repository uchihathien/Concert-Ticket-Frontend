import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCountdown } from '../hooks/useCountdown';

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('đếm ngược tới mốc tuyệt đối', () => {
    const { result } = renderHook(() => useCountdown('2026-11-01T12:05:00Z'));
    expect(result.current.remainingMs).toBe(300_000);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.remainingMs).toBe(240_000);
    expect(result.current.expired).toBe(false);
  });

  it('tính lại từ giờ hiện tại, nên tab chạy nền không làm đồng hồ đứng', () => {
    const { result } = renderHook(() => useCountdown('2026-11-01T12:05:00Z'));

    // Trình duyệt bóp còn một nhịp trong suốt 3 phút tab ở nền: đồng hồ hệ thống nhảy thẳng,
    // còn interval chỉ chạy đúng một lần.
    act(() => {
      vi.setSystemTime(new Date('2026-11-01T12:02:59Z'));
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.remainingMs).toBe(120_000);
  });

  it('bù lệch đồng hồ máy khách theo giờ server', () => {
    // Máy khách chạy nhanh 3 phút so với server.
    vi.setSystemTime(new Date('2026-11-01T12:03:00Z'));

    const { result } = renderHook(() =>
      useCountdown('2026-11-01T12:05:00Z', { serverNow: '2026-11-01T12:00:00Z' }),
    );

    // Theo đồng hồ máy khách thì chỉ còn 2 phút; theo server vẫn còn đủ 5 phút.
    expect(result.current.remainingMs).toBe(300_000);
  });

  it('gọi onExpire đúng một lần khi hết giờ', () => {
    const onExpire = vi.fn();
    renderHook(() => useCountdown('2026-11-01T12:00:10Z', { onExpire }));

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('không có deadline thì không coi là đã hết hạn', () => {
    const { result } = renderHook(() => useCountdown(null));
    expect(result.current.expired).toBe(false);
  });
});
