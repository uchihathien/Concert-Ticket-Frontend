import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { MobileAuthProvider } from '@/lib/auth-context';

export default function RootLayout() {
  return (
    <MobileAuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#171211' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="events/[slug]" />
        <Stack.Screen name="booking/[sessionId]" />
        <Stack.Screen name="checkout/[orderId]" />
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
      </Stack>
    </MobileAuthProvider>
  );
}
