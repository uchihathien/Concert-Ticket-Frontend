/**
 * Từ điển lỗi duy nhất cho cả 4 app (plan/frontend.md §7).
 *
 * Backend trả `detail` bằng tiếng Anh để ghi log; câu chữ cho người dùng nằm ở đây. Khoá là
 * `code` trong `ApiError` — hợp đồng ổn định mà backend cam kết không đổi, không xoá.
 *
 * Giọng văn theo ui-direction.md §10: một câu cho người, mã hiện ở dòng phụ.
 */

/** Cách hiện lỗi. Quyết định ở đây thay vì rải rác trong từng màn. */
export type ErrorDisplay = 'toast' | 'banner' | 'inline' | 'modal' | 'overlay';

export interface ErrorCopy {
  message: string;
  display: ErrorDisplay;
  /** Người dùng bấm lại được thì có ích; lỗi hạn mức thì không. */
  retryable?: boolean;
}

export interface ApiErrorLike {
  code?: string | null;
  meta?: Record<string, unknown> | null;
}

const CATALOG: Record<string, ErrorCopy> = {
  // --- Dùng chung (platform/starter-web ErrorCode.Common) ---
  VALIDATION_FAILED: { message: 'Dữ liệu chưa hợp lệ', display: 'inline' },
  IDEMPOTENCY_KEY_REQUIRED: { message: 'Thiếu khoá chống trùng yêu cầu', display: 'toast' },
  IDEMPOTENCY_KEY_REUSED: { message: 'Yêu cầu này đã được xử lý', display: 'toast' },
  REQUEST_IN_PROGRESS: { message: 'Yêu cầu trước đang chạy, chờ một chút', display: 'toast' },
  UNAUTHENTICATED: { message: 'Phiên đăng nhập đã hết hạn', display: 'modal' },
  FORBIDDEN: { message: 'Bạn không có quyền thực hiện việc này', display: 'banner' },
  NOT_FOUND: { message: 'Không tìm thấy dữ liệu', display: 'banner' },
  CONFLICT: {
    message: 'Dữ liệu vừa thay đổi, tải lại rồi thử lại',
    display: 'toast',
    retryable: true,
  },
  RATE_LIMITED: {
    message: 'Bạn thao tác quá nhanh, chờ một chút',
    display: 'toast',
    retryable: true,
  },
  INTERNAL_ERROR: {
    message: 'Hệ thống gặp sự cố, thử lại sau',
    display: 'banner',
    retryable: true,
  },
  UPSTREAM_UNAVAILABLE: {
    message: 'Hệ thống đang bận, thử lại',
    display: 'toast',
    retryable: true,
  },

  // --- inventory-service ---
  SESSION_NOT_FOUND: { message: 'Không tìm thấy suất diễn', display: 'banner' },
  SALES_CLOSED: { message: 'Suất này chưa mở bán hoặc đã đóng', display: 'banner' },
  SEAT_UNAVAILABLE: { message: 'Ghế vừa được người khác giữ', display: 'toast', retryable: true },
  ZONE_SOLD_OUT: { message: 'Khu vực này đã hết vé đứng', display: 'toast' },
  HOLD_LIMIT_EXCEEDED: { message: 'Vượt số vé tối đa mỗi lần giữ', display: 'toast' },
  CUSTOMER_LIMIT_EXCEEDED: { message: 'Bạn đã đạt giới hạn vé cho suất này', display: 'banner' },
  HOLD_NOT_FOUND: { message: 'Không tìm thấy lượt giữ chỗ', display: 'modal' },
  HOLD_EXPIRED: { message: 'Hết thời gian giữ chỗ', display: 'modal' },
  INVENTORY_UNAVAILABLE: {
    message: 'Hệ thống đang bận, thử lại',
    display: 'toast',
    retryable: true,
  },

  // --- identity-service ---
  ORGANIZATION_NOT_FOUND: { message: 'Không tìm thấy tổ chức', display: 'banner' },
  SLUG_ALREADY_TAKEN: { message: 'Đường dẫn này đã có tổ chức khác dùng', display: 'inline' },
  NOT_A_MEMBER: { message: 'Bạn không thuộc tổ chức này', display: 'banner' },
  ALREADY_A_MEMBER: { message: 'Người này đã là thành viên', display: 'inline' },
  LAST_OWNER: { message: 'Không thể gỡ chủ sở hữu cuối cùng của tổ chức', display: 'modal' },
  INVITATION_INVALID: { message: 'Lời mời không hợp lệ', display: 'banner' },
  INVITATION_EXPIRED: { message: 'Lời mời đã hết hạn', display: 'banner' },
  INVITATION_ALREADY_USED: { message: 'Lời mời đã được dùng', display: 'banner' },
  EMAIL_MISMATCH: { message: 'Lời mời được gửi cho email khác', display: 'banner' },
  ORGANIZATION_SUSPENDED: { message: 'Tổ chức đang bị khoá', display: 'banner' },
  SCANNER_CODE_INVALID: { message: 'Mã soát vé không hợp lệ', display: 'inline' },
  SCANNER_CODE_EXHAUSTED: { message: 'Mã soát vé đã hết lượt dùng', display: 'inline' },

  // --- Lỗi phía client, không tới từ backend ---
  NETWORK_ERROR: { message: 'Mất kết nối mạng', display: 'toast', retryable: true },
  TIMEOUT: { message: 'Máy chủ phản hồi quá lâu', display: 'toast', retryable: true },
};

/**
 * Tên mã trong plan/frontend.md §7 khác tên mã backend thật sự phát ra. Giữ cả hai đường vào để
 * bảng lỗi trong tài liệu và code không phân kỳ, thay vì im lặng rơi xuống câu chữ mặc định.
 */
const ALIASES: Record<string, string> = {
  TOO_MANY_SEATS: 'HOLD_LIMIT_EXCEEDED',
  PURCHASE_LIMIT_EXCEEDED: 'CUSTOMER_LIMIT_EXCEEDED',
  SESSION_NOT_ON_SALE: 'SALES_CLOSED',
  REDIS_UNAVAILABLE: 'INVENTORY_UNAVAILABLE',
  WRONG_ORGANIZATION: 'FORBIDDEN',
};

const FALLBACK: ErrorCopy = {
  message: 'Có lỗi xảy ra, thử lại sau',
  display: 'toast',
  retryable: true,
};

export function errorCopy(code: string | null | undefined): ErrorCopy {
  if (!code) return FALLBACK;
  const alias = ALIASES[code];
  return CATALOG[code] ?? (alias ? CATALOG[alias] : undefined) ?? FALLBACK;
}

/**
 * Câu chữ cuối cùng, có chèn số liệu khi backend gửi kèm `meta`.
 *
 * "Vượt số vé tối đa mỗi lần giữ" nói ít hơn hẳn "Vượt số vé tối đa mỗi lần giữ (tối đa 8 vé)",
 * và plan §7 đòi nêu rõ trần hiện hành.
 */
export function errorMessage(error: ApiErrorLike | null | undefined): string {
  const copy = errorCopy(error?.code);
  const meta = error?.meta ?? {};
  const limit = numberOf(meta.limit ?? meta.maxPerHold ?? meta.maxTicketsPerCustomer);
  const remaining = numberOf(meta.remaining);

  if (error?.code === 'HOLD_LIMIT_EXCEEDED' && limit !== null) {
    return `${copy.message} (tối đa ${limit} vé)`;
  }
  if (error?.code === 'CUSTOMER_LIMIT_EXCEEDED' && remaining !== null) {
    return `${copy.message} (còn được mua ${remaining} vé)`;
  }
  return copy.message;
}

function numberOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

/** Mã đã biết thì hiện kèm dòng phụ; mã lạ thì đừng doạ người dùng bằng chuỗi vô nghĩa. */
export function isKnownErrorCode(code: string | null | undefined): boolean {
  return Boolean(code && (code in CATALOG || code in ALIASES));
}
