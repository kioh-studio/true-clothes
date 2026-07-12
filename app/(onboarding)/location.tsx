import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, Field } from '../../src/components/ui';
import { IconChevronLeft, IconPin } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { useAuthStore } from '../../src/stores/authStore';
import { detectCurrentLocation } from '../../src/services/locationService';
import { useTranslation } from '../../src/i18n';

export default function LocationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { setProfile } = useAuthStore();
  const [value, setValue] = useState('');     // source of truth — detected, then editable
  const [detecting, setDetecting] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Remember the auto-detected label + ISO code so we only attach the code when the
  // field still matches what GPS found (a manual edit clears it → server falls back
  // to the country-name map for the typed value).
  const detected = useRef<{ label: string; code: string | null } | null>(null);

  // Auto-detect on mount. Only prefill if the user hasn't typed yet (functional
  // update reads the latest value, so a fast typer is never overwritten).
  useEffect(() => {
    let active = true;
    (async () => {
      const res = await detectCurrentLocation();
      if (!active) return;
      setDetecting(false);
      if (!res) { setFailed(true); return; }
      detected.current = { label: res.label, code: res.countryCode };
      setValue(prev => (prev.trim() ? prev : res.label));
    })();
    return () => { active = false; };
  }, []);

  const handleContinue = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    const trimmed = value.trim();
    const code = detected.current && trimmed === detected.current.label
      ? detected.current.code
      : null;
    const result = await setProfile({ location: trimmed, locationCountryCode: code });
    setSaving(false);
    if (!result.ok) {
      const msg = result.message || t('onboardingLocation_saveError');
      setError(msg);
      Alert.alert(t('onboardingCommon_couldNotSaveAlertTitle'), msg);
      return;
    }
    router.push('/(onboarding)/measurements');
  };

  const cardText = detecting
    ? t('onboardingLocation_detecting')
    : value.trim() || (failed ? t('onboardingLocation_detectFailed') : t('onboardingLocation_notSet'));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <Pressable onPress={handleContinue} style={styles.skipBtn}>
          <Text style={styles.skipText}>{t('onboarding_location_skip')}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={{ height: 32 }} />
        <Text style={styles.h1}>{t('onboarding_location_title')}</Text>
        <Text style={styles.caption}>{t('onboardingLocation_subtitle')}</Text>
        <View style={{ height: 48 }} />

        <View style={styles.card}>
          <IconPin size={20} color={T.color.primary} strokeWidth={1.2} />
          <View style={{ height: 12 }} />
          <Text style={styles.detectedLabel}>{detecting ? t('onboardingLocation_detectingLabel') : t('onboardingLocation_yourLocationLabel')}</Text>
          <View style={{ height: 6 }} />
          <View style={styles.cardRow}>
            {detecting && <ActivityIndicator size="small" color={T.color.secondary} style={{ marginRight: 8 }} />}
            <Text style={styles.city}>{cardText}</Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
        <Text style={[type.caption, { color: T.color.secondary, textAlign: 'center' }]}>
          {failed ? t('onboardingLocation_enterManually') : t('onboardingLocation_autoDetectedEdit')}
        </Text>
        <View style={{ height: 16 }} />
        <Field label="" value={value} onChange={setValue} placeholder={t('onboarding_location_searchPlaceholder')} />

        <View style={{ height: 48 }} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {error ? <View style={{ height: 12 }} /> : null}
        <PrimaryButton onPress={handleContinue} disabled={saving}>{t('onboarding_location_useButton')}</PrimaryButton>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  topBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  skipBtn: { paddingHorizontal: 12, height: 44, alignItems: 'center', justifyContent: 'center' },
  skipText: { ...type.ui, color: T.color.tertiary },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24 },
  h1: { ...type.h1, color: T.color.primary },
  caption: { ...type.caption, marginTop: 12 },
  card: {
    borderWidth: 0.5, borderColor: T.color.hairlineStrong,
    borderRadius: 2, padding: 24,
  },
  detectedLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  city: { ...type.h3, color: T.color.primary, flexShrink: 1 },
  error: { ...type.caption, fontSize: 12, color: '#A33' },
});
