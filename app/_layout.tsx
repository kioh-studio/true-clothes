import '../src/i18n'; // initialise i18n before any screen renders
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
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
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../src/stores/authStore';
import { useFitEngineStore } from '../src/stores/fitEngineStore';
import { useAppStore } from '../src/stores/appStore';
import { OfflineBanner } from '../src/components/ui';
import { getCurrentUserId } from '../src/services/authService';

SplashScreen.preventAutoHideAsync();

// RevenueCat — only available in dev-client builds; gracefully absent in Expo Go
let Purchases: typeof import('react-native-purchases').default | null = null;
try { Purchases = require('react-native-purchases').default; } catch { /* Expo Go */ }

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_300Light,
    CormorantGaramond_400Regular,
    Inter_400Regular,
    Inter_500Medium,
  });

  const { isLoggedIn, onboardingComplete, hydrated, hydrate } = useAuthStore(useShallow(s => ({
    isLoggedIn: s.isLoggedIn, onboardingComplete: s.onboardingComplete, hydrated: s.hydrated, hydrate: s.hydrate,
  })));
  const { hydrate: hydrateFitEngine, loadCatalogs } = useFitEngineStore();
  const { hydrated: appHydrated, hydrate: hydrateApp, migrationProgress, refreshWeather } = useAppStore();
  const router = useRouter();
  const didNavigate = useRef(false);

  // Root navigator readiness — router methods throw "Attempted to navigate
  // before mounting the Root Layout" if called before this key exists.
  const navState = useRootNavigationState();
  const navReady = !!navState?.key;
  const appReady = fontsLoaded && hydrated && appHydrated;

  useEffect(() => {
    hydrate();
    hydrateFitEngine();
    hydrateApp();
    loadCatalogs();
  }, []);

  // T020: Fire-and-forget weather refresh after auth hydration
  useEffect(() => {
    if (hydrated && isLoggedIn) {
      refreshWeather();
    }
  }, [hydrated, isLoggedIn]);

  // T079: Wire RevenueCat after auth hydration.
  // logIn() aliases the RevenueCat app_user_id to the Supabase user.id so the
  // server-side webhook (revenuecat-webhook) can map purchase events back to a
  // profile row. Without this, RevenueCat uses an anonymous id ($RCAnonymousID:…)
  // the webhook cannot resolve. The webhook is the sole writer of
  // profiles.account_type — entitlement only flips on a store-verified purchase.
  useEffect(() => {
    if (!Purchases || !isLoggedIn) return;
    const apiKey = process.env['EXPO_PUBLIC_REVENUECAT_API_KEY'];
    if (!apiKey) return;
    (async () => {
      try {
        Purchases!.configure({ apiKey });
        const userId = await getCurrentUserId();
        if (userId) await Purchases!.logIn(userId);
      } catch { /* ignore (absent in Expo Go) */ }
    })();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!appReady || !navReady) return;
    if (didNavigate.current) return;
    didNavigate.current = true;

    if (isLoggedIn && onboardingComplete) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(onboarding)');
    }
    SplashScreen.hideAsync();
  }, [appReady, navReady, isLoggedIn, onboardingComplete]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <OfflineBanner />
      {/* The navigator must stay mounted on the very first render, or router
          navigation throws before the root layout registers. A canvas overlay
          covers the pre-redirect route flash while the app hydrates. */}
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
        <Stack.Screen name="formulas-edit" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="add-item" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="try-on" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="history" options={{ animation: 'slide_from_right' }} />
        {/* T030: Settings and Help routes */}
        <Stack.Screen name="settings" options={{ title: 'Settings', animation: 'slide_from_right' }} />
        <Stack.Screen name="help" options={{ title: 'Help & Feedback', animation: 'slide_from_right' }} />
        {/* T019: Profile edit */}
        <Stack.Screen name="profile-edit" options={{ headerShown: false, animation: 'slide_from_right' }} />
        {/* T039: Personal colour edit */}
        <Stack.Screen name="personal-color-edit" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="+not-found" />
      </Stack>

      {!appReady && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: T.color.canvas, zIndex: 9998 }]} />
      )}

      {/* T017: Migration progress overlay — blocks navigation until complete */}
      {migrationProgress !== null && (
        <View style={styles.migrationOverlay}>
          <Text style={styles.migrationText}>Syncing your wardrobe…</Text>
          <Text style={styles.migrationCount}>
            {migrationProgress.done} / {migrationProgress.total}
          </Text>
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  migrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: T.color.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  migrationText: {
    ...type.h2,
    color: T.color.primary,
    fontFamily: T.font.serifLight,
    fontWeight: '300',
  },
  migrationCount: {
    ...type.caption,
    marginTop: 12,
    color: T.color.tertiary,
    letterSpacing: 1,
  },
});
