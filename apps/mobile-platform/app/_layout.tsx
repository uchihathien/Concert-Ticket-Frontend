import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MobileAuthProvider } from '@/lib/auth-context';

export default function RootLayout() {
  return (
    <MobileAuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#111713' } }} />
    </MobileAuthProvider>
  );
}