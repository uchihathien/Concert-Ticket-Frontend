'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AUTH_POPUP_MESSAGE } from '@/lib/auth-popup';

/**
 * Báo kết quả về cửa sổ cha rồi tự đóng.
 *
 * `postMessage` luôn gửi kèm origin đích cụ thể, không dùng `'*'`: một cửa sổ khác đang mở cùng
 * lúc cũng nhận được message nếu để rộng, và message này là tín hiệu "đã đăng nhập xong".
 *
 * Trường hợp không đóng được — người dùng mở trang này ở tab thường, hoặc trình duyệt chặn
 * `window.close()` với cửa sổ không do script mở — thì hiện một lối quay về thay vì để họ mắc kẹt
 * ở màn hình trắng.
 */
export function PopupDone() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const opener = window.opener as Window | null;

    if (opener && !opener.closed) {
      opener.postMessage(AUTH_POPUP_MESSAGE, window.location.origin);
    }

    window.close();

    // `window.close()` im lặng không làm gì nếu cửa sổ không do script mở.
    const timer = setTimeout(() => setStuck(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="grid min-h-[60vh] place-items-center p-6 text-center">
      <div>
        <p className="font-semibold text-ink">Đã đăng nhập xong.</p>
        {stuck ? (
          <p className="mt-2 text-sm text-muted">
            Bạn có thể đóng cửa sổ này, hoặc{' '}
            <Link className="font-semibold text-primary underline" href="/">
              quay về trang chủ
            </Link>
            .
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">Đang đóng cửa sổ…</p>
        )}
      </div>
    </main>
  );
}
