'use client';

import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { cx } from '../cx';
import styles from './overlays.module.css';

interface BaseDialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Modal hệ quả nặng (huỷ đơn, chi tiền) không cho đóng bằng Esc hay bấm ra ngoài. */
  dismissible?: boolean;
  className?: string;
}

function useNativeDialog(open: boolean, onClose: () => void, dismissible: boolean) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // `showModal` vắng mặt ở jsdom cũ; rơi về thuộc tính `open` để test không phải mock DOM.
    if (open && !element.open) {
      if (typeof element.showModal === 'function') element.showModal();
      else element.open = true;
    } else if (!open && element.open) {
      if (typeof element.close === 'function') element.close();
      else element.open = false;
    }
  }, [open]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleCancel = (event: Event) => {
      // `cancel` là phím Esc. Chặn ở đây thay vì bắt keydown toàn cục.
      if (!dismissible) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      onClose();
    };

    element.addEventListener('cancel', handleCancel);
    return () => element.removeEventListener('cancel', handleCancel);
  }, [dismissible, onClose]);

  return ref;
}

function DialogShell({
  open,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
  className,
  variantClass,
}: BaseDialogProps & { variantClass: string | undefined }) {
  const ref = useNativeDialog(open, onClose, dismissible);
  const titleId = useId();

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cx(styles.dialog, variantClass, className)}
      onClick={(event) => {
        // Bấm vào nền (chính phần tử <dialog>, không phải nội dung bên trong) thì đóng.
        if (dismissible && event.target === ref.current) onClose();
      }}
    >
      <div className={styles.header}>
        <h2 className={styles.title} id={titleId}>
          {title}
        </h2>
        {dismissible ? (
          <button type="button" className={styles.close} onClick={onClose} aria-label="Đóng">
            ×
          </button>
        ) : null}
      </div>
      <div className={styles.body}>{children}</div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </dialog>
  );
}

export type ModalProps = BaseDialogProps;

export function Modal(props: ModalProps) {
  return <DialogShell {...props} variantClass={styles.modal} />;
}

export type DrawerProps = BaseDialogProps;

/** Ngăn kéo trượt từ cạnh phải — dùng cho bộ lọc và form phụ ở web-admin / web-platform. */
export function Drawer(props: DrawerProps) {
  return <DialogShell {...props} variantClass={styles.drawer} />;
}
