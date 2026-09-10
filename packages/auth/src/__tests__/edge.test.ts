import { describe, expect, it } from 'vitest';

import { unreachableStore } from '../edge-store';

/**
 * Bản Edge tồn tại vì `middleware.ts` chạy trong Edge runtime, nơi `ioredis` không nạp được. Chỉ
 * cần một file mà middleware import kéo theo store là `next build` hỏng với
 * `UnhandledSchemeError: Reading from "node:diagnostics_channel"` — thông báo không nói gì về
 * nguyên nhân, và hỏng lúc build nên không có gì để gỡ.
 *
 * <p>Test ở đây chỉ chạm vào store, KHÔNG dựng `createEdgeAuth`: dựng nó kéo theo runtime của
 * next-auth, vốn không phân giải được `next/server` dưới vitest — cùng lý do khiến
 * `middleware-paths.test.ts` dùng stub. Việc "bundle Edge biên dịch được" do `docker build` chứng
 * minh, và đó mới là phép thử đúng cho câu hỏi đó.
 */
describe('store của bản Edge', () => {
  it('chạm vào thì ném lỗi nói rõ lý do, KHÔNG trả null', async () => {
    // Trả null sẽ khiến một lần chạm ngoài ý muốn trông như "phiên không tồn tại": người dùng bị
    // đăng xuất, không có lỗi nào, và không ai lần ra vì sao. Đó là hỏng im lặng — tệ hơn hẳn một
    // stack trace chỉ thẳng vào chỗ cần sửa.
    const store = unreachableStore();

    await expect(store.get('ref-bat-ky')).rejects.toThrow(/Edge runtime/);
    await expect(store.set('ref-bat-ky', {} as never)).rejects.toThrow(/Node/);
    await expect(store.delete('ref-bat-ky')).rejects.toThrow(/Node/);
  });
});
