/**
 * Ảnh tĩnh import qua Metro (ví dụ logo từ `@nexaticket/brand`).
 *
 * Metro biến file ảnh thành một id tài nguyên dùng làm `source` của `<Image>`. Expo không tự khai
 * kiểu cho việc này, nên thiếu file này thì `tsc` báo không tìm thấy module.
 */
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';

  const source: ImageSourcePropType;
  export default source;
}
