import Constants from 'expo-constants';

/**
 * Bản ứng dụng đang chạy — `customer` (NexaTicket) hay `staff` (NexaTicket Staff).
 *
 * Đọc từ `extra.appVariant` mà `app.config.ts` ghi lúc build (hoặc lúc `expo start`), không đọc
 * thẳng `process.env.APP_VARIANT`: biến đó chỉ tồn tại ở máy build, còn bundle chạy trên điện
 * thoại chỉ thấy cấu hình đã được đóng vào.
 */
export type AppVariant = 'customer' | 'staff';

export const APP_VARIANT: AppVariant =
  (Constants.expoConfig?.extra as { appVariant?: string } | undefined)?.appVariant === 'staff' ? 'staff' : 'customer';

export const isStaffApp = APP_VARIANT === 'staff';

/**
 * Tiền tố khoá SecureStore riêng cho từng bản. Hai bản cài thật đã có kho riêng (khác bundle id),
 * nhưng trong Expo Go thì chung một kho — thiếu tiền tố là đăng nhập app này ghi đè phiên app kia.
 */
export const storageKey = (name: string) => `nexaticket.${APP_VARIANT}.${name}`;
