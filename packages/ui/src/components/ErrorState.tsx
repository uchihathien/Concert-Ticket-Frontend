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
  className?: string;
}

export function ErrorState({ error, onRetry, correlationId, className }: ErrorStateProps) {
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
    </div>
  );
}
