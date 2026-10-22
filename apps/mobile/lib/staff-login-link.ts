/**
 * Mã QR / deep link đăng nhập nhân viên: `nexaticket-staff://login?u=<tên đăng nhập>&p=<PIN>`.
 *
 * Tự tách chuỗi thay vì dùng `URL`: bản `URL` của React Native không đầy đủ (`searchParams` thiếu
 * ở nhiều phiên bản), và một mã QR bất kỳ ở cửa không được làm sập màn đăng nhập.
 */
export interface StaffLoginLink {
  username: string;
  pin: string;
}

export function parseStaffLoginLink(raw: string | null | undefined): StaffLoginLink | null {
  if (!raw) return null;
  const match = /(?:^|[/:])login\?([^#]*)/.exec(raw.trim());
  if (!match) return null;
  const params: Record<string, string> = {};
  for (const part of match[1].split('&')) {
    const [key, value = ''] = part.split('=');
    try {
      params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
      return null;
    }
  }
  const username = params.u?.trim();
  const pin = params.p?.trim();
  if (!username || !pin || !/^\d{6}$/.test(pin)) return null;
  return { username, pin };
}
