/**
 * Hình dạng lỗi của toàn bộ API.
 *
 * Backend trả RFC 7807 kèm trường `code` (platform/starter-web `ApiError`). `code` là hợp đồng
 * ổn định để frontend rẽ nhánh giao diện; `detail` là tiếng Anh dành cho log, không đưa cho
 * người dùng đọc — câu tiếng Việt nằm ở `@nexaticket/ui/errors`.
 */
export interface ApiErrorBody {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  detail?: string;
  correlationId?: string;
  meta?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string | null;
  readonly correlationId: string | null;
  readonly meta: Record<string, unknown> | null;

  constructor(init: {
    status: number;
    code: string;
    detail?: string | null;
    correlationId?: string | null;
    meta?: Record<string, unknown> | null;
  }) {
    super(init.detail ?? init.code);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.detail = init.detail ?? null;
    this.correlationId = init.correlationId ?? null;
    this.meta = init.meta ?? null;
  }

  /** 4xx là lỗi của yêu cầu — thử lại y hệt chỉ tốn thêm một vòng. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }
}

/** Mất mạng, DNS hỏng, CORS chặn — không có response nên không có `code` từ server. */
export function networkError(cause: unknown): ApiError {
  const aborted = cause instanceof DOMException && cause.name === 'TimeoutError';
  return new ApiError({
    status: 0,
    code: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
    detail: cause instanceof Error ? cause.message : String(cause),
  });
}
