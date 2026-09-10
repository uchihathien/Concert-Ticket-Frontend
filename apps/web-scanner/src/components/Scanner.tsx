'use client';

import { ApiError, useScanTicket, type CheckinResult, type ScanResponse } from '@nexaticket/ts-sdk';
import { Button } from '@nexaticket/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './scanner.module.css';

/** Câu chữ cho từng kết quả. Nhân viên ở cửa cần biết *nói gì với khách*, không cần mã lỗi. */
const VERDICTS: Record<CheckinResult, { title: string; hint: string; accepted: boolean }> = {
  ACCEPTED: { title: 'MỜI VÀO', hint: 'Vé hợp lệ.', accepted: true },
  ALREADY_CHECKED_IN: {
    title: 'ĐÃ SOÁT RỒI',
    hint: 'Mã này đã được dùng để vào trước đó.',
    accepted: false,
  },
  REVOKED: { title: 'VÉ ĐÃ HUỶ', hint: 'Vé bị thu hồi hoặc đã hoàn tiền.', accepted: false },
  WRONG_SESSION: { title: 'SAI SUẤT', hint: 'Vé của suất diễn khác.', accepted: false },
  INVALID_TOKEN: { title: 'MÃ KHÔNG HỢP LỆ', hint: 'Mã sai hoặc đã hết hạn.', accepted: false },
  NOT_FOUND: { title: 'KHÔNG TÌM THẤY', hint: 'Không có vé nào ứng với mã này.', accepted: false },
};

/** Khoảng nghỉ sau mỗi lần quét, để camera không bắn cùng một mã hàng chục lần mỗi giây. */
const COOLDOWN_MS = 1500;

export interface ScannerProps {
  eventSessionId: string;
}

export function Scanner({ eventSessionId }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scan = useScanTicket(eventSessionId);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // Mã vừa xử lý + thời điểm, để bỏ qua các lần đọc lặp. `ref` chứ không phải state: vòng lặp
  // nhận diện chạy ngoài React và cần giá trị mới nhất ngay lập tức.
  const lastCode = useRef<{ value: string; at: number } | null>(null);
  const busy = useRef(false);

  const submit = useCallback(
    (qrToken: string) => {
      if (busy.current) return;
      busy.current = true;
      setFailure(null);

      scan.mutate(
        { qrToken },
        {
          onSuccess: (response) => setResult(response),
          // Vé sai KHÔNG vào nhánh này — backend luôn trả 200. Ở đây chỉ có mạng hỏng hoặc
          // phiên hết hạn, và hai thứ đó cần cách nói khác hẳn.
          onError: (error) =>
            setFailure(
              error instanceof ApiError && error.isAuthError
                ? 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục soát vé.'
                : 'Không gửi được lên máy chủ. Kiểm tra mạng rồi quét lại.',
            ),
          onSettled: () => {
            busy.current = false;
          },
        },
      );
    },
    [scan],
  );

  // Trạng thái mạng: mất mạng thì dừng gửi thay vì để nhân viên quét vào hư không.
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Camera + vòng lặp nhận diện.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function start() {
      const Detector = (
        window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => unknown }
      ).BarcodeDetector;

      if (!Detector) {
        // Safari trên iOS chưa có BarcodeDetector. Plan §11 chốt dùng zxing-wasm làm bản dự
        // phòng; chưa thêm ở đây vì nó là một dependency ~300KB và app này có ngân sách 150KB —
        // cần đo trước khi nhận. Tới lúc đó, ô nhập tay bên dưới vẫn giữ cho cửa chạy được.
        setCameraError('Trình duyệt này chưa hỗ trợ quét mã. Dùng ô nhập tay bên dưới.');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
      } catch {
        setCameraError('Không mở được camera. Cho phép quyền camera, hoặc dùng ô nhập tay.');
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const detector = new Detector({ formats: ['qr_code'] }) as {
        detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
      };

      timer = setInterval(async () => {
        if (!videoRef.current || busy.current) return;

        let codes: Array<{ rawValue: string }> = [];
        try {
          codes = await detector.detect(videoRef.current);
        } catch {
          return; // Khung hình lỗi thì bỏ qua, khung sau vẫn tới.
        }

        const value = codes[0]?.rawValue;
        if (!value) return;

        const previous = lastCode.current;
        if (previous && previous.value === value && Date.now() - previous.at < COOLDOWN_MS) return;

        lastCode.current = { value, at: Date.now() };
        submit(value);
      }, 250);
    }

    void start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [submit]);

  const verdict = result ? VERDICTS[result.result] : null;

  return (
    <div className={styles.screen}>
      <div className={styles.bar}>
        <span className={styles.session}>Suất: {eventSessionId}</span>
        <Link href="/">Đổi suất</Link>
      </div>

      {!online ? <p className={styles.offline}>Mất mạng — tạm dừng soát vé</p> : null}

      <div className={styles.viewport}>
        <video ref={videoRef} className={styles.video} muted playsInline />
        <div className={styles.reticle} aria-hidden="true" />
        <p className={styles.hint}>{cameraError ?? failure ?? 'Đưa mã QR vào giữa khung'}</p>
      </div>

      <form
        className={styles.manual}
        action={(formData: FormData) => {
          const value = String(formData.get('qrToken') ?? '').trim();
          if (value && online) submit(value);
        }}
      >
        <input
          className={styles.manualInput}
          name="qrToken"
          placeholder="Dán mã vé"
          aria-label="Dán mã vé"
          autoComplete="off"
        />
        <Button type="submit" size="lg" disabled={!online} loading={scan.isPending}>
          Soát
        </Button>
      </form>

      {result && verdict ? (
        <div
          className={`${styles.result} ${verdict.accepted ? styles.resultAccepted : styles.resultRejected}`}
          role="alert"
        >
          <p className={styles.resultVerdict}>{verdict.title}</p>
          {result.seatLabel || result.seatCode ? (
            <p className={styles.resultSeat}>
              {result.seatLabel ?? result.seatCode}
              {result.ticketTypeName ? ` · ${result.ticketTypeName}` : ''}
            </p>
          ) : null}
          <p className={styles.resultNote}>{result.note ?? verdict.hint}</p>
          <button
            type="button"
            className={styles.resultDismiss}
            onClick={() => setResult(null)}
            autoFocus
          >
            Quét tiếp
          </button>
        </div>
      ) : null}
    </div>
  );
}
