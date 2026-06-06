import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="account" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="basics" />
      <Stack.Screen name="location" />
      <Stack.Screen name="measurements" />
      <Stack.Screen name="styles" />
      <Stack.Screen name="colors" />
      <Stack.Screen name="complete" />
      <Stack.Screen name="wardrobe-intro" />
    </Stack>
  );
}
