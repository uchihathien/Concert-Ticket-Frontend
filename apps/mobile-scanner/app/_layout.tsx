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
      </Stack>
    </ScannerAuthProvider>
  );
}