import { Stack } from 'expo-router';

export default function PlatformLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#111713' } }} />;
}
