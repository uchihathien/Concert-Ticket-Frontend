import { describe, expect, it } from 'vitest';
import { groupZonesByPrice, zoneFamilyLabel, type ZoneLike } from '../zone-groups';

/**
 * Tên khu trong các ca dưới đây lấy nguyên văn từ dữ liệu thật: sơ đồ nhà thi đấu 91 khu
 * (`Sát sàn 16 · Courtside`, `Loge 9A · VIP`, `Khán đài A · 101`) và dữ liệu mẫu cũ (`Vé ngồi`).
 * Đặt tên bịa vào đây sẽ cho một bộ test xanh mà nhãn trên màn hình vẫn sai.
 */

function zone(name: string, priceVnd: number, available = 10): ZoneLike {
  return { zoneCode: name, name, priceVnd, available };
}

describe('groupZonesByPrice', () => {
  it('gom theo giá và xếp đắt nhất lên đầu', () => {
    const groups = groupZonesByPrice([
      zone('Khán đài B · 301', 450_000),
      zone('Sát sàn 16 · Courtside', 2_500_000),
      zone('Khán đài A · 101', 900_000),
      zone('Khán đài B · 302', 450_000),
    ]);

    expect(groups.map((g) => g.priceVnd)).toEqual([2_500_000, 900_000, 450_000]);
    expect(groups[2]?.zones).toHaveLength(2);
  });

  it('hai khu khác tên nhưng cùng giá vẫn là MỘT hạng vé', () => {
    // Đây là lý do gom theo giá chứ không theo tên: với người mua, sát sàn và loge cùng giá là
    // hai lựa chọn thay thế được cho nhau.
    const groups = groupZonesByPrice([
      zone('Sát sàn 5 · Courtside', 2_500_000),
      zone('Loge 3 · VIP', 2_500_000),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe('Sát sàn, Loge');
  });

  it('cộng số chỗ còn trống của cả nhóm', () => {
    const groups = groupZonesByPrice([
      zone('Khán đài B · 301', 450_000, 120),
      zone('Khán đài B · 302', 450_000, 80),
    ]);

    // Con số này là thứ hiện ngay trên tiêu đề nhóm khi nhóm đang đóng — sai ở đây thì khách mở
    // một hạng vé "còn 200 chỗ" ra và thấy nó đã hết.
    expect(groups[0]?.available).toBe(200);
  });

  it('danh sách rỗng ra danh sách rỗng, không ném', () => {
    expect(groupZonesByPrice([])).toEqual([]);
  });
});

describe('zoneFamilyLabel', () => {
  it('cắt số cuối tên để các khu cùng dãy về chung một họ', () => {
    expect(zoneFamilyLabel([zone('Khán đài A · 101', 0), zone('Khán đài A · 137', 0)])).toBe(
      'Khán đài A',
    );
  });

  it('khu tách đôi 9A/9B vẫn cùng họ với khu số', () => {
    // Chữ cái sau số là lý do biểu thức có `[A-Za-zÀ-ỹ]?`. Thiếu nó thì "Loge 9A" thành một họ
    // riêng tên "Loge 9A", và tiêu đề nhóm dài bằng cả danh sách khu.
    expect(
      zoneFamilyLabel([
        zone('Loge 9A · VIP', 0),
        zone('Loge 9B · VIP', 0),
        zone('Loge 10 · VIP', 0),
      ]),
    ).toBe('Loge');
  });

  it('tên không có số thì giữ nguyên', () => {
    expect(zoneFamilyLabel([zone('Vé ngồi', 0)])).toBe('Vé ngồi');
  });

  it('quá ba họ thì cắt bớt và báo còn nữa', () => {
    const label = zoneFamilyLabel([
      zone('Sát sàn 5', 0),
      zone('Loge 3', 0),
      zone('Khán đài A · 101', 0),
      zone('Khán đài B · 301', 0),
    ]);

    expect(label).toBe('Sát sàn, Loge, Khán đài A…');
  });

  it('tên chỉ có số thì không cắt thành rỗng', () => {
    // Một khu tên đúng bằng "101" bị cắt hết sẽ cho nhãn rỗng, và tiêu đề nhóm biến mất.
    expect(zoneFamilyLabel([zone('101', 0)])).toBe('101');
  });
});
