'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { SupportChat } from './SupportChat';
import styles from './support-launcher.module.css';

/**
 * Nút chat nổi, có ở mọi trang công khai.
 *
 * <h3>Vì sao cần nó khi đã có trang /support</h3>
 *
 * Khung chat vốn chỉ sống ở `/support`, và đường duy nhất tới đó là một liên kết trong **footer**.
 * Nghĩa là một người đang bí ở giữa luồng chọn ghế phải cuộn xuống hết trang, đọc bốn cột liên kết,
 * rồi rời khỏi trang mình đang làm dở để hỏi được một câu. Thực tế điều đó tương đương với không có
 * chat: người ta bỏ đi trước khi tìm thấy nó.
 *
 * <h3>Không hiện trên chính trang /support</h3>
 *
 * Trang đó đã có khung chat. Dựng thêm một bản thứ hai ở đây thì hai bản cùng đọc một khoá
 * `sessionStorage` nhưng giữ hai state React riêng — gõ ở bản này, bản kia không thấy, và khách
 * không có cách nào hiểu tại sao.
 */
export function SupportLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Đóng bằng Escape — người dùng bàn phím không có cách nào khác để thoát một lớp nổi.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Chuyển focus vào khung khi mở: nếu không, người dùng bàn phím bấm nút xong vẫn đứng ngoài và
  // phải Tab qua cả trang mới tới được ô nhập.
  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    }
  }, [open]);

  // Đổi trang thì đóng lại. Giữ nó mở qua các lần điều hướng nghe như tiện, nhưng một lớp nổi che
  // góc phải trong lúc người dùng đang đọc một trang khác là thứ họ phải tắt đi thay vì thứ giúp họ.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (pathname === '/support') {
    return null;
  }

  return (
    <>
      {open ? (
        <div
          className={styles.panel}
          id={panelId}
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="false"
          aria-label="Chat với bộ phận hỗ trợ"
        >
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Hỗ trợ khách hàng</h2>
            <button
              type="button"
              className={styles.close}
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
              aria-label="Đóng khung chat"
            >
              <CloseIcon />
            </button>
          </div>

          <div className={styles.panelBody}>
            <SupportChat />
          </div>
        </div>
      ) : null}

      {/*
        `aria-expanded` chứ không chỉ đổi nhãn: người dùng trình đọc màn hình cần biết nút này mở ra
        một lớp nội dung, và lớp ấy hiện đang mở hay đóng.
      */}
      <button
        type="button"
        ref={buttonRef}
        className={styles.launcher}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
        <span className={styles.launcherLabel}>Hỗ trợ</span>
      </button>
    </>
  );
}

/*
 * SVG nội tuyến, KHÔNG thêm thư viện icon.
 *
 * web-customer cố ý không có bộ icon nào — thanh điều hướng dưới dùng chữ thuần. Kéo `lucide-react`
 * vào chỉ vì hai hình này là thêm một phụ thuộc phải nâng cấp, cho một trang mà mọi kilobyte đều
 * nằm trên đường tải đầu tiên của khách.
 *
 * `aria-hidden` ở cả hai: nút đã có chữ hoặc `aria-label`, nên hình chỉ là trang trí. Không ẩn thì
 * trình đọc màn hình đọc nhãn hai lần.
 */
function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
