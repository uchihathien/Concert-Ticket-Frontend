import { describe, expect, it } from 'vitest';
import { safeReturnUrl } from '../return-url';

describe('safeReturnUrl', () => {
  it('giữ đường dẫn tương đối trong chính app', () => {
    expect(safeReturnUrl('/me/tickets')).toBe('/me/tickets');
    expect(safeReturnUrl('/checkout/orders/1?tab=qr')).toBe('/checkout/orders/1?tab=qr');
    expect(safeReturnUrl('/events/abc#suat-2')).toBe('/events/abc#suat-2');
  });

  it('chặn mọi giá trị trỏ ra ngoài origin — đây là open redirect', () => {
    expect(safeReturnUrl('https://site-gia.example/login')).toBe('/');
    expect(safeReturnUrl('//site-gia.example')).toBe('/');
    expect(safeReturnUrl('/\\site-gia.example')).toBe('/');
    expect(safeReturnUrl('javascript:alert(1)')).toBe('/');
  });

  it('chuẩn hoá thay vì trả lại chuỗi gốc', () => {
    // Đường dẫn cùng origin nhưng viết vòng vèo: vẫn cho qua, và trả về dạng đã rút gọn.
    expect(safeReturnUrl('/me/../checkout')).toBe('/checkout');
    expect(safeReturnUrl('me/tickets')).toBe('/me/tickets');
  });

  it('thiếu returnUrl thì về trang mặc định', () => {
    expect(safeReturnUrl(null)).toBe('/');
    expect(safeReturnUrl(undefined, '/dashboard')).toBe('/dashboard');
    expect(safeReturnUrl('')).toBe('/');
  });
});
