import { describe, expect, it } from 'vitest';
import { ApiError } from '../http/api-error';
import { createQueryClient } from '../query/provider';
import { queryKeys, staleTime } from '../query/keys';

function retryPolicy() {
  const retry = createQueryClient().getDefaultOptions().queries?.retry;
  if (typeof retry !== 'function') throw new Error('retry phải là hàm');
  return retry as (failureCount: number, error: unknown) => boolean;
}

describe('chính sách thử lại', () => {
  it('không thử lại lỗi 4xx — gửi lại y hệt vẫn hỏng', () => {
    const retry = retryPolicy();
    expect(retry(0, new ApiError({ status: 409, code: 'SEAT_UNAVAILABLE' }))).toBe(false);
    expect(retry(0, new ApiError({ status: 404, code: 'SESSION_NOT_FOUND' }))).toBe(false);
  });

  it('không thử lại khi bị rate limit — thử lại là đổ thêm dầu vào lửa', () => {
    expect(retryPolicy()(0, new ApiError({ status: 429, code: 'RATE_LIMITED' }))).toBe(false);
  });

  it('thử lại lỗi mạng và 5xx, tối đa hai lần', () => {
    const retry = retryPolicy();
    const networkFailure = new ApiError({ status: 0, code: 'NETWORK_ERROR' });
    expect(retry(0, networkFailure)).toBe(true);
    expect(retry(1, new ApiError({ status: 503, code: 'INVENTORY_UNAVAILABLE' }))).toBe(true);
    expect(retry(2, networkFailure)).toBe(false);
  });

  it('mutation không bao giờ tự thử lại', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });
});

describe('query key', () => {
  it('sơ đồ chỗ không bao giờ được coi là tươi', () => {
    expect(staleTime.SEAT_MAP).toBe(0);
  });

  it('key của hai suất diễn khác nhau không đụng nhau', () => {
    expect(queryKeys.inventory.seatMap('s1')).not.toEqual(queryKeys.inventory.seatMap('s2'));
  });
});
