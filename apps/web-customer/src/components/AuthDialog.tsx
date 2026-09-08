'use client';

import { clearAccessToken } from '@nexaticket/auth/client';
import { GoogleButton } from '@nexaticket/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTH_POPUP_MESSAGE, openAuthPopup, redirectToAuth, type AuthMode } from '@/lib/auth-popup';

export interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
  /** Gọi khi phiên đã sẵn sàng, để header đổi sang trạng thái đã đăng nhập. */
  onAuthenticated: () => void;
  /** Chỗ người dùng đang đứng — dùng cho đường dự phòng khi popup bị chặn. */
  returnUrl: string;
  /**
   * Có hiện "Tiếp tục với Google" hay không.
   *
   * Quyết định ở server rồi truyền xuống, chứ không đọc biến `NEXT_PUBLIC_` tại chỗ: nút chỉ chạy
   * được khi realm Keycloak đã khai identity provider `google`, và một nút dẫn thẳng tới trang lỗi
   * còn tệ hơn là không có nút nào.
   */
  googleEnabled?: boolean;
}

/**
 * Modal đăng nhập / đăng ký.
 *
 * Không có ô mật khẩu, và đó là điểm chính: luồng chạy là Authorization Code + PKCE trong một
 * popup, nên mật khẩu chỉ được nhập trên tên miền của Keycloak với thanh địa chỉ hiện đầy đủ.
 * Trang đang xem không bị rời đi, nên khách đang chọn vé không mất chỗ.
 *
 * Dựng trên `<dialog>` thật thay vì một `<div>` có `position: fixed`: bẫy focus, phím Esc và
 * việc làm trơ phần nền đều do trình duyệt lo. Tự viết lại ba thứ đó là nguồn lỗi a11y kinh điển.
 */
export function AuthDialog({
  open,
  onClose,
  onAuthenticated,
  returnUrl,
  googleEnabled = false,
}: AuthDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const popupRef = useRef<Window | null>(null);
  const [pending, setPending] = useState<AuthMode | null>(null);

  // Mở/đóng theo prop, dùng API thật của <dialog>.
  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;

    if (open && !element.open) {
      if (typeof element.showModal === 'function') element.showModal();
      else element.open = true;
    } else if (!open && element.open) {
      if (typeof element.close === 'function') element.close();
      else element.open = false;
    }
  }, [open]);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };

    element.addEventListener('cancel', handleCancel);
    return () => element.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  const finish = useCallback(() => {
    // Bộ nhớ token của tab này còn giữ trạng thái "chưa đăng nhập" — xoá rồi hỏi lại,
    // nếu không header vẫn hiện nút Đăng nhập dù cookie phiên đã có.
    clearAccessToken();
    setPending(null);
    popupRef.current = null;
    onAuthenticated();
    onClose();
  }, [onAuthenticated, onClose]);

  // Popup báo về khi luồng OIDC xong.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Chỉ tin message từ chính origin của mình. Thiếu dòng này thì bất kỳ trang nào mở được
      // cửa sổ tới đây cũng giả được tín hiệu "đã đăng nhập".
      if (event.origin !== window.location.origin) return;
      if (event.data !== AUTH_POPUP_MESSAGE) return;
      finish();
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [finish]);

  // Người dùng đóng popup giữa chừng: bỏ trạng thái chờ, đừng để nút quay mãi.
  useEffect(() => {
    if (!pending) return;

    const timer = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(timer);
        popupRef.current = null;
        setPending(null);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [pending]);

  const start = (mode: AuthMode) => {
    setPending(mode);
    const popup = openAuthPopup(mode);

    if (!popup) {
      // Popup bị chặn — chạy đúng luồng đó trên cả trang thay vì im lặng không làm gì.
      redirectToAuth(mode, returnUrl);
      return;
    }

    popupRef.current = popup;
    popup.focus();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="auth-dialog-title"
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="w-[min(26rem,calc(100vw-2rem))] rounded-nt-lg border border-border bg-surface p-0 text-ink backdrop:bg-black/50"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
        <h2 id="auth-dialog-title" className="m-0 text-lg font-bold">
          Đăng nhập hoặc tạo tài khoản
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="-mr-2 grid size-11 cursor-pointer place-items-center rounded-nt border-0 bg-transparent text-2xl leading-none text-muted hover:bg-bg-subtle"
        >
          ×
        </button>
      </div>

      <div className="px-6 py-6">
        <p className="m-0 text-muted">
          Cửa sổ đăng nhập của NexaTicket sẽ mở ra để bạn nhập mật khẩu, rồi đóng lại — trang bạn
          đang xem vẫn giữ nguyên.
        </p>

        {googleEnabled ? (
          <div className="mt-6 grid gap-4">
            <GoogleButton
              type="button"
              onClick={() => start('google')}
              disabled={pending !== null}
              aria-busy={pending === 'google'}
            />
            {/* Kẻ ngang hai bên chữ bằng ::before/::after: một phần tử, không có <hr> rỗng nào
                lọt vào cây accessibility. */}
            <div className="flex items-center gap-3 text-[13px] text-muted before:h-px before:flex-1 before:bg-border before:content-[''] after:h-px after:flex-1 after:bg-border after:content-['']">
              hoặc
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={() => start('login')}
            disabled={pending !== null}
            aria-busy={pending === 'login'}
            className="flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-nt border-0 bg-primary px-6 text-[17px] font-semibold text-primary-ink hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-55"
          >
            {pending === 'login' ? <Spinner /> : null}
            Đăng nhập bằng email
          </button>

          <button
            type="button"
            onClick={() => start('register')}
            disabled={pending !== null}
            aria-busy={pending === 'register'}
            className="flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-nt border border-solid border-border bg-surface px-6 text-[17px] font-semibold text-ink hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-55"
          >
            {pending === 'register' ? <Spinner /> : null}
            Tạo tài khoản mới
          </button>
        </div>

        <p className="mt-6 mb-0 text-[13px] text-muted" aria-live="polite">
          {pending
            ? 'Đang chờ bạn hoàn tất ở cửa sổ vừa mở. Nếu không thấy, kiểm tra xem trình duyệt có chặn cửa sổ bật lên không.'
            : 'Chỉ nhập mật khẩu khi thanh địa chỉ của cửa sổ đó hiện đúng tên miền NexaTicket.'}
        </p>
      </div>
    </dialog>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
    />
  );
}
