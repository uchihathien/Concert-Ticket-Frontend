'use client';

import QRCode from 'qrcode';
import { useId, useRef } from 'react';
import { cx } from '../cx';
import styles from './ticket-poster.module.css';

export interface TicketPosterProps {
  eventTitle: string;
  /** Đã định dạng sẵn theo múi giờ và ngôn ngữ của người xem. */
  sessionAt: string;
  venueLine: string | null;
  zoneCode: string;
  seatLabel: string | null;
  ticketTypeName: string;
  /** Tên người mua. Bỏ trống thì phần này biến mất hẳn thay vì hiện một ô rỗng. */
  holderName?: string | null;
  /** Mã vé rút gọn để đối chiếu bằng mắt. */
  ticketCode: string;
  /** Chuỗi JWS đã ký. Đây là thứ duy nhất máy quét đọc. */
  qrToken: string;
  className?: string;
}

/** Khổ poster, đơn vị của SVG. Tỷ lệ 2:3 — khổ ảnh dọc quen thuộc của mạng xã hội. */
const WIDTH = 800;
const HEIGHT = 1200;

/** Cạnh mã QR trong poster. Đủ lớn để quét được từ ảnh chụp màn hình của người khác. */
const QR_SIZE = 420;

/**
 * Kiểu chữ viết thẳng vào thuộc tính SVG, KHÔNG qua CSS module.
 *
 * <p>Đây là điều kiện để phần xuất ảnh chạy được. Poster được xuất bằng cách tuần tự hoá chính
 * thẻ {@code <svg>} này rồi vẽ lên canvas — và chuỗi ấy đi một mình, không mang theo stylesheet
 * nào. Mọi kiểu đặt bằng class sẽ biến mất khỏi file PNG, để lại chữ đen 16px trên nền tối.
 *
 * <p>Font phải có phương án dự phòng thật: máy của người xem không chắc có "Be Vietnam Pro", và
 * một font thiếu sẽ làm dấu tiếng Việt vỡ trong ảnh xuất ra.
 */
const FONT = "'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif";

const INK = '#f5f1ef';
const MUTED = '#a89e99';

/**
 * Vé dạng ảnh: thông tin người đọc được, cộng mã QR máy đọc được.
 *
 * <h3>Mã QR vẫn chỉ có hai trường</h3>
 *
 * <p>Poster này in tên khách, khu, ghế và tên sự kiện ra <b>bằng chữ</b>. Mã QR thì không đổi —
 * nó vẫn chỉ mang {@code jti} và {@code exp} (xem {@code QrToken} ở backend). Phân biệt ấy là cả
 * điểm của thiết kế: ảnh vé bị đăng lên mạng xã hội là chuyện xảy ra hàng ngày, và mọi mã QR đều
 * giải ra được bằng một cái điện thoại. Chữ in trên ảnh thì người đăng nhìn thấy và tự quyết định
 * che đi; dữ liệu giấu trong mã thì không.
 *
 * <p>Nhãn ghế hiện trên máy soát vé là do <b>server trả về</b> sau khi đã kiểm quyền nhân viên,
 * nên nhét chúng vào mã cũng không làm cửa vào nhanh hơn một giây nào.
 *
 * <h3>Vì sao dựng ở client</h3>
 *
 * <p>Cùng lý do màn hình quản trị không có endpoint xuất file: chỗ này biết ngôn ngữ, múi giờ và
 * định dạng ngày mà người dùng đang xem, còn backend thì không. Thêm một đường sinh ảnh ở server
 * là thêm một chỗ để ngày tháng hiện sai định dạng.
 */
export function TicketPoster({
  eventTitle,
  sessionAt,
  venueLine,
  zoneCode,
  seatLabel,
  ticketTypeName,
  holderName,
  ticketCode,
  qrToken,
  className,
}: TicketPosterProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const titleId = useId();

  const titleLines = wrap(eventTitle, 22).slice(0, 3);
  const qr = qrPath(qrToken);

  return (
    <figure className={cx(styles.wrap, className)}>
      <svg
        ref={svgRef}
        className={styles.poster}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby={titleId}
        xmlns="http://www.w3.org/2000/svg"
      >
        <title id={titleId}>{`Vé ${eventTitle} — ${zoneCode}${seatLabel ? ` ghế ${seatLabel}` : ''}`}</title>

        <rect width={WIDTH} height={HEIGHT} fill="#171211" />
        <rect x={0} y={0} width={WIDTH} height={10} fill="#c02a2a" />

        <text
          x={56}
          y={88}
          fontFamily={FONT}
          fontSize={30}
          fontWeight={800}
          letterSpacing={6}
          fill="#f2b705"
        >
          NEXATICKET
        </text>

        {titleLines.map((line, index) => (
          <text key={line} x={56} y={188 + index * 62} fontFamily={FONT} fontSize={54} fontWeight={700} fill={INK}>
            {line}
          </text>
        ))}

        <text
          x={56}
          y={188 + titleLines.length * 62 + 14}
          fontFamily={FONT}
          fontSize={28}
          fill={MUTED}
        >
          {sessionAt}
        </text>
        {venueLine ? (
          <text
            x={56}
            y={188 + titleLines.length * 62 + 56}
            fontFamily={FONT}
            fontSize={28}
            fill={MUTED}
          >
            {venueLine}
          </text>
        ) : null}

        {/*
          Nền trắng dưới mã là BẮT BUỘC, kể cả trên poster nền tối: máy quét cần tương phản đúng
          chiều, và mã tối trên nền tối thì không đọc được. Cùng lý do với QrCode.
        */}
        <rect
          x={(WIDTH - QR_SIZE - 48) / 2}
          y={560}
          width={QR_SIZE + 48}
          height={QR_SIZE + 48}
          rx={24}
          fill="#ffffff"
        />
        <g transform={qrTransform(qr.total)}>
          <path d={qr.path} fill="#000000" shapeRendering="crispEdges" />
        </g>

        <Field x={56} y={1074} label="KHU" value={zoneCode} />
        <Field x={286} y={1074} label="CHỖ" value={seatLabel ?? 'Tự do'} />
        <Field x={516} y={1074} label="HẠNG VÉ" value={ticketTypeName} />

        {holderName ? (
          <text x={56} y={1150} fontFamily={FONT} fontSize={26} fill={MUTED}>
            {holderName}
          </text>
        ) : null}
        <text
          x={WIDTH - 56}
          y={1150}
          fontFamily="ui-monospace, 'Cascadia Mono', monospace"
          fontSize={26}
          fill={MUTED}
          textAnchor="end"
        >
          {ticketCode}
        </text>
      </svg>

      <figcaption className={styles.caption}>
        <button
          type="button"
          className={styles.download}
          onClick={() => downloadPoster(svgRef.current, `${slug(eventTitle)}-${ticketCode}.png`)}
        >
          Tải ảnh vé
        </button>
        <span className={styles.note}>
          Mã QR chỉ dùng được cho chính bạn — đừng chia sẻ ảnh này công khai.
        </span>
      </figcaption>
    </figure>
  );
}

function Field({ x, y, label, value }: { x: number; y: number; label: string; value: string }) {
  return (
    <>
      <text x={x} y={y} fontFamily={FONT} fontSize={20} fontWeight={600} letterSpacing={3} fill={MUTED}>
        {label}
      </text>
      <text x={x} y={y + 40} fontFamily={FONT} fontSize={36} fontWeight={700} fill={INK}>
        {truncate(value, 14)}
      </text>
    </>
  );
}

/**
 * Gộp mọi ô tối của mã vào MỘT path.
 *
 * Mã 45×45 có hơn hai nghìn ô; hai nghìn phần tử cho một hình tĩnh làm trang giật khi cuộn trên
 * điện thoại. Cùng cách làm với {@code QrCode}.
 */
function qrPath(value: string): { path: string; total: number } {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const count = qr.modules.size;
  const data = qr.modules.data;
  // Viền trắng 4 ô theo chuẩn QR. Thiếu nó nhiều máy quét không tìm ra mốc định vị.
  const quiet = 4;

  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (data[row * count + column]) {
        path += `M${column + quiet} ${row + quiet}h1v1h-1z`;
      }
    }
  }
  return { path, total: count + quiet * 2 };
}

/** Mã QR đo bằng "ô", poster đo bằng đơn vị SVG — một phép co giãn đưa cái này vào cái kia. */
function qrTransform(total: number): string {
  const scale = QR_SIZE / total;
  return `translate(${(WIDTH - QR_SIZE) / 2} ${584}) scale(${scale})`;
}

/**
 * Xuống dòng thủ công: SVG không có ngắt dòng tự động.
 *
 * Ngắt theo TỪ, và một từ dài hơn cả dòng thì để nó tràn thay vì cắt giữa chừng — tên sự kiện cắt
 * giữa từ đọc như lỗi hiển thị.
 */
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let current = '';

  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}…`;
}

function slug(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 've'
  );
}

/**
 * Xuất poster thành PNG.
 *
 * <p>Đi qua {@code <canvas>} chứ không tải thẳng file SVG: ứng dụng nhắn tin và mạng xã hội phần
 * lớn không hiển thị SVG, và một cái vé không mở được ở nơi người ta định gửi nó là một cái vé vô
 * dụng.
 *
 * <p>Nhân đôi độ phân giải khi vẽ: 1600×2400 đủ nét để in ra giấy, và mã QR càng nhiều điểm ảnh
 * thì máy quét càng dễ đọc trong điều kiện thiếu sáng ở cửa vào.
 *
 * <p>Ảnh được nạp qua data-URI của chính chuỗi SVG. Điều đó bắt buộc: một {@code blob:} URL sẽ làm
 * canvas bị đánh dấu "nhiễm bẩn" trên vài trình duyệt và {@code toBlob} ném lỗi bảo mật.
 */
export function downloadPoster(svg: SVGSVGElement | null, filename: string): void {
  if (!svg || typeof window === 'undefined') return;

  const markup = new XMLSerializer().serializeToString(svg);
  const image = new Image();

  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH * 2;
    canvas.height = HEIGHT * 2;

    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      // Thu hồi ngay sau khi bấm: giữ lại thì blob nằm trong bộ nhớ cho tới khi tải lại trang, và
      // một ví vé ba mươi vé là ba mươi ảnh PNG không ai dọn.
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}
