// Splash / Welcome screen
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { Photo, Bounded } from '../../src/components/ui';
import { PrimaryButton, TextLink } from '../../src/components/ui';
import { T, type } from '../../src/design/tokens';
import { PHOTOS } from '../../src/data';
import { useTranslation } from '../../src/i18n';
import { useAuthStore } from '../../src/stores/authStore';
import { useFitEngineStore } from '../../src/stores/fitEngineStore';
import { resolveOnboardingResumeRoute } from '../../src/features/onboarding/resumeRoute';

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;

  // This screen is the root of the (onboarding) stack, reached whenever
  // app/_layout.tsx's boot redirect decides the user is NOT both logged in
  // AND onboardingComplete. That means a logged-in user only ever lands here
  // mid-onboarding — with a perfectly valid session already. Previously this
  // screen had no awareness of that and always showed the Welcome/auth entry,
  // forcing a pointless re-auth (Account → OTP) every reopen even though no
  // data was lost. Skip straight past auth and resume at the first step
  // whose data isn't on file yet. A signed-out user is untouched — they still
  // land on Welcome and must authenticate first.
  const { isLoggedIn, authHydrated, gender, dob, location, measurements } = useAuthStore(useShallow((s) => ({
    isLoggedIn: s.isLoggedIn, authHydrated: s.hydrated,
    gender: s.gender, dob: s.dob, location: s.location, measurements: s.measurements,
  })));
  const { fitHydrated, selectedStyles, colorPreferences } = useFitEngineStore(useShallow((s) => ({
    fitHydrated: s.hydrated,
    selectedStyles: s.styleProfile.selectedStyles,
    colorPreferences: s.colorPreferences,
  })));
  const didResume = useRef(false);

  useEffect(() => {
    if (!authHydrated || !isLoggedIn || didResume.current) return;
    // fitEngineStore (styles/colors) hydrates independently of authStore and
    // may still be in flight — wait for it rather than guessing "not done yet"
    // from empty defaults. It always eventually settles `hydrated: true`
    // (even on a failed fetch), so this can't hang forever.
    if (!fitHydrated) return;
    didResume.current = true;
    const dest = resolveOnboardingResumeRoute({
      gender, dob, location,
      bodyHeight: measurements?.body_height,
      bodyWeight: measurements?.body_weight,
      selectedStyles, colorPreferences,
    });
    router.replace(dest as never);
  }, [authHydrated, isLoggedIn, fitHydrated, gender, dob, location, measurements, selectedStyles, colorPreferences, router]);

  useEffect(() => {
    Animated.sequence([
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.delay(200),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(ctaOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  // A logged-in user is either about to be redirected past this screen, or
  // waiting on fitEngineStore above — never show the signed-out Welcome/auth
  // entry in either case.
  if (isLoggedIn) {
    return <View style={[styles.container, { paddingBottom: insets.bottom + 32 }]} />;
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
      {/* Top editorial image */}
      <View style={styles.imageArea}>
        <Photo src={PHOTOS.detail_1} label="EDITORIAL" tone={3} />
      </View>

      {/* Bottom brand area */}
      <View style={styles.brandArea}>
        <Bounded style={{ flex: 1, alignItems: 'center' }}>
          <Animated.Image
            source={require('../../assets/logo/MIEN-wordmark.png')}
            style={[styles.brand, { opacity, transform: [{ translateY }] }]}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="MIEN"
          />
          <Animated.Text style={[styles.tagline, { opacity: subtitleOpacity }]}>
            {t('onboarding_welcome_tagline')}
          </Animated.Text>

          <View style={{ flex: 1, minHeight: 24, maxHeight: 96 }} />

          <Animated.View style={[styles.cta, { opacity: ctaOpacity }]}>
            <PrimaryButton onPress={() => router.push('/(onboarding)/account')}>
              {t('onboarding_welcome_begin')}
            </PrimaryButton>
            <View style={{ height: 16 }} />
            <View style={styles.signInRow}>
              <TextLink onPress={() => router.push('/(onboarding)/account')} color={T.color.primary}>
                {t('onboarding_welcome_signIn')}
              </TextLink>
            </View>
          </Animated.View>
        </Bounded>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.color.canvas,
  },
  imageArea: {
    flex: 0,
    height: '55%',
  },
  brandArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 48,
  },
  brand: {
    width: 220,
    height: 82,
    alignSelf: 'center',
  },
  tagline: {
    ...type.body,
    color: T.color.secondary,
    textAlign: 'center',
    marginTop: 14,
  },
  cta: {
    width: '100%',
  },
  signInRow: {
    alignItems: 'center',
  },
});
