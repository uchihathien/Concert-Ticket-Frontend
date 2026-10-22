import { describe, expect, it } from 'vitest';
import { reportFilename } from '../csv';
import { columnName, crc32, sheetNames, toXlsx, zipStore } from '../xlsx';

const FIXED = new Date(2026, 9, 23, 10, 30, 0);

/** Đọc ngược một zip "store": lấy tên và nội dung từng tệp từ thư mục trung tâm, kiểm CRC luôn. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const files = new Map<string, string>();

  for (let i = 0; i < count; i += 1) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const localOffset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));

    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const start = localOffset + 30 + localNameLength;
    const data = bytes.subarray(start, start + size);
    expect(crc32(data)).toBe(crc);

    files.set(name, decoder.decode(data));
    at += 46 + nameLength;
  }
  return files;
}

const report = [
  {
    title: 'TỔNG HỢP',
    headers: ['Chỉ số', 'Giá trị'],
    rows: [
      ['Doanh thu (VND)', 125000000],
      ['Giá vé trung bình', 412500.5],
      ['Tỷ lệ lấp đầy (%)', 87],
    ],
  },
  {
    title: 'HẠNG VÉ VÀ GIÁ',
    headers: ['Khu', 'Hạng vé', 'Giá (VND)'],
    rows: [['A', '=HYPERLINK("http://x","bấm")', 500000]],
  },
];

describe('crc32 và zip', () => {
  it('CRC-32 khớp giá trị kiểm chuẩn', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('zip đọc ngược ra đúng tên và nội dung, kể cả tên tiếng Việt', () => {
    const encoder = new TextEncoder();
    const zip = zipStore(
      [
        { name: 'a.txt', data: encoder.encode('xin chào') },
        { name: 'thư-mục/b.xml', data: encoder.encode('<x/>') },
      ],
      FIXED,
    );
    const files = unzip(zip);
    expect([...files.keys()]).toEqual(['a.txt', 'thư-mục/b.xml']);
    expect(files.get('a.txt')).toBe('xin chào');
  });

  it('cùng dữ liệu và cùng mốc giờ cho ra cùng từng byte', () => {
    expect(toXlsx(report, FIXED)).toEqual(toXlsx(report, FIXED));
  });
});

describe('columnName', () => {
  it.each([
    [0, 'A'],
    [25, 'Z'],
    [26, 'AA'],
    [701, 'ZZ'],
    [702, 'AAA'],
  ])('%i → %s', (index, name) => {
    expect(columnName(index)).toBe(name);
  });
});

describe('sheetNames — Excel từ chối cả file nếu một tên sheet sai luật', () => {
  it('bỏ ký tự cấm : \\ / ? * [ ]', () => {
    expect(sheetNames(['Doanh thu [Q1]: A/B?*\\'])).toEqual(['Doanh thu Q1 A B']);
  });

  it('cắt còn 31 ký tự', () => {
    const [name] = sheetNames(['KHU VỰC CỦA ĐỊA ĐIỂM (cấu hình) và còn dài nữa']);
    expect(name!.length).toBeLessThanOrEqual(31);
  });

  it('không trùng nhau, kể cả khác hoa thường', () => {
    expect(sheetNames(['Tổng hợp', 'TỔNG HỢP', 'tổng hợp'])).toEqual([
      'Tổng hợp',
      'TỔNG HỢP (2)',
      'tổng hợp (3)',
    ]);
  });

  it('tên trùng đã dài 31 ký tự vẫn giữ được hậu tố trong giới hạn', () => {
    const long = 'A'.repeat(40);
    const names = sheetNames([long, long]);
    expect(names[1]).toBe(`${'A'.repeat(27)} (2)`);
    expect(names.every((name) => name.length <= 31)).toBe(true);
  });

  it('tên rỗng hoặc chỉ có nháy đơn thành "Sheet n"', () => {
    expect(sheetNames(['', "''"])).toEqual(['Sheet 1', 'Sheet 2']);
  });
});

describe('toXlsx', () => {
  const files = unzip(toXlsx(report, FIXED));
  const sheet1 = files.get('xl/worksheets/sheet1.xml') ?? '';
  const sheet2 = files.get('xl/worksheets/sheet2.xml') ?? '';

  it('có đủ các tệp khung mà Excel đòi', () => {
    expect([...files.keys()]).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]);
  });

  it('mỗi khối một sheet, tên theo tiêu đề khối', () => {
    const workbook = files.get('xl/workbook.xml') ?? '';
    expect(workbook).toContain('<sheet name="TỔNG HỢP" sheetId="1" r:id="rId1"/>');
    expect(workbook).toContain('<sheet name="HẠNG VÉ VÀ GIÁ" sheetId="2" r:id="rId2"/>');
  });

  it('số nguyên là số thật, có dấu phân cách hàng nghìn', () => {
    expect(sheet1).toContain('<c r="B3" s="3"><v>125000000</v></c>');
  });

  it('số lẻ là số thật, định dạng mặc định', () => {
    expect(sheet1).toContain('<c r="B4" s="0"><v>412500.5</v></c>');
  });

  // Tên hạng vé do ban tổ chức tự đặt. Trong xlsx, một ô chỉ là công thức khi có thẻ <f>: chuỗi
  // ghi dạng inlineStr không bao giờ bị Excel chạy, nên không cần nháy đơn như CSV — và không được
  // thêm, vì nháy đơn ấy sẽ hiện ra thật trong ô.
  it('chuỗi trông như công thức vẫn là chuỗi, không bao giờ thành công thức', () => {
    expect(sheet2).toContain(
      '<c r="B3" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK(&quot;http://x&quot;,&quot;bấm&quot;)</t></is></c>',
    );
    expect(sheet2).not.toContain('<f>');
    expect(sheet2).not.toContain("'=HYPERLINK");
  });

  it('hàng 1 là tiêu đề khối, hàng 2 là đầu cột in đậm, cố định hai hàng đầu, có bộ lọc', () => {
    expect(sheet1).toContain(
      '<c r="A1" s="2" t="inlineStr"><is><t xml:space="preserve">TỔNG HỢP</t>',
    );
    expect(sheet1).toContain(
      '<c r="A2" s="1" t="inlineStr"><is><t xml:space="preserve">Chỉ số</t>',
    );
    expect(sheet1).toContain('state="frozen"');
    expect(sheet1).toContain('<autoFilter ref="A2:B5"/>');
    expect(files.get('xl/workbook.xml')).toContain(
      `<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'TỔNG HỢP'!$A$2:$B$5</definedName>`,
    );
  });

  it('thoát ký tự XML và bỏ ký tự điều khiển — một U+0008 dán từ Zalo đủ làm Excel báo hỏng', () => {
    const xml = unzip(
      toXlsx([{ title: 'K', headers: ['A'], rows: [['Hạ & Thu <live>\u0008']] }], FIXED),
    ).get('xl/worksheets/sheet1.xml');
    expect(xml).toContain('Hạ &amp; Thu &lt;live&gt;</t>');
    expect(xml).not.toContain('\u0008');
  });

  it('null, undefined, NaN, Infinity thành ô rỗng — <v>NaN</v> làm Excel báo hỏng', () => {
    const xml =
      unzip(
        toXlsx(
          [{ title: 'K', headers: ['A', 'B', 'C', 'D'], rows: [[null, undefined, NaN, Infinity]] }],
          FIXED,
        ),
      ).get('xl/worksheets/sheet1.xml') ?? '';
    expect(xml).toContain('<row r="3"></row>');
    expect(xml).not.toContain('NaN');
    expect(xml).not.toContain('Infinity');
  });

  it('khối không có dữ liệu: không gắn bộ lọc', () => {
    const xml = unzip(toXlsx([{ title: 'K', headers: ['A'], rows: [] }], FIXED)).get(
      'xl/worksheets/sheet1.xml',
    );
    expect(xml).not.toContain('autoFilter');
  });

  it('không có khối nào vẫn ra một workbook có một sheet — workbook không sheet là file hỏng', () => {
    const empty = unzip(toXlsx([], FIXED));
    expect(empty.has('xl/worksheets/sheet1.xml')).toBe(true);
    expect(empty.get('xl/workbook.xml')).toContain('<sheet name="Báo cáo"');
  });
});

describe('reportFilename', () => {
  it('cùng tên với CSV, chỉ khác đuôi', () => {
    const date = new Date('2026-10-23T03:00:00Z');
    expect(reportFilename(['Ban tổ chức Hạ', 'Đêm nhạc: Hạ/Thu'], 'xlsx', date)).toBe(
      'ban-to-chuc-ha-dem-nhac-ha-thu-2026-10-23.xlsx',
    );
  });
});
