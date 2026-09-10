import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateLong,
  formatDateTime,
  formatDuration,
  formatVnd,
  isoToVnLocal,
  vnLocalToIso,
} from '../format';

describe('định dạng', () => {
  it('tiền là số nguyên đồng, không phần thập phân', () => {
    // Không so khớp cứng ký tự phân tách của ICU (khoảng trắng hẹp thay đổi theo phiên bản).
    expect(formatVnd(4_400_000).replace(/\s/g, ' ')).toBe('4.400.000 ₫');
    expect(formatVnd(0).replace(/\s/g, ' ')).toBe('0 ₫');
  });

  it('mm:ss dưới một giờ, h:mm:ss từ một giờ trở lên', () => {
    expect(formatDuration(5 * 60_000)).toBe('05:00');
    expect(formatDuration(59_000)).toBe('00:59');
    expect(formatDuration(3_600_000)).toBe('1:00:00');
  });

  it('không đếm ngược xuống số âm', () => {
    expect(formatDuration(-1)).toBe('00:00');
  });

  it('giờ hiện theo Asia/Ho_Chi_Minh bất kể múi giờ máy khách', () => {
    // 12:00Z = 19:00 giờ Việt Nam.
    expect(formatDateTime('2026-11-01T12:00:00Z')).toBe('01/11/2026 · 19:00');
  });

  it('ngày đủ hai chữ số và bốn chữ số năm, để các thẻ cạnh nhau không lệch hàng', () => {
    expect(formatDate('2026-11-01T12:00:00Z')).toBe('01/11/2026');
    // 17:00Z ngày 01 là 00:00 ngày 02 ở Việt Nam — ngày phải theo múi giờ Việt Nam.
    expect(formatDate('2026-11-01T17:00:00Z')).toBe('02/11/2026');
  });

  it('dạng dài có thứ trong tuần, và thứ cũng tính theo giờ Việt Nam', () => {
    // 01/11/2026 là Chủ nhật.
    expect(formatDateLong('2026-11-01T12:00:00Z')).toBe('Chủ Nhật, 01/11/2026');
    // 17:00Z vẫn là ngày 01 theo UTC nhưng đã sang thứ Hai 02/11 ở Việt Nam.
    expect(formatDateLong('2026-11-01T17:00:00Z')).toBe('Thứ Hai, 02/11/2026');
  });

  it('ô datetime-local đọc theo giờ Việt Nam, không theo giờ máy', () => {
    // 19:00 giờ VN = 12:00Z. Máy chạy test có thể ở bất kỳ múi giờ nào, kết quả vẫn phải như nhau.
    expect(vnLocalToIso('2026-11-01T19:00')).toBe('2026-11-01T12:00:00.000Z');
    expect(isoToVnLocal('2026-11-01T12:00:00Z')).toBe('2026-11-01T19:00');
    // Nửa đêm phải là 00:00, không phải 24:00 — ô nhập từ chối "24:00".
    expect(isoToVnLocal('2026-11-01T17:00:00Z')).toBe('2026-11-02T00:00');
  });

  it('ô rỗng hoặc giá trị rác không dựng ra mốc thời gian giả', () => {
    expect(vnLocalToIso('')).toBeUndefined();
    expect(vnLocalToIso(null)).toBeUndefined();
    expect(vnLocalToIso('không phải ngày')).toBeUndefined();
    expect(isoToVnLocal(null)).toBe('');
    expect(isoToVnLocal('không phải ngày')).toBe('');
  });
});
