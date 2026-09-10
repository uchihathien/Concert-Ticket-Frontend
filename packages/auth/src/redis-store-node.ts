import Redis from 'ioredis';

import { RedisRefreshTokenStore } from './redis-store';
import type { RefreshTokenStore } from './token-store';

/**
 * Dựng store phiên từ `REDIS_URL`, cho tầng server của Node.
 *
 * <h3>Vì sao là một entry point RIÊNG</h3>
 *
 * `@nexaticket/auth` (entry chính) cố ý không phụ thuộc `ioredis`: cả bốn app dùng package đó, kể
 * cả `web-scanner` với ngân sách 150KB JS, và middleware thì chạy ở Edge runtime nơi `ioredis`
 * không nạp được. File này chỉ được `src/auth.ts` của từng app import — mã chạy ở Node runtime —
 * nên client Redis không bao giờ đi vào bundle của trình duyệt hay của Edge.
 *
 * <h3>Trả về `undefined` khi không có REDIS_URL</h3>
 *
 * Không phải để "chạy tạm": `createNexaAuth` khi đó rơi về `defaultRefreshTokenStore()`, và hàm đó
 * NÉM LỖI ở production. Nên thiếu biến này ở production là hỏng ngay lúc khởi động kèm thông báo
 * nói rõ thiếu gì — thay vì chạy được rồi đăng xuất người dùng ngẫu nhiên vài giờ sau.
 */
export function redisRefreshTokenStoreFromEnv(): RefreshTokenStore | undefined {
  const url = process.env.REDIS_URL;
  if (!url) return undefined;
  return new RedisRefreshTokenStore(sharedClient(url));
}

/**
 * Một kết nối cho cả tiến trình.
 *
 * Next tái tạo module trong cùng một tiến trình khi hot-reload và khi phục vụ nhiều route; dựng
 * client mới ở mỗi lần import sẽ mở dần tới lúc Redis từ chối kết nối mới, và triệu chứng
 * ("max number of clients reached") xuất hiện muộn, dưới tải, ở một chỗ chẳng liên quan.
 */
const GLOBAL_CLIENT = Symbol.for('nexaticket.auth.redis');
type GlobalWithClient = typeof globalThis & { [GLOBAL_CLIENT]?: Redis };

function sharedClient(url: string): Redis {
  const scope = globalThis as GlobalWithClient;
  return (scope[GLOBAL_CLIENT] ??= new Redis(url, {
    // Xếp hàng lệnh trong lúc chưa kết nối xong thay vì ném ngay: một request tới đúng vào giây
    // Redis đang khởi động lại nên phải chờ, không nên thất bại.
    enableOfflineQueue: true,
    maxRetriesPerRequest: 3,
  }));
}
