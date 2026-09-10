import { describe, expect, it } from 'vitest';
import { applyQuickFilters, needsLocalFiltering, priceRange, timeRange } from '../quick-filters';

/**
 * Múi giờ là chỗ hỏng âm thầm của bộ lọc này: tiến trình Next chạy UTC, còn "hôm nay" mà người
 * dùng hỏi là hôm nay ở Việt Nam. Các mốc dưới đây cố tình chọn quanh nửa đêm +07:00.
 */

/** 09/09/2026 là thứ Tư. 17:00Z = 00:00 ngày 10/09 giờ Việt Nam. */
const WED_MORNING_VN = new Date('2026-09-09T03:00:00Z'); // 10:00 thứ Tư ở VN
const WED_LATE_UTC = new Date('2026-09-09T16:30:00Z'); // vẫn là 23:30 thứ Tư ở VN

describe('timeRange', () => {
  it('không lọc với giá trị "all" hoặc giá trị lạ', () => {
    expect(timeRange('all', WED_MORNING_VN)).toBeNull();
    expect(timeRange('linh-tinh', WED_MORNING_VN)).toBeNull();
  });

  it('"hôm nay" bám theo ngày ở Việt Nam, không theo ngày UTC', () => {
    const range = timeRange('today', WED_LATE_UTC);
    // 23:30 giờ VN ngày 09/09 vẫn phải là ngày 09/09, dù UTC đã là 16:30 cùng ngày.
    expect(new Date(range!.from).toISOString()).toBe('2026-09-08T17:00:00.000Z');
    expect(range!.to - range!.from).toBe(86_400_000);
  });

  it('"cuối tuần này" là thứ Bảy và Chủ nhật kế tiếp', () => {
    const range = timeRange('weekend', WED_MORNING_VN);
    // Thứ Bảy 12/09 00:00 +07:00 = 11/09 17:00Z, kéo dài hai ngày.
    expect(new Date(range!.from).toISOString()).toBe('2026-09-11T17:00:00.000Z');
    expect(range!.to - range!.from).toBe(2 * 86_400_000);
  });

  it('hỏi vào đúng thứ Bảy thì cuối tuần bắt đầu từ hôm nay, không phải tuần sau', () => {
    const saturday = new Date('2026-09-12T10:00:00Z'); // 17:00 thứ Bảy ở VN
    const range = timeRange('weekend', saturday);
    expect(new Date(range!.from).toISOString()).toBe('2026-09-11T17:00:00.000Z');
    expect(range!.to - range!.from).toBe(2 * 86_400_000);
  });

  it('"tháng này" không lùi về quá khứ', () => {
    const range = timeRange('month', WED_MORNING_VN);
    // Đầu tháng đã trôi qua, nên mốc dưới phải là đầu hôm nay chứ không phải ngày 1.
    expect(new Date(range!.from).toISOString()).toBe('2026-09-08T17:00:00.000Z');
    expect(new Date(range!.to).toISOString()).toBe('2026-09-30T17:00:00.000Z');
  });

  it('tháng 12 nhảy sang năm sau', () => {
    const range = timeRange('month', new Date('2026-12-20T03:00:00Z'));
    expect(new Date(range!.to).toISOString()).toBe('2026-12-31T17:00:00.000Z');
  });
});

describe('priceRange', () => {
  it('các khoảng không chồng lên nhau', () => {
    const under = priceRange('under-500')!;
    const mid = priceRange('500-1000')!;
    const over = priceRange('over-1000')!;

    // Đúng 1.000.000 chỉ được rơi vào một nhóm.
    expect(1_000_000 >= mid.min && 1_000_000 < mid.max).toBe(true);
    expect(1_000_000 >= over.min).toBe(false);
    expect(500_000 >= under.min && 500_000 < under.max).toBe(false);
  });

  it('"miễn phí" chỉ nhận đúng giá 0', () => {
    const free = priceRange('free')!;
    expect(0 >= free.min && 0 < free.max).toBe(true);
    expect(1 < free.max).toBe(false);
  });
});

describe('applyQuickFilters', () => {
  const events = [
    { slug: 'hom-nay', nextSessionAt: '2026-09-09T12:00:00Z', fromPriceVnd: 300_000 },
    { slug: 'cuoi-tuan', nextSessionAt: '2026-09-12T12:00:00Z', fromPriceVnd: 1_500_000 },
    { slug: 'chua-co-suat', nextSessionAt: null, fromPriceVnd: 200_000 },
    { slug: 'chua-mo-ban', nextSessionAt: '2026-09-09T13:00:00Z', fromPriceVnd: null },
  ];

  it('trả nguyên danh sách khi không có bộ lọc nào', () => {
    expect(applyQuickFilters(events, 'all', 'all', WED_MORNING_VN)).toHaveLength(4);
  });

  it('loại sự kiện chưa có suất khi lọc theo thời gian', () => {
    const result = applyQuickFilters(events, 'today', 'all', WED_MORNING_VN);
    expect(result.map((event) => event.slug)).toEqual(['hom-nay', 'chua-mo-ban']);
  });

  it('loại sự kiện chưa mở bán khi lọc theo giá', () => {
    const result = applyQuickFilters(events, 'all', 'under-500', WED_MORNING_VN);
    expect(result.map((event) => event.slug)).toEqual(['hom-nay', 'chua-co-suat']);
  });

  it('hai bộ lọc cùng bật thì phải thoả cả hai', () => {
    const result = applyQuickFilters(events, 'today', 'under-500', WED_MORNING_VN);
    expect(result.map((event) => event.slug)).toEqual(['hom-nay']);
  });
});

describe('needsLocalFiltering', () => {
  it('chỉ bật khi thật sự có bộ lọc backend không làm được', () => {
    expect(needsLocalFiltering('all', 'all')).toBe(false);
    expect(needsLocalFiltering('today', 'all')).toBe(true);
    expect(needsLocalFiltering('all', 'free')).toBe(true);
  });
});
