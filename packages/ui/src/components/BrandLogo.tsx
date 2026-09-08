import logoFull from '@nexaticket/brand/logo-full.png';
import logoLockup from '@nexaticket/brand/logo.png';
import logoMark from '@nexaticket/brand/logo-mark.png';
import Image from 'next/image';

export type BrandLogoVariant = 'lockup' | 'full' | 'mark';

export interface BrandLogoProps {
  /**
   * `lockup` (mặc định) = biểu tượng + chữ NEXATICKET, **không có** dòng tagline.
   * `full` = có cả tagline "CONCERT & EVENT TICKETS".
   * `mark` = chỉ biểu tượng.
   *
   * Trong giao diện hầu như luôn dùng `lockup`: ở chiều cao 32–40px, dòng tagline chỉ cao 3–4px,
   * không đọc được và chỉ làm logo trông bẩn. Để dành `full` cho chỗ hiện lớn.
   *
   * Nền tối phải dùng `mark`: chữ NEXATICKET màu navy gần như biến mất trên nền `#14100f` của
   * app soát vé.
   */
  variant?: BrandLogoVariant;
  /** Chiều cao hiển thị, px. Chiều rộng tự co theo tỉ lệ. */
  height?: number;
  /** Logo ở header nằm trong màn hình đầu tiên — tải trước để không nhấp nháy. */
  priority?: boolean;
  className?: string;
}

const SOURCES = {
  lockup: logoLockup,
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
