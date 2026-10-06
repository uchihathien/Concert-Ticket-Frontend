/**
 * Tìm suất diễn theo từ khoá — lọc ngay trên máy, không gọi thêm API.
 *
 * Danh sách suất của nhân viên soát vé đã nằm trọn trong bộ nhớ (vài chục suất là nhiều), nên lọc
 * tại chỗ phản hồi tức thì kể cả khi mạng ở cửa soát vé chập chờn.
 */

export interface SearchableSession {
  eventTitle: string;
  venueName: string;
  organizationName: string;
  startsAt: string;
}

/**
 * Bỏ dấu tiếng Việt + chữ thường.
 *
 * Nhân viên gõ vội trên bàn phím điện thoại, thường không bật bộ gõ dấu: "dem ha noi" phải khớp
 * "Đêm Hà Nội". `đ` không phải dấu kết hợp nên NFD không tách được — đổi riêng.
 */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function searchableDate(startsAt: string): string {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return '';
  // Cả hai dạng người ta hay gõ: "15/10", "15/10/2026", "20:00".
  const day = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `${day} ${time}`;
}

/**
 * Mọi từ trong truy vấn đều phải xuất hiện (AND), ở bất kỳ trường nào và theo bất kỳ thứ tự nào:
 * "comedy viet tiep" khớp "Stand-up Comedy · Cười Vỡ Bụng" tại "Cung Văn hóa Hữu nghị Việt Tiệp".
 */
export function matchesSession(session: SearchableSession, query: string): boolean {
  const terms = foldText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = foldText(
    [session.eventTitle, session.venueName, session.organizationName, searchableDate(session.startsAt)].join(' '),
  );
  return terms.every((term) => haystack.includes(term));
}
