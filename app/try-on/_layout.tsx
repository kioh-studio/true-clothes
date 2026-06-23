import { Stack } from 'expo-router';

export default function TryOnLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="result" />
      <Stack.Screen name="wear" />
      <Stack.Screen name="mix-match" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
    </Stack>
  );
}
