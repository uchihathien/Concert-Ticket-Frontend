'use client';

import { Button, Input } from '@nexaticket/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * S-HOME — chọn suất diễn trước khi soát.
 *
 * Vì sao phải gõ mã suất thay vì chọn từ danh sách: backend chưa có đường đọc nào dành cho nhân
 * viên soát vé. `GET /v1/organizations/{id}/events` nằm sau kiểm quyền quản lý danh mục, mà
 * `CHECKIN_STAFF` không có quyền đó — gọi vào sẽ nhận 403. Bịa một bộ chọn rồi để nó luôn lỗi thì
 * tệ hơn một ô nhập nói thật.
 *
 * Đường đúng về lâu dài là mã truy cập theo suất (ADR-1008): nhân viên nhập mã 8 ký tự, backend
 * trả token gắn sẵn suất diễn. Chưa có endpoint phát mã nên chưa dựng được.
 */
export default function SessionPickerPage() {
  const router = useRouter();

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: 'min(420px, 100%)', display: 'grid', gap: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: 26, letterSpacing: '-0.02em' }}>Soát vé</h1>
          <p style={{ margin: 0, color: 'var(--nt-text-muted)' }}>
            Nhập mã suất diễn bạn đang trực. Mã do ban tổ chức cung cấp.
          </p>
        </div>

        <form
          action={(formData: FormData) => {
            const session = String(formData.get('session') ?? '').trim();
            if (session) router.push(`/scan?session=${encodeURIComponent(session)}`);
          }}
          style={{ display: 'grid', gap: 16 }}
        >
          <Input
            name="session"
            label="Mã suất diễn"
            required
            autoComplete="off"
            hint="Dạng UUID, ví dụ 0b8f…-…-…"
          />
          <Button type="submit" size="lg" block>
            Bắt đầu soát
          </Button>
        </form>

        <p style={{ margin: 0 }}>
          <Link href="/account">Tài khoản và đăng xuất</Link>
        </p>
      </div>
    </main>
  );
}
