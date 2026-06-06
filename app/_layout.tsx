import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { useFonts } from 'expo-font';
import {
  CormorantGaramond_300Light,
  CormorantGaramond_400Regular,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Inter_400Regular,
  Inter_500Medium,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { T } from '../src/design/tokens';
import { useAuthStore } from '../src/stores/authStore';
import { useFitEngineStore } from '../src/stores/fitEngineStore';
import { useAppStore } from '../src/stores/appStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_300Light,
    CormorantGaramond_400Regular,
    Inter_400Regular,
    Inter_500Medium,
  });

  const { isLoggedIn, onboardingComplete, hydrated, hydrate } = useAuthStore();
  const { hydrate: hydrateFitEngine } = useFitEngineStore();
  const { hydrated: appHydrated, hydrate: hydrateApp } = useAppStore();
  const router = useRouter();
  const didNavigate = useRef(false);

  useEffect(() => {
    hydrate();
    hydrateFitEngine();
    hydrateApp();
  }, []);

  useEffect(() => {
    if (!fontsLoaded || !hydrated || !appHydrated) return;
    if (didNavigate.current) return;
    didNavigate.current = true;

    SplashScreen.hideAsync();

    if (isLoggedIn && onboardingComplete) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(onboarding)');
    }
  }, [fontsLoaded, hydrated, appHydrated, isLoggedIn, onboardingComplete]);

  if (!fontsLoaded || !hydrated || !appHydrated) {
    return <View style={{ flex: 1, backgroundColor: T.color.canvas }} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(onboarding)" options={{ animation: 'none' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="outfit/[id]" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="item/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="collections/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="collections/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="build" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="saved" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="schedule" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="styles-edit" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="colors-edit" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="measurements-edit" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="add-item" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="history" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </SafeAreaProvider>
  );
}
