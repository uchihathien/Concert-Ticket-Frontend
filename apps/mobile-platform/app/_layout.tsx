import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MobileAuthProvider } from '@/lib/auth-context';

export default function RootLayout() {
  return (
    <MobileAuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f1f5f9' } }} />
    </MobileAuthProvider>
  );
}