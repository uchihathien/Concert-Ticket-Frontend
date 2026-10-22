/**
 * Xuất báo cáo nhiều khối thành file Excel (.xlsx), mỗi khối một sheet.
 *
 * <h3>Vì sao tự viết thay vì dùng thư viện</h3>
 *
 * File .xlsx chỉ là một file zip chứa vài tệp XML. Thứ báo cáo này cần — chữ, số, hàng đầu cột in
 * đậm, cố định hàng đầu, bộ lọc — gói gọn trong vài trăm dòng. `exceljs` nặng cỡ 1 MB vào bundle
 * của trang quản trị; `xlsx` (SheetJS) trên npm dừng ở bản 0.18.5 còn lỗ hổng đã công bố. Một bộ
 * ghi nhỏ, không phụ thuộc gì, đọc hết được trong một lần — và có test giữ đúng định dạng.
 *
 * <h3>Khác CSV ở chỗ nào</h3>
 *
 * - Không cần BOM, không cần `sep=,`: xlsx luôn là UTF-8, cột luôn là cột.
 * - Không cần nháy đơn chặn công thức: chuỗi được ghi là <i>chuỗi</i> (`inlineStr`), Excel không bao
 *   giờ đánh giá nó. Một ô chỉ là công thức khi có thẻ `<f>`, và hàm này không bao giờ ghi thẻ ấy.
 * - Số là số thật, có dấu phân cách hàng nghìn, cộng và sắp xếp được.
 */
import type { CsvSection } from './csv';

/** Một khối báo cáo. Cùng hình dạng với khối CSV để một hàm dựng báo cáo dùng được cho cả hai. */
export type ReportSection = CsvSection;

type CellValue = string | number | null | undefined;

/** Giới hạn của Excel: tên sheet tối đa 31 ký tự, một ô tối đa 32.767 ký tự. */
const SHEET_NAME_MAX = 31;
const CELL_TEXT_MAX = 32767;

/** Chỉ số kiểu ô trong `styles.xml` (thứ tự trong `cellXfs`). */
const STYLE = { default: 0, header: 1, title: 2, integer: 3 } as const;

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Dựng file .xlsx từ các khối báo cáo.
 *
 * Mỗi khối thành một sheet: hàng 1 là tiêu đề khối, hàng 2 là hàng đầu cột, dữ liệu từ hàng 3.
 * `date` chỉ dùng cho mốc giờ của các mục trong file zip — truyền vào để test cho ra cùng một byte.
 */
export function toXlsx(input: ReportSection[], date = new Date()): Uint8Array {
  // Một workbook không có sheet nào thì Excel báo hỏng, không phải "file rỗng".
  const sections = input.length > 0 ? input : [{ title: 'Báo cáo', headers: [], rows: [] }];
  const names = sheetNames(sections.map((section) => section.title));

  const files: Array<[string, string]> = [
    ['[Content_Types].xml', contentTypes(sections.length)],
    ['_rels/.rels', ROOT_RELS],
    ['xl/workbook.xml', workbook(sections, names)],
    ['xl/_rels/workbook.xml.rels', workbookRels(sections.length)],
    ['xl/styles.xml', STYLES],
    ...sections.map((section, index): [string, string] => [
      `xl/worksheets/sheet${index + 1}.xml`,
      worksheet(section),
    ]),
  ];

  const encoder = new TextEncoder();
  return zipStore(
    files.map(([name, xml]) => ({ name, data: encoder.encode(xml) })),
    date,
  );
}

/** Tải file .xlsx xuống. */
export function downloadXlsx(filename: string, content: Uint8Array): void {
  if (typeof window === 'undefined') {
    return;
  }
  const blob = new Blob([content as Uint8Array<ArrayBuffer>], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------------------------

/**
 * Tên sheet hợp lệ và không trùng nhau.
 *
 * Excel từ chối mở cả file — không chỉ bỏ qua sheet ấy — nếu một tên dài quá 31 ký tự, chứa một
 * trong `: \ / ? * [ ]`, bắt đầu hoặc kết thúc bằng nháy đơn, hoặc trùng tên sheet khác (không phân
 * biệt hoa thường). Tiêu đề khối do code đặt, nhưng một khối mới về sau có thể vi phạm mà không ai
 * nhận ra cho tới khi kế toán báo "file hỏng".
 */
export function sheetNames(titles: string[]): string[] {
  const used = new Set<string>();

  return titles.map((title, index) => {
    const base =
      title
        .replace(/[:\\/?*[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^'+|'+$/g, '')
        .slice(0, SHEET_NAME_MAX)
        .trim() || `Sheet ${index + 1}`;

    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n += 1) {
      const suffix = ` (${n})`;
      name = base.slice(0, SHEET_NAME_MAX - suffix.length).trim() + suffix;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

function worksheet(section: ReportSection): string {
  const width = Math.max(section.headers.length, ...section.rows.map((row) => row.length), 1);
  const rows: string[] = [];

  rows.push(row(1, [cell(1, 0, section.title, STYLE.title)]));
  rows.push(
    row(
      2,
      section.headers.map((header, col) => cell(2, col, header, STYLE.header)),
    ),
  );
  section.rows.forEach((values, index) => {
    const r = index + 3;
    rows.push(
      row(
        r,
        values.map((value, col) => cell(r, col, value)),
      ),
    );
  });

  const lastRow = section.rows.length + 2;
  const lastCol = columnName(width - 1);
  // Bộ lọc chỉ khi có dữ liệu: bộ lọc trên mỗi hàng đầu cột thì Excel vẫn mở được nhưng trông như hỏng.
  const filter = section.rows.length > 0 ? `<autoFilter ref="A2:${lastCol}${lastRow}"/>` : '';

  return (
    XML_HEAD +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="A1:${lastCol}${lastRow}"/>` +
    // Cố định hai hàng đầu: cuộn xuống vẫn thấy tên cột.
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView></sheetViews>' +
    `<cols>${columnWidths(section, width)}</cols>` +
    `<sheetData>${rows.join('')}</sheetData>` +
    filter +
    '</worksheet>'
  );
}

/**
 * Độ rộng cột theo ô dài nhất của cột, trừ hàng tiêu đề khối (nó dài và nằm một mình ở cột A).
 * Excel không tự giãn cột khi mở file — không đặt thì mọi cột rộng 8,43 ký tự và chữ bị cắt.
 */
function columnWidths(section: ReportSection, width: number): string {
  const cols: string[] = [];
  for (let col = 0; col < width; col += 1) {
    const longest = Math.max(
      displayLength(section.headers[col]),
      ...section.rows.map((values) => displayLength(values[col])),
    );
    const chars = Math.min(Math.max(longest + 2, 8), 60);
    cols.push(`<col min="${col + 1}" max="${col + 1}" width="${chars}" customWidth="1"/>`);
  }
  return cols.join('');
}

function displayLength(value: CellValue): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number')
    return Number.isInteger(value) ? value.toLocaleString('en-US').length : String(value).length;
  return Math.max(...value.split('\n').map((line) => line.length));
}

function row(r: number, cells: string[]): string {
  return `<row r="${r}">${cells.join('')}</row>`;
}

/**
 * Một ô. Số hữu hạn ghi là số; mọi thứ khác ghi là chuỗi.
 *
 * `NaN` và `Infinity` không có cách viết trong xlsx — ghi `<v>NaN</v>` làm Excel báo file hỏng. Chúng
 * thành ô rỗng, giống `null`, vì cả hai đều nghĩa là "không có số để ghi".
 */
function cell(r: number, col: number, value: CellValue, style?: number): string {
  const ref = `${columnName(col)}${r}`;

  if (
    value === null ||
    value === undefined ||
    (typeof value === 'number' && !Number.isFinite(value))
  ) {
    return style === undefined ? '' : `<c r="${ref}" s="${style}"/>`;
  }

  if (typeof value === 'number') {
    const s = style ?? (Number.isInteger(value) ? STYLE.integer : STYLE.default);
    return `<c r="${ref}" s="${s}"><v>${value}</v></c>`;
  }

  const text = escapeXml(value.slice(0, CELL_TEXT_MAX));
  const s = style === undefined ? '' : ` s="${style}"`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

/**
 * Thoát ký tự XML, và BỎ các ký tự điều khiển XML 1.0 không cho phép.
 *
 * Một ký tự như U+0008 lọt vào tên sự kiện (dán từ Word, từ Zalo) là đủ làm Excel báo "file bị
 * hỏng, có muốn khôi phục không" — và khôi phục thì nó xoá cả sheet. Tab, xuống dòng giữ lại.
 */
function escapeXml(value: string): string {
  return (
    value
      // eslint-disable-next-line no-control-regex -- bắt đúng ký tự điều khiển là mục đích của dòng này
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  );
}

// ---------------------------------------------------------------------------------------------
// Các tệp khung của gói xlsx
// ---------------------------------------------------------------------------------------------

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const ROOT_RELS =
  XML_HEAD +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

/**
 * Kiểu ô: 0 mặc định · 1 hàng đầu cột (đậm, nền xanh nhạt) · 2 tiêu đề khối (đậm, cỡ 13) ·
 * 3 số nguyên có dấu phân cách hàng nghìn (định dạng dựng sẵn số 3, `#,##0`).
 * `fills` bắt buộc có `none` và `gray125` ở vị trí 0 và 1 — thiếu là Excel báo hỏng.
 */
const STYLES =
  XML_HEAD +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="3">' +
  '<font><sz val="11"/><name val="Arial"/></font>' +
  '<font><b/><sz val="11"/><name val="Arial"/></font>' +
  '<font><b/><sz val="13"/><name val="Arial"/></font>' +
  '</fonts>' +
  '<fills count="3">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/><bgColor indexed="64"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

function contentTypes(sheetCount: number): string {
  const sheets = Array.from(
    { length: sheetCount },
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');
  return (
    XML_HEAD +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets +
    '</Types>'
  );
}

function workbook(sections: ReportSection[], names: string[]): string {
  const sheets = names
    .map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('');

  // Excel cần tên ẩn `_xlnm._FilterDatabase` cho mỗi bộ lọc — thiếu thì bộ lọc mất khi lưu lại.
  const filters = sections
    .map((section, i) => {
      if (section.rows.length === 0) return '';
      const width = Math.max(section.headers.length, ...section.rows.map((r) => r.length), 1);
      const quoted = `'${names[i]!.replace(/'/g, "''")}'`;
      const ref = `${quoted}!$A$2:$${columnName(width - 1)}$${section.rows.length + 2}`;
      return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${escapeXml(ref)}</definedName>`;
    })
    .join('');

  return (
    XML_HEAD +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${sheets}</sheets>` +
    (filters ? `<definedNames>${filters}</definedNames>` : '') +
    '</workbook>'
  );
}

function workbookRels(sheetCount: number): string {
  const sheets = Array.from(
    { length: sheetCount },
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('');
  return (
    XML_HEAD +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets +
    `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    '</Relationships>'
  );
}

// ---------------------------------------------------------------------------------------------
// Zip (chỉ "store", không nén)
// ---------------------------------------------------------------------------------------------

/**
 * Gói các tệp thành zip KHÔNG nén.
 *
 * Không nén là lựa chọn có chủ ý: Excel, LibreOffice, Google Sheets đều mở được, và một báo cáo vài
 * chục KB không đáng để kéo thêm một thư viện nén vào trang quản trị. Thứ duy nhất phải tính đúng là
 * CRC-32 của từng tệp — sai một byte là Excel từ chối cả file.
 */
export function zipStore(
  entries: Array<{ name: string; data: Uint8Array }>,
  date = new Date(),
): Uint8Array {
  const encoder = new TextEncoder();
  const { time, day } = dosDateTime(date);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // phiên bản cần để giải nén
    lv.setUint16(6, 0x0800, true); // cờ: tên tệp UTF-8
    lv.setUint16(8, 0, true); // phương thức: store
    lv.setUint16(10, time, true);
    lv.setUint16(12, day, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, day, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local, entry.data);
    centrals.push(central);
    offset += local.length + size;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((sum, part) => sum + part.length, 0)));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Giờ kiểu MS-DOS mà zip dùng: độ phân giải 2 giây, năm tính từ 1980. */
function dosDateTime(date: Date): { time: number; day: number } {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

let crcTable: Uint32Array | undefined;

/** CRC-32 (IEEE 802.3), đúng thứ zip đòi. `crc32("123456789") === 0xCBF43926`. */
export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
