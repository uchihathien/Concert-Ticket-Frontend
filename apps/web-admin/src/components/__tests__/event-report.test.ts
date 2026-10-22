import { toCsv, toXlsx } from '@nexaticket/ui';
import { afterEach, describe, expect, it } from 'vitest';
import { canTogglePublish, eventStatusLabel, eventStatusTone } from '../../lib/event-status';
import { buildEventReport } from '../event-report';
import { masterData, ORG } from './event-master-fixture';

function section(sections: ReturnType<typeof buildEventReport>, title: string) {
  const found = sections.find((s) => s.title.startsWith(title));
  if (!found) throw new Error(`thiếu khối ${title}`);
  return found;
}

const originalTz = process.env.TZ;
afterEach(() => {
  // Gán `undefined` vào process.env thành chuỗi "undefined" — phải xoá hẳn.
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe('buildEventReport', () => {
  it('tổng hợp tính tỷ lệ lấp đầy và giá trung bình từ đúng số liệu', () => {
    const totals = section(buildEventReport(masterData(), ORG), 'TỔNG HỢP').rows;
    expect(Object.fromEntries(totals.map(([k, v]) => [k, v]))).toMatchObject({
      'Chỗ đã bán': 48,
      'Doanh thu (VND, khách trả)': 57_600_000,
      'Tỷ lệ lấp đầy (%)': 24,
      'Giá vé trung bình (VND)': 1_200_000,
    });
  });

  it('service tồn kho im lặng thì ghi "chưa hỏi được", KHÔNG ghi 0', () => {
    const data = masterData({ degraded: ['inventory-service'] });
    const totals = section(buildEventReport(data, ORG), 'TỔNG HỢP').rows;
    const byKey = Object.fromEntries(totals.map(([k, v]) => [k, v]));
    expect(byKey['Chỗ đã bán']).toBe('chưa hỏi được');
    expect(byKey['Tỷ lệ lấp đầy (%)']).toBe('chưa hỏi được');
    // Doanh thu đến từ analytics, vẫn còn.
    expect(byKey['Doanh thu (VND, khách trả)']).toBe(57_600_000);
    const meta = section(buildEventReport(data, ORG), 'BÁO CÁO SỰ KIỆN').rows;
    expect(meta).toContainEqual(['Số liệu chưa hỏi được', 'inventory-service']);
  });

  it('chưa bán vé nào thì giá trung bình là "chưa hỏi được" chứ không chia cho 0', () => {
    const data = masterData();
    data.totals = { ...data.totals, ticketsSold: 0, grossVnd: 0 };
    const byKey = Object.fromEntries(
      section(buildEventReport(data, ORG), 'TỔNG HỢP').rows.map(([k, v]) => [k, v]),
    );
    expect(byKey['Giá vé trung bình (VND)']).toBe('chưa hỏi được');
  });

  it('gộp khu theo mã, sắp theo mã, khu tổng 0 thì lấp đầy để trống', () => {
    const zones = section(buildEventReport(masterData(), ORG), 'THEO KHU VỰC').rows;
    expect(zones.map((row) => row[0])).toEqual(['A', 'SAN']);
    expect(zones[0]).toEqual(['A', 'có ghế', 150, 2, 48, 0, 200, 24]);
    expect(zones[1]![7]).toBe('');
  });

  it('trần mua null ghi "không đặt" — đó là một quyết định, không phải thiếu dữ liệu', () => {
    const limits = section(buildEventReport(masterData(), ORG), 'TRẦN MUA VÉ').rows[0]!;
    expect(limits.slice(1)).toEqual([8, 4, 'không đặt', 'không đặt', 'ngay khi công bố', 'tới giờ diễn']);
  });

  it('có vướng mắc thì thêm khối "Còn thiếu để công bố"', () => {
    const data = masterData();
    data.event = { ...data.event, blockers: ['NO_SESSIONS'] };
    const blockers = section(buildEventReport(data, ORG), 'CÒN THIẾU');
    expect(blockers.rows).toEqual([['NO_SESSIONS']]);
    expect(buildEventReport(masterData(), ORG).some((s) => s.title.startsWith('CÒN THIẾU'))).toBe(
      false,
    );
  });

  it('tên sự kiện do ban tổ chức đặt bắt đầu bằng "=" vẫn không thành công thức trong file', () => {
    const data = masterData();
    data.event = { ...data.event, title: '=HYPERLINK("http://x","bấm")' };
    const csv = toCsv(buildEventReport(data, ORG));
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""bấm"")"`);
  });

  it('bản .xlsx: mỗi khối báo cáo một sheet, tên sheet hợp lệ, không ô nào là công thức', () => {
    const data = masterData();
    data.event = { ...data.event, title: '=HYPERLINK("http://x","bấm")' };
    const sections = buildEventReport(data, ORG);
    const text = new TextDecoder().decode(toXlsx(sections));

    const names = [...text.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]!);
    expect(names).toHaveLength(sections.length);
    expect(names.every((name) => name.length <= 31 && !/[:\\/?*[\]]/.test(name))).toBe(true);
    // Zip không nén nên XML đọc thẳng được từ byte: không có thẻ <f> nào, tên sự kiện là chuỗi.
    expect(text).not.toContain('<f>');
    expect(text).toContain('=HYPERLINK(&quot;http://x&quot;,&quot;bấm&quot;)');
  });

  /**
   * event-report.ts tự nói giờ trong báo cáo là giờ Việt Nam ("người mở báo cáo đọc giờ diễn theo
   * giờ Việt Nam") và chê `toLocaleString` vì "đổi theo máy" — nhưng `isoLocal` lại dùng
   * `getHours()`, tức CHÍNH múi giờ của máy xuất. Ban tổ chức đang ở nước ngoài (hoặc máy đặt UTC)
   * xuất báo cáo thì suất 20:00 hiện thành 13:00. Test giữ ĐỎ cho tới khi sửa — xem báo cáo.
   */
  it('giờ trong báo cáo là giờ Việt Nam bất kể múi giờ của máy xuất', () => {
    process.env.TZ = 'UTC';
    const perSession = section(buildEventReport(masterData(), ORG), 'THEO SUẤT DIỄN').rows[0]!;
    expect(perSession[0]).toBe('2026-06-14 20:00');
  });
});

describe('event-status', () => {
  it('nhãn và màu theo trạng thái; sự kiện đã huỷ không bật/tắt bán được nữa', () => {
    expect(eventStatusLabel('UNPUBLISHED')).toBe('Đã gỡ bán');
    expect(eventStatusTone('PUBLISHED')).toBe('success');
    expect(eventStatusTone('UNPUBLISHED')).toBe('warn');
    expect(eventStatusTone('CANCELLED')).toBe('danger');
    expect(eventStatusTone('DRAFT')).toBe('neutral');
    expect(canTogglePublish('CANCELLED')).toBe(false);
    expect(canTogglePublish('DRAFT')).toBe(true);
  });
});
