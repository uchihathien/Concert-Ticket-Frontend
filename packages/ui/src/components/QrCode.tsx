import QRCode from 'qrcode';

export interface QrCodeProps {
  /** Chuỗi cần mã hoá: JWS của vé, hoặc payload EMVCo của VietQR. */
  value: string;
  /** Cạnh của mã, tính bằng pixel CSS. */
  size?: number;
  /**
   * Mô tả cho trình đọc màn hình.
   *
   * Không đọc nội dung mã ra: chuỗi JWS dài vài trăm ký tự, đọc lên là vô nghĩa và làm người
   * dùng trình đọc màn hình phải ngồi nghe hết. Hãy mô tả *mã này để làm gì*.
   */
  label: string;
  className?: string;
}

/**
 * Mã QR, dựng thành SVG ngay trong lúc render.
 *
 * Dùng `QRCode.create` (đồng bộ) rồi tự vẽ chứ không dùng `toDataURL` (bất đồng bộ): vẽ đồng bộ
 * thì mã có mặt ngay ở lần render đầu, chạy được cả ở server component, và không có nhịp nào mã
 * bị trống. Ảnh PNG dạng data-URI cũng vỡ khi phóng to, còn SVG thì không — khách hay phóng to
 * mã ở cửa vào khi máy quét đọc không ra.
 *
 * Mức sửa lỗi M (~15%): mã vé bị ngón tay che một góc hoặc màn hình xước vẫn đọc được, mà chưa
 * làm mã dày thêm quá nhiều so với mức L.
 *
 * Nền trắng là **bắt buộc**, kể cả trên giao diện nền tối: máy quét cần tương phản sáng/tối đúng
 * chiều, mã tối trên nền tối thì không đọc được.
 */
export function QrCode({ value, size = 220, label, className }: QrCodeProps) {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const count = qr.modules.size;
  const data = qr.modules.data;

  // Viền trắng 4 ô theo chuẩn QR. Thiếu nó nhiều máy quét không tìm ra được mốc định vị.
  const quiet = 4;
  const total = count + quiet * 2;

  // Gộp tất cả ô tối vào MỘT path thay vì mỗi ô một <rect>: mã 45×45 có hơn hai nghìn ô, và hai
  // nghìn phần tử DOM cho một hình tĩnh làm trang giật khi cuộn trên điện thoại.
  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (data[row * count + column]) {
        path += `M${column + quiet} ${row + quiet}h1v1h-1z`;
      }
    }
  }

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={total} height={total} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
