/** Origin giả, chỉ để phân giải đường dẫn tương đối. Không bao giờ đi ra ngoài hàm này. */
const PROBE_ORIGIN = 'http://return-url.invalid';

/**
 * Lọc `returnUrl` trước khi chuyển hướng sau đăng nhập.
 *
 * `returnUrl` đến từ query string, tức là từ bất kỳ ai gửi được một đường link. Chuyển hướng
 * thẳng theo nó là lỗ hổng open redirect kinh điển: kẻ tấn công gửi
 * `…/login?returnUrl=https://site-gia.example`, người dùng đăng nhập thật ở Keycloak rồi bị thả
 * sang trang giả đã chuẩn bị sẵn form "nhập lại mật khẩu".
 *
 * Cách kiểm: phân giải giá trị trên một origin giả rồi xem nó có ở lại đó không. So chuỗi bằng
 * tay ("có bắt đầu bằng `//` không", "có chứa `:` không") là trò đuổi bắt với bộ phân tích URL
 * của trình duyệt, và bên thua luôn là người viết danh sách.
 */
export function safeReturnUrl(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback;

  let url: URL;
  try {
    url = new URL(raw, PROBE_ORIGIN);
  } catch {
    return fallback;
  }

  // Rời khỏi origin giả nghĩa là giá trị đó trỏ ra ngoài: URL tuyệt đối, `//host`, `/\host`,
  // hay bất kỳ biến thể nào mà bộ phân tích hiểu là host khác.
  if (url.origin !== PROBE_ORIGIN) return fallback;

  // Trả về dạng đã chuẩn hoá, không trả lại chuỗi gốc: chuỗi gốc có thể mang ký tự điều khiển
  // mà mỗi nơi hiểu một kiểu.
  return `${url.pathname}${url.search}${url.hash}`;
}
