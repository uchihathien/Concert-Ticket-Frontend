import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './qr-panel.module.css';
import { QrCode } from './QrCode';

export interface QrPanelProps {
  /** Chuỗi máy quét đọc. Với vé là JWS đã ký; với thanh toán là chuỗi EMVCo của VietQR. */
  value: string;
  /** Mô tả cho trình đọc màn hình. */
  label: string;
  /** Dòng chữ trên khung. */
  title: string;
  /** Dòng hướng dẫn dưới mã. */
  caption?: ReactNode;
  /**
   * `ticket` cho mã vào cửa, `payment` cho mã chuyển khoản.
   *
   * Hai thứ này trông giống nhau nhưng dùng ở hai hoàn cảnh khác hẳn, và nhầm lẫn giữa chúng có
   * hậu quả thật: quét mã vé bằng app ngân hàng thì không có gì xảy ra, còn đưa mã VietQR cho
   * nhân viên soát vé thì cũng vậy. Màu và nhãn khác nhau là cách rẻ nhất để không ai nhầm.
   */
  variant?: 'ticket' | 'payment';
  /** Cạnh mã, tính bằng pixel. */
  size?: number;
  /** Thông tin phụ đặt cạnh tiêu đề — mã vé rút gọn chẳng hạn. */
  meta?: ReactNode;
  className?: string;
}

/**
 * Mã QR đặt trong một khung có chủ đích.
 *
 * <h3>Vì sao không hiện mã trần</h3>
 *
 * <p>Một lưới ô vuông đen trắng thả giữa trang không cho người xem biết đó là mã gì, quét bằng
 * cái gì, và có đúng cái mình cần không. Bốn chỗ trong app khách đang hiện QR, và hai trong số đó
 * là hai LOẠI mã khác nhau — mã vào cửa và mã chuyển khoản. Nhìn thì y hệt nhau.
 *
 * <p>Khung này trả lời sẵn cả ba câu hỏi: dải màu thương hiệu nói đây là mã của hệ thống nào, tiêu
 * đề nói đây là mã gì, dòng chú thích nói quét bằng cái gì.
 *
 * <h3>Trang trí dừng ở rìa vùng yên tĩnh</h3>
 *
 * <p>Đây là ràng buộc không được vi phạm vì thẩm mỹ. Chuẩn QR đòi một vùng trắng bao quanh mã —
 * {@link QrCode} đã chừa 4 ô — và máy quét dùng nó để tìm ra ba mốc định vị. Đặt màu, gradient hay
 * hoạ tiết đè lên vùng ấy thì mã <b>vẫn trông đẹp và không quét được</b>, một kiểu hỏng chỉ lộ ra
 * ở cửa soát vé khi hàng người đang đứng chờ.
 *
 * <p>Nên mọi trang trí nằm <b>ngoài</b> tấm nền trắng: dải màu ở mép khung, bốn dấu góc ở viền
 * tấm nền, chữ ở trên và dưới. Bên trong tấm nền chỉ có mã và vùng trắng của nó.
 */
export function QrPanel({
  value,
  label,
  title,
  caption,
  variant = 'ticket',
  size = 220,
  meta,
  className,
}: QrPanelProps) {
  return (
    <figure className={cx(styles.panel, styles[variant], className)}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </div>

      <div className={styles.plate}>
        {/* Bốn dấu góc nằm trên viền tấm nền, không đè vào vùng yên tĩnh của mã. */}
        <span className={cx(styles.corner, styles.tl)} aria-hidden="true" />
        <span className={cx(styles.corner, styles.tr)} aria-hidden="true" />
        <span className={cx(styles.corner, styles.bl)} aria-hidden="true" />
        <span className={cx(styles.corner, styles.br)} aria-hidden="true" />
        <QrCode value={value} size={size} label={label} />
      </div>

      {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
    </figure>
  );
}
