'use client';

import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cx } from '../cx';
import { errorMessage, isKnownErrorCode, type ApiErrorLike } from '../errors';
import styles from './overlays.module.css';

export type ToastTone = 'info' | 'success' | 'danger';

export interface ToastInput {
  message: string;
  tone?: ToastTone;
  /** Mã lỗi backend, hiện ở dòng phụ (ui-direction.md §10). */
  code?: string | null;
  /** Nhãn nút hành động, ví dụ "Thử lại". */
  actionLabel?: string;
  onAction?: () => void;
  /** ms; 0 nghĩa là chỉ đóng khi người dùng bấm. */
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

interface ToastApi {
  show: (toast: ToastInput) => void;
  /** Đường tắt cho lỗi API: tự tra câu chữ tiếng Việt và gắn mã vào dòng phụ. */
  showError: (error: ApiErrorLike | null | undefined, options?: Partial<ToastInput>) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 5000;
const TONE_CLASS: Record<ToastTone, string | undefined> = {
  info: styles.toastInfo,
  success: styles.toastSuccess,
  danger: styles.toastDanger,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((toast: ToastInput) => {
    setToasts((current) => [...current, { ...toast, id: nextId.current++ }]);
  }, []);

  const showError = useCallback(
    (error: ApiErrorLike | null | undefined, options?: Partial<ToastInput>) => {
      show({
        message: errorMessage(error),
        tone: 'danger',
        code: isKnownErrorCode(error?.code) ? error?.code : null,
        ...options,
      });
    },
    [show],
  );

  const api = useMemo<ToastApi>(() => ({ show, showError, dismiss }), [show, showError, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.toastRegion} role="region" aria-label="Thông báo">
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const duration = toast.duration ?? DEFAULT_DURATION;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss, toast.id]);

  return (
    <div
      className={cx(styles.toast, TONE_CLASS[toast.tone ?? 'info'])}
      // Lỗi phải cắt ngang việc đang đọc; thông báo thường thì chờ tới lượt.
      role={toast.tone === 'danger' ? 'alert' : 'status'}
      aria-live={toast.tone === 'danger' ? 'assertive' : 'polite'}
    >
      <span className={styles.toastText}>
        <span className={styles.toastMessage}>{toast.message}</span>
        {toast.code ? <span className={styles.toastCode}>{toast.code}</span> : null}
      </span>
      {toast.actionLabel && toast.onAction ? (
        <button
          type="button"
          className={styles.toastAction}
          onClick={() => {
            toast.onAction?.();
            onDismiss(toast.id);
          }}
        >
          {toast.actionLabel}
        </button>
      ) : null}
      <button
        type="button"
        className={styles.toastAction}
        onClick={() => onDismiss(toast.id)}
        aria-label="Đóng thông báo"
      >
        ×
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast phải nằm trong <ToastProvider>');
  return api;
}
