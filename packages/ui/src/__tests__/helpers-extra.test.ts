import { afterEach, describe, expect, it, vi } from 'vitest';
import { auditActionFilters, auditActionLabel, auditActionTone } from '../audit';
import { EVENT_CATEGORY_FILTERS, eventCategoryLabel } from '../categories';
import { csvFilename, downloadCsv, toCsv } from '../csv';
import { errorMessage, isKnownErrorCode } from '../errors';
import { formatDateTime, formatNumber, formatTime, formatVnd } from '../format';
import { roleLabel, roleTone } from '../roles';

/** ICU đổi giữa khoảng trắng thường và khoảng trắng hẹp theo phiên bản — so sau khi chuẩn hoá. */
const spaces = (text: string) => text.replace(/\s/g, ' ');

describe('format — phần chưa được phủ', () => {
  it('formatVnd làm tròn về đồng và giữ dấu âm (hoàn tiền)', () => {
    expect(spaces(formatVnd(1_234_567.6))).toBe('1.234.568 ₫');
    expect(spaces(formatVnd(-50_000))).toBe('-50.000 ₫');
  });

  it('formatNumber dùng dấu chấm phân tách hàng nghìn kiểu Việt Nam', () => {
    expect(formatNumber(20_000)).toBe('20.000');
    expect(formatNumber(0)).toBe('0');
  });

  it('formatTime theo giờ Việt Nam, 24 giờ, không AM/PM', () => {
    // 15:30Z = 22:30 giờ Việt Nam.
    expect(formatTime('2026-11-01T15:30:00Z')).toBe('22:30');
    // 17:05Z đã là 00:05 ngày hôm sau ở Việt Nam — không được hiện thành "24:05".
    expect(formatTime('2026-11-01T17:05:00Z')).toBe('00:05');
  });

  it('formatDateTime đổi cả NGÀY khi qua nửa đêm giờ Việt Nam', () => {
    expect(formatDateTime('2026-11-01T17:05:00Z')).toBe('02/11/2026 · 00:05');
  });

  it('nhận cả số mili-giây và đối tượng Date', () => {
    const instant = Date.UTC(2026, 0, 1, 1, 0);
    expect(formatTime(instant)).toBe('08:00');
    expect(formatTime(new Date(instant))).toBe('08:00');
  });
});

describe('csv — tải file', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('downloadCsv gắn BOM UTF-8 ở đầu, đặt tên file và thu hồi URL ngay', async () => {
    const blobs: Blob[] = [];
    const create = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:fake';
    });
    const revoke = vi.fn();
    // jsdom không có createObjectURL — dựng tạm cho đúng bài test này.
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCsv('bao-cao.csv', 'sep=,\r\nNhà hát Lớn');

    expect(click).toHaveBeenCalledOnce();
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe('bao-cao.csv');
    expect(blobs[0]!.type).toBe('text/csv;charset=utf-8');
    // Blob của jsdom chưa có `.arrayBuffer()` — đọc qua FileReader.
    const buffer = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blobs[0]!);
    });
    const bytes = new Uint8Array(buffer);
    // EF BB BF — thiếu ba byte này Excel Windows đọc "Nhà hát" thành "NhÃ  hÃ¡t".
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe('sep=,\r\nNhà hát Lớn');
    expect(revoke).toHaveBeenCalledWith('blob:fake');
  });

  it('csvFilename bỏ dấu tiếng Việt, ký tự cấm của Windows và rơi về "bao-cao" khi rỗng', () => {
    const date = new Date('2026-10-22T03:00:00Z');
    expect(csvFilename(['Đêm nhạc: Hạ/Thu?', 'Doanh thu'], date)).toBe(
      'dem-nhac-ha-thu-doanh-thu-2026-10-22.csv',
    );
    expect(csvFilename(['***'], date)).toBe('bao-cao-2026-10-22.csv');
  });

  /**
   * Bảng ký tự mở đầu nguy hiểm của OWASP (CSV Injection) gồm `=`, `+`, `-`, `@` VÀ cả TAB (0x09),
   * CR (0x0D). csv.ts chỉ chặn bốn ký tự đầu. Một tên sự kiện do ban tổ chức tự đặt như
   * "\t=HYPERLINK(...)" đi qua nguyên vẹn (chỉ được bọc ngoặc kép vì có khoảng trắng ở đầu).
   * Test này giữ ĐỎ cho tới khi csv.ts xử lý — xem báo cáo.
   */
  it.each(['\t=HYPERLINK("http://x","bấm")', '\r=1+1'])(
    'chặn công thức sau ký tự điều khiển ở đầu ô: %j',
    (payload) => {
      const csv = toCsv([{ title: 'K', headers: ['A'], rows: [[payload]] }]);
      const cellText = csv.split('\r\nA\r\n')[1]!;
      // Ô phải được vô hiệu hoá bằng nháy đơn ở đầu, giống bốn ký tự còn lại.
      expect(cellText.startsWith(`"'`) || cellText.startsWith(`'`)).toBe(true);
    },
  );

  it('tiêu đề khối và đầu cột cũng qua chốt chặn công thức', () => {
    const csv = toCsv([{ title: '=cmd', headers: ['@x'], rows: [] }]);
    expect(csv.split('\r\n').slice(1, 3)).toEqual(["'=cmd", "'@x"]);
  });
});

describe('errors — meta dạng chuỗi', () => {
  it('trần mua đến dạng chuỗi số vẫn được chèn vào câu', () => {
    expect(
      errorMessage({ code: 'HOLD_LIMIT_EXCEEDED', meta: { maxPerHold: '8' } }),
    ).toMatch(/tối đa 8 vé/);
  });

  it('chuỗi rỗng hoặc không phải số không thành "(tối đa  vé)" hay "NaN"', () => {
    const base = errorMessage({ code: 'HOLD_LIMIT_EXCEEDED' });
    const message = errorMessage({ code: 'HOLD_LIMIT_EXCEEDED', meta: { limit: '  ' } });
    // Không có số hợp lệ thì trả nguyên câu gốc, không ghép phần ngoặc nào.
    expect(message).toBe(base);
    expect(message).not.toMatch(/\(|NaN|undefined/);
    expect(errorMessage({ code: 'CUSTOMER_LIMIT_EXCEEDED', meta: { remaining: 'abc' } })).not.toMatch(
      /còn được mua/,
    );
  });

  it('isKnownErrorCode từ chối null, rỗng và mã lạ', () => {
    expect(isKnownErrorCode(null)).toBe(false);
    expect(isKnownErrorCode('')).toBe(false);
    expect(isKnownErrorCode('KHONG_TON_TAI')).toBe(false);
    expect(isKnownErrorCode('SEAT_UNAVAILABLE')).toBe(true);
  });
});

describe('nhãn hiển thị', () => {
  it('audit: hành động lạ hiện nguyên mã, màu theo tính chất', () => {
    expect(auditActionLabel('MEMBER_REMOVED')).toBe('Gỡ thành viên');
    expect(auditActionLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
    expect(auditActionTone('SESSIONS_REVOKED')).toBe('danger');
    expect(auditActionTone('MEMBER_GRANTED')).toBe('success');
    expect(auditActionTone('ORGANIZATION_RENAMED')).toBe('neutral');
  });

  it('audit: bộ lọc của tổ chức KHÔNG có hành động cấp tài khoản (USER_*)', () => {
    const org = auditActionFilters('organization').map((f) => f.value);
    const platform = auditActionFilters('platform').map((f) => f.value);
    expect(org[0]).toBe('');
    expect(org.some((v) => v.startsWith('USER_'))).toBe(false);
    expect(platform).toContain('USER_DISABLED');
  });

  it('vai trò và thể loại: mã lạ hiện nguyên, mã quen dịch sang tiếng Việt', () => {
    expect(roleLabel('CHECKIN_STAFF')).toBe('Nhân viên soát vé');
    expect(roleLabel('X')).toBe('X');
    expect(roleTone('ORG_OWNER')).toBe('accent');
    expect(roleTone('SUPER_ADMIN')).toBe('danger');
    expect(roleTone('CUSTOMER')).toBe('neutral');
    expect(eventCategoryLabel('the-thao')).toBe('Thể thao');
    expect(eventCategoryLabel('moi')).toBe('moi');
    expect(EVENT_CATEGORY_FILTERS[0]).toEqual({ value: 'all', label: 'Tất cả' });
  });
});
