'use client';

import { useCallback, useEffect, useRef } from 'react';

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Môi trường không có Web Crypto (Node cũ trong test): chỉ cần đủ duy nhất trong một phiên.
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export interface IdempotencyKeyHandle {
  /** Khoá hiện hành; sinh ở lần gọi đầu tiên và giữ nguyên cho mọi lần thử lại. */
  getKey: () => string;
  /** Gọi sau khi request thành công, hoặc khi người dùng đổi ý định. */
  reset: () => void;
}

/**
 * Khoá chống trùng cho một *ý định* của người dùng, không phải cho một request.
 *
 * Bấm "Giữ chỗ" rồi mạng chập chờn: lần thử lại phải mang đúng khoá cũ, nếu không backend coi đó
 * là ý định thứ hai và tạo hold thứ hai — khách tự ăn hết hạn mức của chính mình.
 *
 * Đổi lựa chọn (chọn thêm ghế, đổi số vé đứng) là một ý định khác, nên `deps` đổi thì khoá đổi.
 *
 * ```ts
 * const idem = useIdempotencyKey([sessionId, selectedSeatIds.join(','), standingSignature]);
 * placeHold.mutate({ idempotencyKey: idem.getKey() });
 * ```
 */
export function useIdempotencyKey(deps: ReadonlyArray<unknown> = []): IdempotencyKeyHandle {
  const keyRef = useRef<string | null>(null);
  const signature = JSON.stringify(deps);
  const signatureRef = useRef(signature);

  useEffect(() => {
    if (signatureRef.current !== signature) {
      signatureRef.current = signature;
      keyRef.current = null;
    }
  }, [signature]);

  // Đổi lựa chọn rồi bấm ngay trong cùng một lần render: đọc trực tiếp thay vì chờ effect chạy.
  const getKey = useCallback(() => {
    if (signatureRef.current !== signature) {
      signatureRef.current = signature;
      keyRef.current = null;
    }
    if (keyRef.current === null) keyRef.current = newIdempotencyKey();
    return keyRef.current;
  }, [signature]);

  const reset = useCallback(() => {
    keyRef.current = null;
  }, []);

  return { getKey, reset };
}
