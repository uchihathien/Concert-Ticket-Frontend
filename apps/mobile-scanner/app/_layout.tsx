import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScannerAuthProvider } from '@/lib/auth-context';

export default function RootLayout() {
  return (
    <ScannerAuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#111713' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="scan" />
        {/* Điểm quay về sau khi đăng nhập Keycloak. `animation: none` để lần chuyển hướng chớp nhoáng
            sang `/` không kèm hiệu ứng trượt, thứ trông như app giật một cái. */}
        <Stack.Screen name="auth" options={{ animation: 'none' }} />
      </Stack>
    </ScannerAuthProvider>
  );
}