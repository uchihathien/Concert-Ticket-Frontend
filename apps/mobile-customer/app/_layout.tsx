import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { MobileAuthProvider } from '@/lib/auth-context';
import { SavedEventsProvider } from '@/lib/saved-events';

export default function RootLayout() {
  return (
    <MobileAuthProvider>
      <SavedEventsProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#171211' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="events/[slug]" />
        <Stack.Screen name="booking/[sessionId]" />
        <Stack.Screen name="checkout/[orderId]" />
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
        <Stack.Screen name="orders" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="help" />
      </Stack>
      </SavedEventsProvider>
    </MobileAuthProvider>
  );
}
