import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, TextLink, Photo, Bounded } from '../../src/components/ui';
import { T, type } from '../../src/design/tokens';
import { PHOTOS } from '../../src/data';
import { useAuthStore } from '../../src/stores/authStore';
import { useTranslation } from '../../src/i18n';

export default function CompleteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { completeOnboarding } = useAuthStore();
  const opacity = useRef(new Animated.Value(0)).current;
  // In-flight guard — both CTAs below call completeOnboarding(); without this
  // a double-tap (or tapping both) could fire two concurrent onboarding-
  // complete requests, and an uncaught rejection would leave the tap with no
  // feedback at all (no local loading state existed here before).
  const [busy, setBusy] = useState(false);

  // completeOnboarding() can fail (network/DB) — if we navigate anyway, the
  // server row is never marked complete, so the next cold start bounces the
  // user back to Welcome/OTP even though they finished onboarding once already.
  const finish = async (dest: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await completeOnboarding();
      if (!res.ok) {
        Alert.alert(t('onboardingCommon_couldNotFinishSetupAlertTitle'), res.message ?? t('onboardingCommon_pleaseTryAgain'));
        return;
      }
      router.replace(dest as never);
    } catch {
      Alert.alert(t('onboardingCommon_couldNotFinishSetupAlertTitle'), t('onboardingCommon_pleaseTryAgain'));
    } finally {
      setBusy(false);
    }
  };
  const finishThenPush = async (dest: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await completeOnboarding();
      if (!res.ok) {
        Alert.alert(t('onboardingCommon_couldNotFinishSetupAlertTitle'), res.message ?? t('onboardingCommon_pleaseTryAgain'));
        return;
      }
      router.push(dest as never);
    } catch {
      Alert.alert(t('onboardingCommon_couldNotFinishSetupAlertTitle'), t('onboardingCommon_pleaseTryAgain'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 600, delay: 80, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 48, opacity }]}>
      <Bounded style={{ flex: 1 }}>
        <View style={styles.center}>
          <View style={styles.imageBox}>
            <Photo src={PHOTOS.detail_2} label="DETAIL" tone={3} />
          </View>
          <View style={{ height: 48 }} />
          <Text style={styles.h1}>{t('onboarding_complete_title')}</Text>
          <Text style={styles.body}>{t('onboarding_complete_body')}</Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton onPress={() => finish('/(tabs)')} disabled={busy}>{t('onboarding_complete_enter')}</PrimaryButton>
          <View style={{ height: 24 }} />
          <View style={{ alignItems: 'center' }}>
            <TextLink onPress={() => finishThenPush('/(onboarding)/wardrobe-intro')} color={T.color.primary} arrow>
              {t('onboarding_complete_addWardrobe')}
            </TextLink>
          </View>
        </View>
      </Bounded>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: T.color.canvas,
    alignItems: 'center', paddingHorizontal: 40,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageBox: { width: 200, height: 280, overflow: 'hidden' },
  h1: { ...type.h1, color: T.color.primary, textAlign: 'center', marginTop: 48 },
  body: { ...type.bodyL, color: T.color.secondary, marginTop: 16, textAlign: 'center', maxWidth: 280 },
  actions: { width: '100%' },
});
