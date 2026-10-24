/**
 * Phiên chat với trợ lý, sống trong bộ nhớ của app.
 *
 * Đủ để khách rời màn Trợ lý (sang thanh toán, xem vé) rồi quay lại mà vẫn còn mạch hội thoại; tự hết
 * khi tắt app — cùng vòng đời với `sessionStorage` của khung chat web. Không ghi xuống máy: hội thoại có
 * mã đơn và số tiền, và máy có thể dùng chung.
 */
export const assistantSession: { id: string | null } = { id: null };
