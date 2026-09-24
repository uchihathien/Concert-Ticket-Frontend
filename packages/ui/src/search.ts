/**
 * So khớp chuỗi cho ô tìm kiếm lọc tại chỗ.
 *
 * `foldText` bỏ dấu và hạ chữ thường: tên tiếng Việt có dấu, còn người tìm thì gõ không dấu —
 * "hoa binh" phải khớp "Hoà Bình". So khớp thô sẽ bảo là không có dòng nào, trong khi dòng đó nằm
 * ngay đầu bảng, và người dùng kết luận là dữ liệu bị mất.
 *
 * `đ` không tách được bằng NFD (nó là một chữ cái riêng, không phải `d` cộng dấu) nên phải đổi tay.
 *
 * Chỉ dùng cho bộ lọc phía trình duyệt. Tìm kiếm thật — trên tập dữ liệu mà máy người dùng không
 * giữ hết — là việc của database, nơi có `unaccent` và chỉ mục.
 */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\u0111/g, 'd');
}

/**
 * Chuỗi tìm (đã fold) có khớp bất kỳ trường nào không.
 *
 * `null`/`undefined` bỏ qua thay vì đọc thành chuỗi "null": email và tên có thể chưa có, và một
 * dòng thiếu tên không được vì thế mà khớp mọi từ khoá.
 */
export function matchesText(needle: string, fields: Array<string | null | undefined>): boolean {
  if (!needle) return true;
  return fields.some((field) => (field ? foldText(field).includes(needle) : false));
}
