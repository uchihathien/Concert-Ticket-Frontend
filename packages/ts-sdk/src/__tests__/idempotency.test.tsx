import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useIdempotencyKey } from '../http/idempotency';

describe('useIdempotencyKey', () => {
  it('giữ nguyên khoá qua nhiều lần render — thử lại phải mang đúng khoá cũ', () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey(['seat-1']));

    const first = result.current.getKey();
    rerender();
    rerender();

    expect(result.current.getKey()).toBe(first);
  });

  it('đổi lựa chọn thì sinh khoá mới — đó là một ý định khác', () => {
    const { result, rerender } = renderHook(({ seats }) => useIdempotencyKey([seats]), {
      initialProps: { seats: 'seat-1' },
    });

    const first = result.current.getKey();
    rerender({ seats: 'seat-1,seat-2' });

    expect(result.current.getKey()).not.toBe(first);
  });

  it('reset sau khi gửi thành công thì lần bấm sau là khoá khác', () => {
    const { result } = renderHook(() => useIdempotencyKey(['seat-1']));

    const first = result.current.getKey();
    act(() => result.current.reset());

    expect(result.current.getKey()).not.toBe(first);
  });
});
