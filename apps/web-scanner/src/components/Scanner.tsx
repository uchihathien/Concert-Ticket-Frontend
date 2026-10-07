'use client';

import {
  ApiError,
  scanTicketForOrganization,
  type CheckinResult,
  type ScanResponse,
} from '@nexaticket/ts-sdk';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { formatSessionDate } from './SessionPicker';
import { TopBar } from './TopBar';
import styles from './scanner.module.css';

/** Cùng câu chữ với app Scanner (apps/mobile-scanner/app/scan.tsx). */
const VERDICTS: Record<CheckinResult, { title: string; hint: string; accepted: boolean }> = {
  ACCEPTED: { title: 'MỜI VÀO', hint: 'Vé hợp lệ.', accepted: true },
  ALREADY_CHECKED_IN: {
    title: 'ĐÃ SOÁT RỒI',
    hint: 'Mã này đã được dùng để vào trước đó.',
    accepted: false,
  },
  REVOKED: { title: 'VÉ ĐÃ HUỶ', hint: 'Vé bị thu hồi hoặc đã hoàn tiền.', accepted: false },
  WRONG_SESSION: { title: 'SAI SUẤT DIỄN', hint: 'Vé thuộc một suất diễn khác.', accepted: false },
  INVALID_TOKEN: { title: 'MÃ KHÔNG HỢP LỆ', hint: 'Mã sai hoặc đã hết hạn.', accepted: false },
  NOT_FOUND: { title: 'KHÔNG TÌM THẤY VÉ', hint: 'Không có vé ứng với mã này.', accepted: false },
};

export interface ScannerProps {
  eventSessionId: string;
  organizationId: string;
  eventTitle: string;
  venueName: string;
  startsAt: string;
}

// `torch` là capability không chuẩn (Chrome Android) — chưa có trong kiểu DOM của TypeScript.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

/**
 * Màn soát vé — bản web của màn quét trong app Scanner.
 *
 * Giống app ở điểm quan trọng nhất: đang hiện kết quả thì DỪNG đọc mã cho tới khi nhân viên bấm
 * "QUÉT VÉ TIẾP THEO". Quét liên tục kiểu cũ làm kết quả của khách trước bị khách sau đè lên trước
 * khi nhân viên kịp đọc.
 */
export function Scanner({
  eventSessionId,
  organizationId,
  eventTitle,
  venueName,
  startsAt,
}: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const busy = useRef(false);
  const paused = useRef(false);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torch, setTorch] = useState(false);

  const submit = useCallback(
    async (qrToken: string) => {
      if (busy.current || paused.current || !qrToken) return;
      busy.current = true;
      paused.current = true;
      setChecking(true);
      try {
        const response = await scanTicketForOrganization(
          apiClient,
          organizationId,
          eventSessionId,
          {
            qrToken,
            deviceId: 'web-scanner',
          },
        );
        setResult(response);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setFailure('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.');
        } else if (error instanceof ApiError && error.status === 403) {
          setFailure('Tài khoản chưa được cấp quyền soát vé cho tổ chức này.');
        } else {
          setFailure('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
        }
      } finally {
        busy.current = false;
        setChecking(false);
      }
    },
    [organizationId, eventSessionId],
  );

  function scanNext() {
    setResult(null);
    setFailure(null);
    paused.current = false;
  }

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

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function start() {
      const Detector = (
        window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => unknown }
      ).BarcodeDetector;
      if (!Detector) {
        setCameraError('Trình duyệt này chưa hỗ trợ quét mã. Dùng ô dán mã bên dưới.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
      } catch {
        setCameraError('Không mở được camera. Cho phép quyền camera, hoặc dùng ô dán mã bên dưới.');
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

      // Đèn pin chỉ có ở một số trình duyệt (Chrome Android); không hỗ trợ thì không hiện nút.
      const track = stream.getVideoTracks()[0];
      trackRef.current = track ?? null;
      setTorchSupported(
        Boolean((track?.getCapabilities?.() as TorchCapabilities | undefined)?.torch),
      );

      const detector = new Detector({ formats: ['qr_code'] }) as {
        detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
      };
      timer = setInterval(async () => {
        if (!videoRef.current || busy.current || paused.current) return;
        let codes: Array<{ rawValue: string }> = [];
        try {
          codes = await detector.detect(videoRef.current);
        } catch {
          return;
        }
        const value = codes[0]?.rawValue;
        if (value) void submit(value);
      }, 250);
    }

    void start();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [submit]);

  async function toggleTorch() {
    const next = !torch;
    try {
      await trackRef.current?.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorch(next);
    } catch {
      setTorchSupported(false);
    }
  }

  const verdict = result ? VERDICTS[result.result] : null;

  return (
    <div className={styles.page}>
      <TopBar />
      <div className={styles.screen}>
        <header className={styles.header}>
          <Link href="/" className={styles.headerButton} aria-label="Đổi suất diễn">
            ‹
          </Link>
          <div className={styles.sessionInfo}>
            <p className={styles.eyebrow}>ĐANG SOÁT SUẤT</p>
            <p className={styles.session}>{eventTitle || eventSessionId}</p>
            {venueName ? (
              <p className={styles.sessionMeta}>
                {venueName}
                {startsAt ? ` · ${formatSessionDate(startsAt)}` : ''}
              </p>
            ) : null}
          </div>
          {torchSupported ? (
            <button
              type="button"
              className={styles.torchButton}
              aria-label={torch ? 'Tắt đèn pin' : 'Bật đèn pin'}
              onClick={() => void toggleTorch()}
            >
              {torch ? 'ĐÈN BẬT' : 'ĐÈN TẮT'}
            </button>
          ) : null}
        </header>

        {!online ? <p className={styles.offline}>Mất mạng — tạm dừng soát vé</p> : null}

        <div className={styles.cameraShell}>
          <video ref={videoRef} className={styles.video} muted playsInline />
          {cameraError ? (
            <div className={styles.permission}>
              <span className={styles.cameraSymbol} aria-hidden="true">
                ▦
              </span>
              <p className={styles.permissionTitle}>Không dùng được camera</p>
              <p className={styles.permissionCopy}>{cameraError}</p>
            </div>
          ) : !result && !failure ? (
            <div className={styles.reticleWrap} aria-hidden="true">
              <div className={styles.reticle} />
              <p className={styles.cameraHint}>
                {checking ? 'ĐANG KIỂM TRA VÉ...' : 'ĐƯA MÃ QR VÀO KHUNG'}
              </p>
            </div>
          ) : null}
        </div>

        {checking ? (
          <div className={styles.busyRow} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            Đang xác thực với máy chủ
          </div>
        ) : null}

        {result && verdict ? (
          <div
            className={`${styles.resultPanel} ${verdict.accepted ? styles.accepted : styles.rejected}`}
            role="alert"
          >
            <p
              className={`${styles.verdict} ${verdict.accepted ? styles.acceptedText : styles.rejectedText}`}
            >
              {verdict.title}
            </p>
            {result.seatLabel || result.seatCode ? (
              <p className={styles.ticketInfo}>
                {result.seatLabel ?? result.seatCode}
                {result.ticketTypeName ? ` · ${result.ticketTypeName}` : ''}
              </p>
            ) : null}
            <p className={styles.resultHint}>{result.note ?? verdict.hint}</p>
            <button type="button" className={styles.actionButton} onClick={scanNext} autoFocus>
              QUÉT VÉ TIẾP THEO
            </button>
          </div>
        ) : null}

        {failure ? (
          <div className={`${styles.resultPanel} ${styles.rejected}`} role="alert">
            <p className={`${styles.verdict} ${styles.rejectedText}`}>KHÔNG GỬI ĐƯỢC</p>
            <p className={styles.resultHint}>{failure}</p>
            <button type="button" className={styles.actionButton} onClick={scanNext} autoFocus>
              THỬ LẠI
            </button>
          </div>
        ) : null}

        {/* Dự phòng riêng của web: trình duyệt không đọc được QR thì dán mã (từ máy quét cầm tay). */}
        {!result && !failure ? (
          <form
            className={styles.manual}
            action={(formData: FormData) => {
              const value = String(formData.get('qrToken') ?? '').trim();
              if (value && online) void submit(value);
            }}
          >
            <input
              className={styles.manualInput}
              name="qrToken"
              placeholder="Dán mã vé"
              aria-label="Dán mã vé"
              autoComplete="off"
            />
            <button type="submit" className={styles.manualButton} disabled={!online || checking}>
              SOÁT
            </button>
          </form>
        ) : null}

        {!result && !failure ? (
          <footer className={styles.footer}>
            <p className={styles.footerTitle}>CHỈ CHẤP NHẬN VÉ ĐÃ THANH TOÁN</p>
            <p className={styles.footerCopy}>
              Máy chủ xác thực mã và trạng thái check-in. Không quét lại cùng một vé.
            </p>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
