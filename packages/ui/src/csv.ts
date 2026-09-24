/**
 * Xuất báo cáo CSV nhiều khối, mở được bằng Excel tiếng Việt.
 *
 * CSV nghe như thứ không có gì để bàn — ghép chuỗi bằng dấu phẩy. Thực tế có bốn chỗ làm sai được,
 * và cả bốn đều chỉ lộ ra trên máy người dùng chứ không bao giờ lộ ra ở máy người viết.
 */

/** Một khối trong báo cáo: một tiêu đề, một hàng đầu cột, rồi dữ liệu. */
export interface CsvSection {
  title: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
}

/**
 * Bọc một ô cho đúng luật CSV, và chặn thực thi công thức.
 *
 * <b>(1) Dấu phẩy, dấu ngoặc kép, dòng mới</b> phải bọc trong ngoặc kép, và ngoặc kép bên trong
 * phải nhân đôi. Bỏ bước này thì một tên sự kiện có dấu phẩy sẽ tự tách thành hai cột, đẩy lệch mọi
 * cột phía sau của đúng dòng ấy.
 *
 * <b>(2) Ô bắt đầu bằng `=`, `+`, `-`, `@` bị Excel coi là CÔNG THỨC</b> và thực thi khi mở file.
 * Đây không phải chuyện lý thuyết: tên sự kiện, tên khu, tên hạng vé đều do ban tổ chức tự đặt, nên
 * một giá trị như <code>=HYPERLINK("http://…","Bấm vào đây")</code> đi thẳng từ ô nhập của họ vào
 * file mà người khác mở. Thêm một dấu nháy đơn ở đầu làm Excel đọc nó thành chữ. Excel không hiện
 * dấu nháy ấy ra, nên nó không làm bẩn báo cáo.
 */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  // Số đi vào file NGUYÊN là số, không qua chốt chặn công thức. Đây là chỗ dễ sai: `-5` khớp mẫu
  // "bắt đầu bằng dấu trừ", nhưng thêm nháy đơn vào một số âm làm Excel đọc nó thành CHỮ — và một
  // cột tiền có vài ô là chữ thì không cộng được, không vẽ được, không sắp xếp đúng.
  if (typeof value === 'number') {
    return String(value);
  }

  const escaped = /^[=+\-@]/.test(value) ? `'${value}` : value;

  return /[",\n\r]|^\s|\s$/.test(escaped) ? `"${escaped.replace(/"/g, '""')}"` : escaped;
}

/**
 * Ghép các khối thành một văn bản CSV.
 *
 * <b>(3) Dòng `sep=,` ở đầu file.</b> Excel chọn dấu tách cột theo <i>dấu tách danh sách</i> của hệ
 * điều hành, và trên Windows tiếng Việt nó thường là dấu chấm phẩy. Không có dòng này thì cả báo
 * cáo rơi vào MỘT cột — file đúng, nhưng vô dụng với người mở nó. Excel đọc dòng ấy rồi ẩn đi.
 *
 * <p>Đánh đổi nói thẳng: một số công cụ khác (Google Sheets, `pandas.read_csv` mặc định) sẽ coi
 * dòng đó là dữ liệu. Người nhận báo cáo này mở bằng Excel, nên đây là hướng đúng — nhưng nếu về
 * sau có đường nạp máy-đọc-máy thì nó cần một hàm khác, không phải hàm này.
 *
 * <p>CRLF chứ không LF: đúng chuẩn RFC 4180, và là thứ Excel trên Windows mong đợi.
 */
export function toCsv(sections: CsvSection[]): string {
  const lines: string[] = ['sep=,'];

  for (const section of sections) {
    lines.push(cell(section.title));
    lines.push(section.headers.map(cell).join(','));
    for (const row of section.rows) {
      lines.push(row.map(cell).join(','));
    }
    // Một dòng trống giữa các khối: Excel nhận ra đây là những vùng dữ liệu riêng, nên chọn một ô
    // rồi Ctrl+A chỉ chọn đúng khối đó thay vì cả trang.
    lines.push('');
  }

  return lines.join('\r\n');
}

/**
 * Tải nội dung xuống thành file.
 *
 * <b>(4) BOM UTF-8.</b> Không có ba byte ấy ở đầu file, Excel trên Windows đọc file theo bảng mã
 * ANSI của hệ và <i>mọi</i> chữ có dấu thành ký tự lạ — "Nhà hát Lớn" thành "NhÃ  hÃ¡t Lá»›n". Đây
 * là lỗi số một của mọi báo cáo CSV tiếng Việt, và nó không lộ ra ở máy người viết code nếu người
 * ấy mở file bằng VS Code.
 */
export function downloadCsv(filename: string, content: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Thu hồi ngay: giữ lại thì blob nằm trong bộ nhớ tới khi tải lại trang.
  URL.revokeObjectURL(url);
}

/** Tên file an toàn cho mọi hệ: bỏ dấu, bỏ ký tự Windows không cho phép. */
export function csvFilename(parts: string[], date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  const slug = parts
    .join('-')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return `${slug || 'bao-cao'}-${stamp}.csv`;
}
