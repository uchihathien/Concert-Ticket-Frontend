'use client';

import { BrandLogo } from '@nexaticket/ui';
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

  // Trang này hiện ngay sau trang Keycloak, trong cùng popup 480px. Dựng như thẻ form của theme
  // Keycloak — logo trên đầu, cùng nền, cùng bo góc — để popup không "nháy" sang một giao diện khác
  // trong khoảnh khắc trước khi đóng. Dưới 520px thẻ tràn hết chiều ngang giống hệt bên đó.
  return (
    <main className="grid min-h-dvh place-items-center bg-bg-subtle p-6 max-[520px]:place-items-start max-[520px]:bg-surface max-[520px]:p-0">
      <div className="flex w-[min(440px,100%)] flex-col gap-5 rounded-nt-lg border border-border bg-surface p-8 max-[520px]:rounded-none max-[520px]:border-0 max-[520px]:px-5 max-[520px]:py-6">
        <BrandLogo height={36} priority />
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
            Đã đăng nhập xong
          </h1>
          {stuck ? (
            <p className="m-0 text-muted">
              Bạn có thể đóng cửa sổ này, hoặc{' '}
              <Link className="font-semibold text-primary-text underline" href="/">
                quay về trang chủ
              </Link>
              .
            </p>
          ) : (
            <p className="m-0 text-muted" aria-live="polite">
              Đang đóng cửa sổ và quay lại trang bạn đang xem…
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
