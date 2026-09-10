'use client';

import { ApiError } from '@nexaticket/ts-sdk';
import { ErrorState } from '@nexaticket/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './wallet.module.css';

export interface ApiErrorStateProps {
  /** Lỗi thô từ TanStack Query. TanStack chỉ hứa `Error`, nên việc thu hẹp kiểu nằm ở đây. */
  error: unknown;
  onRetry?: () => void;
}

/** Mã lỗi nghĩa là "phiên không còn dùng được" — thử lại bao nhiêu lần cũng vậy. */
const AUTH_CODES = new Set(['UNAUTHENTICATED', 'SESSION_EXPIRED']);

/**
 * Màn lỗi cho mọi lời gọi API ở app khách.
 *
 * Gom hai việc từng lặp ở bốn chỗ:
 *
 * 1. **Thu hẹp kiểu.** `ErrorState` cần `code`/`meta` của RFC 7807, còn TanStack Query chỉ hứa
 *    `Error`. Bốn màn đều tự viết `error instanceof ApiError ? error : null` — bốn cơ hội để một
 *    chỗ quên và im lặng mất `correlationId`.
 *
 * 2. **Lối thoát khi phiên chết.** `UNAUTHENTICATED` không phải lỗi thử-lại-được, nên `ErrorState`
 *    không hiện nút nào — màn hình thành ngõ cụt: header vẫn nói "Tài khoản" (nó dựng ở server
 *    trước khi phiên chết) trong khi thân trang nói phiên hết hạn, và không có gì để bấm.
 *
 *    Xảy ra thật, không hiếm: refresh token hết hạn, phiên bị thu hồi, hoặc ở dev là mỗi lần
 *    dev server nạp lại module vì store token nằm trong bộ nhớ tiến trình.
 *
 * `returnUrl` lấy từ đường dẫn hiện tại để đăng nhập xong quay lại đúng chỗ đang dở.
 */
export function ApiErrorState({ error, onRetry }: ApiErrorStateProps) {
  const pathname = usePathname();
  const apiError = error instanceof ApiError ? error : null;
  const needsSignIn = apiError !== null && AUTH_CODES.has(apiError.code ?? '');

  return (
    <ErrorState
      error={apiError}
      correlationId={apiError?.correlationId ?? null}
      onRetry={onRetry}
      action={
        needsSignIn ? (
          <Link
            className={styles.emptyLink}
            href={`/login?returnUrl=${encodeURIComponent(pathname)}`}
          >
            Đăng nhập lại
          </Link>
        ) : null
      }
    />
  );
}
