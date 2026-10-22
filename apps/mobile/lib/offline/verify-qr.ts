import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

/*
 * React Native không có WebCrypto SHA-512, nên @noble/ed25519 cần được cấp hàm băm thuần JS. Gán
 * một lần lúc nạp module; mọi lời gọi `verify` sau đó dùng bản đồng bộ.
 */
ed.hashes.sha512 = sha512;

/**
 * Kiểm mã QR vé NGAY TRÊN MÁY khi mất mạng.
 *
 * Định dạng giống hệt `Ed25519TicketSigner` của ticketing-service: JWS compact
 * `base64url(header).base64url(payload).base64url(chữ ký)`, header `{alg: EdDSA, kid}`, payload
 * `{jti, exp}`. Khoá công khai lấy từ gói dữ liệu soát vé (32 byte thô, base64url), tra theo `kid` —
 * vé phát bằng khoá đã nghỉ hưu vẫn kiểm được.
 *
 * Mọi đường hỏng trả `null`, không ném: đầu vào là bất cứ thứ gì camera đọc được ở cửa.
 */
export function verifyTicketQr(
  token: string,
  keys: Map<string, Uint8Array>,
  nowEpochSecond: number = Math.floor(Date.now() / 1000),
): { jti: string; exp: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(decodeUtf8(base64UrlToBytes(parts[0]))) as { kid?: string };
    const key = header.kid ? keys.get(header.kid) : undefined;
    if (!key) return null;
    const signingInput = asciiBytes(`${parts[0]}.${parts[1]}`);
    if (!ed.verify(base64UrlToBytes(parts[2]), signingInput, key)) return null;
    const payload = JSON.parse(decodeUtf8(base64UrlToBytes(parts[1]))) as { jti?: string; exp?: number | string };
    const exp = Number(payload.exp);
    if (!payload.jti || !Number.isFinite(exp) || nowEpochSecond >= exp) return null;
    return { jti: String(payload.jti), exp };
  } catch {
    return null;
  }
}

export function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Phần trước chữ ký là base64url — toàn ký tự ASCII, chép thẳng từng mã ký tự. */
function asciiBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) bytes[i] = value.charCodeAt(i);
  return bytes;
}

function decodeUtf8(bytes: Uint8Array): string {
  let escaped = '';
  for (const byte of bytes) escaped += `%${byte.toString(16).padStart(2, '0')}`;
  return decodeURIComponent(escaped);
}
