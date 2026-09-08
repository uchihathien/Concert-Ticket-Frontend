'use client';

import { useSessionState } from '@nexaticket/auth/client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AuthDialog } from './AuthDialog';
import styles from './site.module.css';

/**
 * Phần cuối header: nút đăng nhập, hoặc lối vào tài khoản khi đã đăng nhập.
 *
 * Hỏi trạng thái phiên ở phía client chứ không ở server có lý do: trang chủ và các trang chữ
 * đang là HTML tĩnh (prerender). Gọi `auth()` trong layout sẽ biến tất cả thành render theo từng
 * request và mất luôn ngân sách LCP của C-HOME, chỉ để đổi một chữ trên header.
 *
 * Trong lúc chưa biết trạng thái thì hiện nút đăng nhập: khách vãng lai là số đông, nên đoán về
 * phía đó là ít nhấp nháy nhất.
 */
export function AccountNav({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const { state, refresh } = useSessionState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (state === 'authenticated') {
    return (
      <Link className={styles.account} href="/account">
        Tài khoản
      </Link>
    );
  }

  const search = searchParams.toString();
  const returnUrl = `${pathname}${search ? `?${search}` : ''}`;

  return (
    <>
      <Link
        className={styles.login}
        href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}
        // Vẫn là link thật tới `/login`: không có JavaScript thì bấm là sang trang đó, và mở
        // bằng chuột giữa / Ctrl+click vẫn ra tab mới như người dùng mong đợi.
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          setDialogOpen(true);
        }}
      >
        Đăng nhập
      </Link>

      <AuthDialog
        googleEnabled={googleEnabled}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAuthenticated={refresh}
        returnUrl={returnUrl}
      />
    </>
  );
}
