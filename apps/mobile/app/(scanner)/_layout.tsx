import { Stack } from 'expo-router';

/**
 * Màn mở đầu của khu soát vé là `scanner/index` — "Ca của tôi", nơi bắt đầu ca rồi chuyển sang máy quét.
 *
 * Khai tường minh: không khai thì router lấy màn đầu theo thứ tự tên tệp, và thêm một màn mới
 * (như `history`) là đổi luôn màn mà nhân viên rơi vào ngay sau khi đăng nhập.
 */
export const unstable_settings = { initialRouteName: 'scanner/index' };

export default function ScannerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#111713' } }}>
      <Stack.Screen name="scanner/index" />
      <Stack.Screen name="scanner/scan" />
      <Stack.Screen name="scanner/history" />
      <Stack.Screen name="scanner/handover" />
      <Stack.Screen name="scanner/lookup" />
    </Stack>
  );
}
