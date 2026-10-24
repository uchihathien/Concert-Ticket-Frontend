import { Stack } from 'expo-router';
import { SavedEventsProvider } from '@/lib/saved-events';

export default function CustomerLayout() {
  return (
    <SavedEventsProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#111713' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="events/[slug]" />
        <Stack.Screen name="booking/[sessionId]" />
        <Stack.Screen name="checkout/[orderId]" />
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
        <Stack.Screen name="orders" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="help" />
        <Stack.Screen name="assistant" />
      </Stack>
    </SavedEventsProvider>
  );
}
