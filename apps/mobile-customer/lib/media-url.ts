const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

/**
 * Gốc địa chỉ mà điện thoại tới được kho ảnh (MinIO, cổng 9000 trên máy chạy backend).
 *
 * Backend trả ảnh dạng `http://localhost:9000/nexaticket-media/...` — đúng với web chạy trên chính
 * máy đó, vô nghĩa với điện thoại. Khi API đi qua tunnel (ngrok), chỉ đổi host như trước là ra
 * `http://<host ngrok>:9000/...`: host đó không có cổng 9000, nên mọi ảnh trắng. Vì vậy khi có biến
 * này, thay CẢ gốc (giao thức + host + cổng) bằng nó — ví dụ một tunnel trỏ vào cổng 9000.
 */
const mediaBaseUrl = process.env.EXPO_PUBLIC_MEDIA_BASE_URL;

export function resolveMediaUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const mediaUrl = new URL(value);
    if (mediaUrl.hostname !== 'localhost' && mediaUrl.hostname !== '127.0.0.1') {
      return mediaUrl.toString();
    }

    if (mediaBaseUrl) {
      const base = new URL(mediaBaseUrl);
      mediaUrl.protocol = base.protocol;
      mediaUrl.hostname = base.hostname;
      mediaUrl.port = base.port;
      return mediaUrl.toString();
    }

    // Không khai biến: giữ cách cũ — đổi host sang host của API (đúng khi API là IP LAN).
    mediaUrl.hostname = new URL(apiBaseUrl).hostname;
    return mediaUrl.toString();
  } catch {
    return value;
  }
}
