import { describe, expect, it } from 'vitest';
import {
  SESSION_EXPIRED_MESSAGE,
  SIGN_IN_ERROR_FALLBACK,
  signInNotice,
} from '../sign-in-notice';

describe('signInNotice', () => {
  it('không có gì thì không hiện thông báo', () => {
    expect(signInNotice({})).toBeNull();
    expect(signInNotice({ returnUrl: '/me' })).toBeNull();
  });

  it('lỗi quyền truy cập có câu riêng', () => {
    expect(signInNotice({ error: 'AccessDenied' })).toEqual({
      tone: 'error',
      message: expect.stringContaining('không có quyền'),
    });
  });

  it('mã lỗi lạ hoặc lỗi cấu hình rơi về câu mặc định, không lộ mã kỹ thuật', () => {
    expect(signInNotice({ error: 'Configuration' })?.message).toBe(SIGN_IN_ERROR_FALLBACK);
    expect(signInNotice({ error: '<script>' })?.message).toBe(SIGN_IN_ERROR_FALLBACK);
  });

  it('phiên hết hạn là thông tin, không phải lỗi', () => {
    expect(signInNotice({ reason: 'expired' })).toEqual({
      tone: 'info',
      message: SESSION_EXPIRED_MESSAGE,
    });
  });

  it('lỗi thắng khi có cả hai', () => {
    expect(signInNotice({ error: 'AccessDenied', reason: 'expired' })?.tone).toBe('error');
  });

  it('nhận cả mảng giá trị từ query string', () => {
    expect(signInNotice({ reason: ['expired', 'x'] })?.tone).toBe('info');
  });
});
