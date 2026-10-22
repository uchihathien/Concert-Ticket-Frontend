import type { ConfigContext, ExpoConfig } from 'expo/config';

// Tệp này chạy trên Node lúc build, nhưng tsconfig của app là của React Native (không có kiểu Node):
// lấy `fs` bằng require để khỏi kéo @types/node vào cả app.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { existsSync } = require('fs') as { existsSync: (path: string) => boolean };

/**
 * Hai ứng dụng từ CÙNG một mã nguồn (Expo app variants), chọn bằng biến `APP_VARIANT`:
 *
 * - `customer` (mặc định): "NexaTicket" cho khách mua vé.
 * - `staff`: "NexaTicket Staff" cho ban tổ chức và nhân viên soát vé.
 *
 * Hai bản khác bundle id / package nên cài song song trên cùng một máy, và kho SecureStore của
 * chúng tách nhau. Cùng `slug` và `projectId` vì là một dự án EAS, chỉ khác bản build.
 */
type AppVariant = 'customer' | 'staff';

const variant: AppVariant = process.env.APP_VARIANT === 'staff' ? 'staff' : 'customer';
const isStaff = variant === 'staff';

/** Icon riêng của bản staff nếu đã có; chưa có thì tạm dùng icon chung để bản build không hỏng. */
const staffIcon = './assets/images/icon-staff.png';
const icon = isStaff && existsSync(`${process.cwd()}/${staffIcon}`) ? staffIcon : './assets/images/icon.png';

const bundleId = isStaff ? 'com.nexaticket.staff' : 'com.nexaticket.customer';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isStaff ? 'NexaTicket Staff' : 'NexaTicket',
  slug: 'nexaticket-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon,
  scheme: isStaff ? 'nexaticket-staff' : 'nexaticket',
  userInterfaceStyle: 'dark',
  ios: {
    bundleIdentifier: bundleId,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    supportsTablet: true,
  },
  android: {
    package: bundleId,
    // Chỉ bản staff quét vé. Thư viện camera vẫn được liên kết vào cả hai bản (chung mã nguồn),
    // nên bản khách phải CHẶN quyền camera mà manifest của thư viện tự khai — không chỉ là không
    // xin thêm.
    ...(isStaff
      ? { permissions: ['android.permission.CAMERA'] }
      : { blockedPermissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'] }),
    adaptiveIcon: {
      backgroundColor: '#171211',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#171211',
      },
    ],
    'expo-secure-store',
    'expo-sqlite',
    ...(isStaff
      ? [
          [
            'expo-camera',
            {
              cameraPermission: 'Cho phép NexaTicket Staff dùng camera để quét vé và mã QR nhân viên.',
              recordAudioAndroid: false,
            },
          ] as [string, Record<string, unknown>],
        ]
      : []),
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    appVariant: variant,
    eas: {
      projectId: '2c265cc9-4a68-4565-8bf6-e83166117d3b',
    },
  },
});
