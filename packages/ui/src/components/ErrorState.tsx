import type { ReactNode } from 'react';
import { cx } from '../cx';
import { errorCopy, errorMessage, isKnownErrorCode, type ApiErrorLike } from '../errors';
import { Button } from './Button';
import styles from './feedback.module.css';

export interface ErrorStateProps {
  error: ApiErrorLike | null | undefined;
  /** Có hàm này và lỗi thuộc loại thử lại được thì hiện nút "Thử lại". */
  onRetry?: () => void;
  /**
   * `correlationId` từ `ApiError`. Hiện ra để người dùng đọc cho tổng đài — đây là thứ duy nhất
   * nối một màn hình lỗi với log phía server.
   */
  correlationId?: string | null;
  /**
   * Lối đi tiếp khi "Thử lại" không phải câu trả lời.
   *
   * Có những lỗi mà thử lại chắc chắn hỏng — phiên hết hạn là ví dụ rõ nhất: bấm bao nhiêu lần
   * cũng vậy, thứ cần là một đường đăng nhập lại. Không có chỗ này thì màn lỗi là ngõ cụt.
   *
   * Nhận `ReactNode` chứ không nhận `href`: `packages/ui` dùng chung cho bốn app, mỗi app một
   * bộ đường dẫn riêng, nên nó không được biết `/login` nằm ở đâu.
   */
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ error, onRetry, correlationId, action, className }: ErrorStateProps) {
  const copy = errorCopy(error?.code);

  return (
    <div className={cx(styles.state, className)} role="alert">
      <h3 className={styles.stateTitle}>{errorMessage(error)}</h3>
      {isKnownErrorCode(error?.code) ? (
        <span className={styles.stateCode}>{error?.code}</span>
      ) : null}
      {correlationId ? <span className={styles.stateCode}>Mã tra cứu: {correlationId}</span> : null}
      {onRetry && copy.retryable ? (
        <Button variant="secondary" onClick={onRetry}>
          Thử lại
        </Button>
      ) : null}
      {action}
    </div>
  );
}
