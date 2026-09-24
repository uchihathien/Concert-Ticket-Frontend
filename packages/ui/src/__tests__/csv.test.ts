import { describe, expect, it } from 'vitest';
import { csvFilename, toCsv } from '../csv';

const section = (rows: Array<Array<string | number | null | undefined>>) => [
  { title: 'Khối', headers: ['A', 'B'], rows },
];

/** Lấy các dòng dữ liệu, bỏ `sep=,`, tiêu đề khối và hàng đầu cột. */
function dataLines(csv: string): string[] {
  return csv.split('\r\n').slice(3).filter(Boolean);
}

describe('toCsv — bọc ô', () => {
  it('bọc ô có dấu phẩy, nếu không nó tự tách thành hai cột', () => {
    expect(dataLines(toCsv(section([['Đêm nhạc Hạ, phần 2', 1]])))).toEqual([
      '"Đêm nhạc Hạ, phần 2",1',
    ]);
  });

  it('nhân đôi dấu ngoặc kép bên trong', () => {
    expect(dataLines(toCsv(section([['Khu "VIP"', 2]])))).toEqual(['"Khu ""VIP""",2']);
  });

  it('bọc ô có dòng mới', () => {
    expect(dataLines(toCsv(section([['dòng 1\ndòng 2', 3]])))).toEqual(['"dòng 1\ndòng 2",3']);
  });

  it('bọc ô có khoảng trắng ở đầu hoặc cuối — nếu không nó bị ăn mất khi đọc lại', () => {
    expect(dataLines(toCsv(section([[' lề trước', 'lề sau ']])))).toEqual([
      '" lề trước","lề sau "',
    ]);
  });

  it('null và undefined thành ô rỗng, không phải chữ "null"', () => {
    expect(dataLines(toCsv(section([[null, undefined]])))).toEqual([',']);
  });

  it('giữ nguyên ô thường, không bọc thừa', () => {
    expect(dataLines(toCsv(section([['Khán đài A', 1200]])))).toEqual(['Khán đài A,1200']);
  });
});

describe('toCsv — chặn Excel thực thi công thức', () => {
  // Tên sự kiện, tên khu, tên hạng vé đều do ban tổ chức tự đặt, nên chúng đi từ ô nhập của họ vào
  // một file mà người khác mở. Excel coi ô bắt đầu bằng = + - @ là công thức và CHẠY nó.
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '=HYPERLINK("http://x","bấm")'])(
    'thêm nháy đơn vào đầu chuỗi: %s',
    (payload) => {
      const line = dataLines(toCsv(section([[payload, 0]])))[0] ?? '';
      expect(line.startsWith(`"'`) || line.startsWith(`'`)).toBe(true);
    },
  );

  // Chốt chặn CHỈ áp cho chuỗi. `-5` khớp mẫu "bắt đầu bằng dấu trừ", nhưng thêm nháy đơn vào một
  // số âm làm Excel đọc nó thành CHỮ — và một cột tiền có vài ô là chữ thì không cộng được.
  it('số âm vẫn là số, không bị biến thành chuỗi', () => {
    expect(dataLines(toCsv(section([[-5, 0]])))).toEqual(['-5,0']);
  });

  it('số thường không bị đụng tới', () => {
    expect(dataLines(toCsv(section([[1200, 6_000_000]])))).toEqual(['1200,6000000']);
  });
});

describe('toCsv — hình dạng file', () => {
  it('dòng đầu là sep=, để Excel tiếng Việt tách đúng cột', () => {
    expect(toCsv(section([['x', 1]])).split('\r\n')[0]).toBe('sep=,');
  });

  it('dùng CRLF theo RFC 4180', () => {
    expect(toCsv(section([['x', 1]]))).toContain('\r\n');
  });

  it('một dòng trống giữa hai khối', () => {
    const csv = toCsv([
      { title: 'Một', headers: ['A'], rows: [['1']] },
      { title: 'Hai', headers: ['B'], rows: [['2']] },
    ]);
    expect(csv.split('\r\n')).toEqual(['sep=,', 'Một', 'A', '1', '', 'Hai', 'B', '2', '']);
  });

  it('khối không có dòng nào vẫn giữ tiêu đề — "rỗng" là một thông tin', () => {
    const csv = toCsv([{ title: 'Hạng vé', headers: ['Tên'], rows: [] }]);
    expect(csv.split('\r\n')).toEqual(['sep=,', 'Hạng vé', 'Tên', '']);
  });
});

describe('csvFilename', () => {
  const at = new Date('2026-06-14T10:00:00Z');

  it('bỏ dấu và ghép ngày', () => {
    expect(csvFilename(['Nhà hát Lớn', 'Đêm nhạc Hạ'], at)).toBe(
      'nha-hat-lon-dem-nhac-ha-2026-06-14.csv',
    );
  });

  it('gộp mọi ký tự lạ thành một gạch, không để gạch ở hai đầu', () => {
    expect(csvFilename(['  Sự kiện #1 (2026)!  '], at)).toBe('su-kien-1-2026-2026-06-14.csv');
  });

  it('tên rỗng vẫn cho ra một file mở được', () => {
    expect(csvFilename(['***'], at)).toBe('bao-cao-2026-06-14.csv');
  });
});
