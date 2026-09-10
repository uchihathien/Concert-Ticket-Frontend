import type { RefreshTokenStore, StoredRefreshToken } from './token-store';

/**
 * Store ném lỗi thay vì trả dữ liệu rỗng.
 *
 * Trả `null` cho mọi phép đọc sẽ khiến một lần chạm store ngoài ý muốn trông như "phiên không tồn
 * tại" — tức là người dùng bị đăng xuất, không có lỗi nào, và không ai lần ra vì sao. Ném lỗi kèm
 * lý do biến cùng sự việc đó thành một dòng stack trace chỉ thẳng vào chỗ cần sửa.
 */
export function unreachableStore(): RefreshTokenStore {
  const refuse = (): never => {
    throw new Error(
      '[@nexaticket/auth] Store phiên không với tới được từ Edge runtime. Middleware chỉ được ' +
        'đọc cookie để biết "có phiên hay không"; mọi thao tác cần store phải nằm ở route handler ' +
        'phía Node (xem readAccessToken).',
    );
  };
  return {
    get: async (): Promise<StoredRefreshToken | null> => refuse(),
    set: async (): Promise<void> => refuse(),
    delete: async (): Promise<void> => refuse(),
  };
}
