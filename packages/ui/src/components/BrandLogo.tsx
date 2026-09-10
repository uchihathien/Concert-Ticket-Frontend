import logoDark from '@nexaticket/brand/logo-dark.png';
import logoFull from '@nexaticket/brand/logo-full.png';
import logoLight from '@nexaticket/brand/logo.png';
import logoMark from '@nexaticket/brand/logo-mark.png';
import Image from 'next/image';

export type BrandLogoVariant = 'lockup' | 'lockup-on-light' | 'full' | 'mark';

export interface BrandLogoProps {
  /**
   * `lockup` (mặc định) = biểu tượng + chữ NEXATICKET **cho nền tối**, không có tagline.
   * `lockup-on-light` = cùng bố cục nhưng chữ màu gốc, dành cho nền sáng (in ấn, email).
   * `full` = bản gốc có cả tagline "CONCERT & EVENT TICKETS", chỉ dùng khi hiện lớn.
   * `mark` = chỉ biểu tượng.
   *
   * Vì sao mặc định là bản nền tối: cả bốn app đều chạy nền tối, và wordmark gốc màu navy
   * `#00376F` gần như biến mất trên nền `#171211`. Bản này giữ nguyên biểu tượng gradient, chỉ
   * đổi phần chữ sang sáng — và vẫn giữ hai sắc độ NEXA/TICKET của bản gốc.
   *
   * Trong giao diện hầu như luôn dùng `lockup`: ở chiều cao 26–38px, dòng tagline chỉ cao 3–4px,
   * không đọc được và chỉ làm logo trông bẩn.
   */
  variant?: BrandLogoVariant;
  /** Chiều cao hiển thị, px. Chiều rộng tự co theo tỉ lệ. */
  height?: number;
  /** Logo ở header nằm trong màn hình đầu tiên — tải trước để không nhấp nháy. */
  priority?: boolean;
  className?: string;
}

const SOURCES = {
  lockup: logoDark,
  'lockup-on-light': logoLight,
  full: logoFull,
  mark: logoMark,
};

/**
 * Logo NexaTicket.
 *
 * Nguồn ảnh nằm ở `@nexaticket/brand`, dùng chung cho cả bốn app. Đổi logo là đổi một chỗ.
 *
 * `alt` để rỗng ở biến thể `mark` vì nơi dùng luôn đặt chữ "NexaTicket" ngay cạnh — đọc tên
 * thương hiệu hai lần liền nhau là tiếng ồn cho người dùng trình đọc màn hình.
 */
export function BrandLogo({
  variant = 'lockup',
  height = 32,
  priority = false,
  className,
}: BrandLogoProps) {
  return (
    <Image
      src={SOURCES[variant]}
      alt={variant === 'mark' ? '' : 'NexaTicket'}
      priority={priority}
      className={className}
      // Chiều rộng để `auto`: ảnh nguồn có tỉ lệ cố định, khai cứng cả hai chiều là cầm chắc méo
      // khi bản logo sau có tỉ lệ khác.
      style={{ height, width: 'auto' }}
    />
  );
}
