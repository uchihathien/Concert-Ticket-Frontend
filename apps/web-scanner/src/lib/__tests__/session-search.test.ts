import { describe, expect, it } from 'vitest';
import { foldText, matchesSession, type SearchableSession } from '../session-search';

const SESSION: SearchableSession = {
  eventTitle: 'Đêm Hà Nội',
  venueName: 'Cung Văn hóa Hữu nghị Việt Tiệp',
  organizationName: 'Sóng Live',
  // 13:00 UTC = 20:00 giờ Việt Nam; ngày 15/10/2026.
  startsAt: '2026-10-15T13:00:00Z',
};

describe('foldText', () => {
  it('bỏ dấu tiếng Việt và đưa về chữ thường', () => {
    expect(foldText('Đêm Hà Nội')).toBe('dem ha noi');
  });

  it('đổi riêng đ/Đ vì NFD không tách được hai chữ này', () => {
    expect(foldText('đường Điện Biên')).toBe('duong dien bien');
  });

  it('giữ nguyên chữ số và ký tự không dấu', () => {
    expect(foldText('Show 15/10 ABC')).toBe('show 15/10 abc');
  });
});

describe('matchesSession', () => {
  it('truy vấn rỗng hoặc toàn khoảng trắng khớp mọi suất', () => {
    expect(matchesSession(SESSION, '')).toBe(true);
    expect(matchesSession(SESSION, '   ')).toBe(true);
  });

  it('gõ không dấu vẫn khớp tên sự kiện có dấu', () => {
    expect(matchesSession(SESSION, 'dem ha noi')).toBe(true);
  });

  it('khớp theo địa điểm và tên tổ chức', () => {
    expect(matchesSession(SESSION, 'viet tiep')).toBe(true);
    expect(matchesSession(SESSION, 'song live')).toBe(true);
  });

  it('mọi từ đều phải xuất hiện (AND), bất kể thứ tự và trường', () => {
    expect(matchesSession(SESSION, 'tiep dem')).toBe(true);
    expect(matchesSession(SESSION, 'dem hue')).toBe(false);
  });

  it('khớp theo ngày gõ kiểu 15/10 và 15/10/2026', () => {
    expect(matchesSession(SESSION, '15/10')).toBe(true);
    expect(matchesSession(SESSION, '15/10/2026')).toBe(true);
    expect(matchesSession(SESSION, '16/10')).toBe(false);
  });

  it('suất có ngày hỏng thì chỉ còn khớp theo chữ, không ném lỗi', () => {
    const broken = { ...SESSION, startsAt: 'không phải ngày' };
    expect(matchesSession(broken, 'dem ha noi')).toBe(true);
    expect(matchesSession(broken, '15/10')).toBe(false);
  });
});
