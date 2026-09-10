import { ApiError, networkError, type ApiErrorBody } from './api-error';

export interface ApiClientOptions {
  /** Gốc của api-gateway, ví dụ `http://localhost:8080`. Không kèm dấu `/` cuối. */
  baseUrl: string;
  /**
   * Lấy access token. Trả `null` nghĩa là đang là khách vãng lai — vẫn gọi được các endpoint
   * công khai (`GET /v1/sessions/{id}/seats`).
   *
   * Là hàm chứ không phải chuỗi vì token sống rất ngắn: mỗi request phải hỏi lại nơi giữ token
   * (bộ nhớ tiến trình ở client, session phía server ở RSC).
   */
  getAccessToken?: () => Promise<string | null> | string | null;
  /** Ghi đè để test. Mặc định dùng `fetch` toàn cục. */
  fetch?: typeof globalThis.fetch;
  /** ms. Cửa soát vé dùng mạng nhà thi đấu — treo vô hạn tệ hơn là báo lỗi. */
  timeoutMs?: number;
  /**
   * Gateway từ chối token (401).
   *
   * <h3>Vì sao cần, khi đã có `/api/auth/token` báo phiên hết hạn</h3>
   *
   * Hai đường đó trả lời hai câu khác nhau, và chỉ đường này thấy được câu quan trọng.
   * `/api/auth/token` chỉ hỏi Keycloak; mà Keycloak **không biết** về `revoked_sessions` hay
   * `users.status` của identity-service. Sau khi quản trị viên thu hồi phiên hoặc khoá tài khoản,
   * Keycloak vẫn vui vẻ cấp access token mới — nên `/api/auth/token` trả 200 vĩnh viễn trong khi
   * MỌI lời gọi gateway trả 401.
   *
   * Người dùng khi đó mắc kẹt: cookie nói đã đăng nhập, màn hình nào cũng lỗi, và không có đường
   * nào tự thoát. Tính năng thu hồi phiên vì thế mới xong một nửa.
   *
   * Là callback chứ không phải hành vi cố định: app quản trị nên đẩy thẳng về trang đăng nhập,
   * còn app khách thì chỉ nên xoá token và mở hộp thoại — đá một người đang xem danh sách sự kiện
   * sang trang đăng nhập là phản ứng thái quá.
   */
  onUnauthenticated?: () => void;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /**
   * Bắt buộc với mọi POST đổi trạng thái (starter-idempotency chặn trước khi vào controller).
   * Sinh khi người dùng bấm nút, không phải khi gửi request — xem `useIdempotencyKey`.
   */
  idempotencyKey?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Gửi `If-None-Match`; response 304 trả về `notModified: true` với `data: null`. */
  etag?: string | null;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  etag: string | null;
  correlationId: string | null;
  notModified: boolean;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken: ApiClientOptions['getAccessToken'];
  private readonly fetchImpl: typeof globalThis.fetch | undefined;
  private readonly timeoutMs: number;
  private readonly onUnauthenticated: ApiClientOptions['onUnauthenticated'];

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getAccessToken = options.getAccessToken;
    this.fetchImpl = options.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.onUnauthenticated = options.onUnauthenticated;
  }

  /**
   * Tra `fetch` ở thời điểm gọi, không phải lúc khởi tạo.
   *
   * `ApiClient` thường được tạo ở module scope, chạy ngay khi import. Chốt cứng `globalThis.fetch`
   * lúc đó là vô hiệu hoá mọi thứ vá vào sau: MSW ở test, và bản `fetch` có instrumentation mà
   * Next.js gắn vào ở phía server.
   */
  private get doFetch(): typeof globalThis.fetch {
    // `.bind(globalThis)` là BẮT BUỘC, không phải cho gọn.
    //
    // `fetch` của trình duyệt đòi receiver là `window`. Gọi qua `this.doFetch(...)` thì receiver
    // lại là chính ApiClient, và Chrome ném
    // `TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation`.
    //
    // Lỗi này ẩn rất lâu: undici ở Node không kiểm receiver, nên test và server component chạy
    // bình thường. Nó chỉ lộ ra ở trình duyệt — và trước khi gateway mở CORS thì mọi request từ
    // trình duyệt đều hỏng sẵn vì lý do khác, nên không ai nhìn thấy.
    return (this.fetchImpl ?? globalThis.fetch).bind(globalThis);
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };

    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    if (options.etag) headers['If-None-Match'] = options.etag;

    const token = await this.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await this.doFetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal ?? timeoutSignal(this.timeoutMs),
        // Không gửi cookie sang gateway: xác thực đi bằng Bearer token, và cookie phiên là của
        // Next.js chứ không phải của backend.
        credentials: 'omit',
      });
    } catch (cause) {
      throw networkError(cause);
    }

    const correlationId = response.headers.get('X-Correlation-Id');

    if (response.status === 304) {
      return {
        data: null as T,
        status: 304,
        etag: response.headers.get('ETag'),
        correlationId,
        notModified: true,
      };
    }

    if (!response.ok) {
      const error = await toApiError(response, correlationId);
      // Báo TRƯỚC khi ném: nơi bắt lỗi thường chỉ hiện một thông báo rồi thôi, nên nếu chờ nó xử
      // lý thì mỗi màn hình lại phải nhớ tự gọi — và màn hình quên là màn hình mắc kẹt.
      if (error.status === 401) this.onUnauthenticated?.();
      throw error;
    }

    return {
      data: await readBody<T>(response),
      status: response.status,
      etag: response.headers.get('ETag'),
      correlationId,
      notModified: false,
    };
  }

  async get<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method'> = {}) {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  /** Sửa một phần: trường nào không gửi thì backend giữ nguyên, không phải xoá. */
  async patch<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method'> = {}) {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  /** Thay toàn bộ. Backend dùng PUT ở đúng những chỗ "gửi lại cả bộ", ví dụ trần mua vé. */
  async put<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method'> = {}) {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  async delete<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

async function readBody<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.headers.get('Content-Length') === '0') {
    return null as T;
  }
  const text = await response.text();
  if (text === '') return null as T;
  return JSON.parse(text) as T;
}

async function toApiError(response: Response, correlationId: string | null): Promise<ApiError> {
  let body: ApiErrorBody = {};
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // Gateway, proxy hoặc trang lỗi của hạ tầng có thể trả HTML. Vẫn phải dựng được ApiError,
    // nếu không thì lỗi 502 hiện ra dưới dạng "Unexpected token <".
  }

  return new ApiError({
    status: response.status,
    code: body.code ?? fallbackCode(response.status),
    detail: body.detail ?? null,
    correlationId: body.correlationId ?? correlationId,
    meta: body.meta ?? null,
  });
}

function fallbackCode(status: number): string {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'VALIDATION_FAILED';
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
    ? AbortSignal.timeout(ms)
    : undefined;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}
