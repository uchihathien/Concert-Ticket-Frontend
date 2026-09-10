import { createNexaAuth, type NexaAuth, type NexaAuthOptions } from './config';
import { unreachableStore } from './edge-store';

/**
 * Bản {@link NexaAuth} dùng cho **middleware**, nơi mã chạy trong Edge runtime.
 *
 * <h3>Vì sao phải có bản riêng</h3>
 *
 * Middleware của Next.js chạy ở Edge runtime: không có `net`, `tls`, `node:diagnostics_channel`.
 * Store phiên thì dựa trên `ioredis`, vốn cần cả ba. Chỉ cần `src/auth.ts` **import** store là
 * webpack kéo `ioredis` vào bundle Edge và `next build` hỏng với
 * `UnhandledSchemeError: Reading from "node:diagnostics_channel"` — một thông báo không nói gì về
 * nguyên nhân thật, và nó hỏng lúc BUILD chứ không phải lúc chạy, nên không có gì để mà gỡ.
 *
 * <h3>Vì sao bỏ store đi là ĐÚNG, không phải là né tránh</h3>
 *
 * Middleware chỉ trả lời đúng một câu: "có phiên hay không" — và câu đó nằm trong cookie. Câu
 * "token còn hạn không" do `readAccessToken` trả lời ở route handler phía Node. Điều này đã là
 * ràng buộc từ trước: callback `jwt` cố ý không chạm store ở các request sau, vì Edge runtime là
 * một realm riêng và store in-memory ở đó luôn rỗng — hỏi nó thì middleware luôn kết luận "phiên
 * đã chết" và giết phiên khoẻ mạnh ngay ở lần điều hướng đầu tiên.
 *
 * Nên bản này không "thiếu" store. Nó nói rõ ra một điều vốn đã đúng.
 */
export function createEdgeAuth(options: Omit<NexaAuthOptions, 'refreshTokenStore'>): NexaAuth {
  return createNexaAuth({ ...options, refreshTokenStore: unreachableStore() });
}
