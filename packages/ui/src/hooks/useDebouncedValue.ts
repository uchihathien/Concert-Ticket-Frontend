'use client';

import { useEffect, useState } from 'react';

/**
 * Giá trị chậm lại một nhịp.
 *
 * Dùng cho ô tìm kiếm gọi mạng: gõ "Nguyễn" là 6 phím, và không có cái này thì đó là 6 request,
 * 5 trong số đó bị bỏ đi ngay khi vừa về. Với bảng tra cứu vé của một sự kiện lớn thì mỗi request
 * ấy là một lần quét vài nghìn dòng ở database.
 *
 * Trả giá trị **hiện tại** ngay ở lần dựng đầu, không trả rỗng: ô nhập đã có sẵn nội dung (ví dụ
 * mở từ một đường dẫn có bộ lọc) phải cho ra kết quả ngay, không phải đợi thêm một nhịp.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    // Dọn timer cũ ở mỗi lần giá trị đổi — đó chính là phần "chậm lại": chỉ lần gõ cuối cùng sống
    // đủ lâu để chạy.
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
