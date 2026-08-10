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
import { useWardrobeCriticStore } from '../src/stores/wardrobeCriticStore';
import { OfflineBanner } from '../src/components/ui';
import { getCurrentUserId } from '../src/services/authService';
import { useTranslation } from '../src/i18n';

SplashScreen.preventAutoHideAsync();

// RevenueCat — only available in dev-client builds; gracefully absent in Expo Go
let Purchases: typeof import('react-native-purchases').default | null = null;
try { Purchases = require('react-native-purchases').default; } catch { /* Expo Go */ }

// ─── Sentry (crash reporting only — analytics/perf tracing is a separate,
// later task) ────────────────────────────────────────────────────────────
// Lazy/guarded the same way as RevenueCat above: the require() is wrapped in
// try/catch so a native-module mismatch (e.g. Expo Go, which only gets the
// JS-level SDK) never crashes the app, and init only runs once a DSN exists.
// No Sentry project has been created yet, so EXPO_PUBLIC_SENTRY_DSN is an
// intentionally empty placeholder in .env/eas.json — the guard below makes
// that the normal, silent, no-op state rather than an error.
let Sentry: typeof import('@sentry/react-native') | null = null;
try { Sentry = require('@sentry/react-native'); } catch { /* not resolvable in this runtime */ }

// HARD PRIVACY CONSTRAINT (see CLAUDE.md + project memory "Body data
// on-device only"): body measurements and face/selfie photos must never
// leave the device. Sentry's defaults (PII collection, screenshots, session
// replay) are all capable of leaking exactly that — a screenshot mid-drape,
// a replay frame of the selfie screen, a stack/context value holding a
// measurement or an on-device photo URI — so all three are hard-disabled
// below, and beforeSend additionally scrubs any key that looks like it could
// hold that data from whatever event payload remains, plus any file:// URI
// (the scheme every on-device photo/measurement asset uses on both
// platforms) wherever it appears in the payload.
const SENTRY_SCRUB_KEY_RE = /(body_|measurement|photo|uri|skinlab|hairlab|undertone)/i;

function scrubSentryValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[scrubbed:max-depth]';
  if (typeof value === 'string') {
    return value.startsWith('file://') ? '[scrubbed:file-uri]' : value;
  }
  if (Array.isArray(value)) return value.map((v) => scrubSentryValue(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENTRY_SCRUB_KEY_RE.test(key) ? '[scrubbed]' : scrubSentryValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

if (Sentry) {
  const dsn = process.env['EXPO_PUBLIC_SENTRY_DSN'];
  if (dsn) {
    try {
      Sentry.init({
        dsn,
        sendDefaultPii: false,    // no device/user PII attached automatically
        attachScreenshot: false,  // a screenshot could capture a body/selfie screen
        // No tracesSampleRate/profilesSampleRate set → performance tracing and
        // profiling stay off for this pass (crash reporting only; see plan.md).
        // No replay integration added → session replay stays off.
        beforeSend(event) {
          try {
            return scrubSentryValue(event) as typeof event;
          } catch {
            return null; // fail closed: drop rather than risk leaking anything
          }
        },
      });
    } catch { /* never let Sentry init crash app startup */ }
  }
}

function RootLayout() {
  const { t } = useTranslation();
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
  const hydrateWardrobeCritic = useWardrobeCriticStore((s) => s.hydrate);
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
    hydrateWardrobeCritic();
  }, []);

  // T020: Fire-and-forget weather refresh after auth hydration
  useEffect(() => {
    if (hydrated && isLoggedIn) {
      refreshWeather();
      loadCatalogs();
    }
  }, [hydrated, isLoggedIn, loadCatalogs]);

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
        <Stack.Screen name="item-edit" options={{ animation: 'slide_from_right' }} />
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
        {/* 010-wardrobe-critic: gap-analysis report, reached from the Menu + end-of-feed card */}
        <Stack.Screen name="wardrobe-report" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="paywall" options={{ animation: 'slide_from_bottom', presentation: 'modal', headerShown: false }} />
        {/* T030: Settings and Help routes */}
        <Stack.Screen name="settings" options={{ title: t('settings_title'), animation: 'slide_from_right' }} />
        <Stack.Screen name="help" options={{ title: t('help_title'), animation: 'slide_from_right' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
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

// Sentry.wrap adds a top-level error boundary + touch-event breadcrumbs.
// Falls back to the plain component when Sentry didn't load (Expo Go / not
// yet resolvable) or never initialised (no DSN yet) — Sentry.wrap on an
// un-init'd SDK is a harmless no-op passthrough, but skipping it entirely
// when `Sentry` itself is null keeps this file crash-proof with the
// dependency absent altogether.
export default Sentry ? Sentry.wrap(RootLayout) : RootLayout;

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
