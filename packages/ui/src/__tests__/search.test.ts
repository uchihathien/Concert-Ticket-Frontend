import { describe, expect, it } from 'vitest';
import { foldText, matchesText } from '../search';

describe('foldText', () => {
  it('bỏ dấu và hạ chữ thường', () => {
    expect(foldText('Hoà Bình')).toBe('hoa binh');
    expect(foldText('SỰ KIỆN')).toBe('su kien');
  });

  it('đổi đ thành d — NFD không tách được chữ cái này', () => {
    expect(foldText('Đông Đô')).toBe('dong do');
  });
});

describe('matchesText', () => {
  it('khớp khi gõ không dấu', () => {
    expect(matchesText(foldText('hoa binh'), ['Công ty Hoà Bình', 'hoa-binh'])).toBe(true);
  });

  it('chuỗi tìm rỗng thì khớp mọi dòng — không lọc gì cả', () => {
    expect(matchesText('', [null, undefined])).toBe(true);
  });

  it('trường thiếu không khớp mọi từ khoá', () => {
    // Trước đây một dòng thiếu tên đọc thành chuỗi "null" và khớp mọi từ khoá có chữ "n".
    expect(matchesText('n', [null, undefined])).toBe(false);
  });

  it('không khớp thì trả false', () => {
    expect(matchesText(foldText('sai'), ['Hoà Bình', 'hoa-binh'])).toBe(false);
  });
});
