import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, TextLink, Field, Segmented, Tag } from '../../src/components/ui';
import { IconChevronLeft } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { useMeasurements } from '../../src/features/measurements/useMeasurements';
import { useFitEngineStore } from '../../src/stores/fitEngineStore';
import { useTranslation } from '../../src/i18n';
import type { BodyShape } from '../../src/types/measurements';

const SHAPE_OPTIONS: BodyShape[] = ['hourglass', 'rectangle', 'triangle', 'inverted_triangle', 'apple'];
const SHAPE_LABEL_KEYS: Record<BodyShape, string> = {
  hourglass: 'measurements_shapeHourglass',
  rectangle: 'measurements_shapeRectangle',
  triangle: 'measurements_shapeTriangle',
  inverted_triangle: 'measurements_shapeInvertedTriangle',
  apple: 'measurements_shapeApple',
};

export default function MeasurementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { values, setField, bodyShape, bodyShapeOverride, setBodyShapeOverride, consentGiven, setConsentGiven, save, saving, error } = useMeasurements();

  const [heightUnit, setHeightUnit] = React.useState('CM');

  // Consume pose-estimated values published by measurements-scan.tsx.
  const pendingEstimate    = useFitEngineStore((s) => s.pendingEstimate);
  const setPendingEstimate = useFitEngineStore((s) => s.setPendingEstimate);
  useEffect(() => {
    if (!pendingEstimate) return;
    if (pendingEstimate.body_bust   != null) setField('body_bust',   String(pendingEstimate.body_bust));
    if (pendingEstimate.body_waist  != null) setField('body_waist',  String(pendingEstimate.body_waist));
    if (pendingEstimate.body_hip    != null) setField('body_hip',    String(pendingEstimate.body_hip));
    if (pendingEstimate.body_inseam != null) setField('body_inseam', String(pendingEstimate.body_inseam));
    // Lengths — not shown on this lean onboarding form, but saved and editable
    // later in Settings → Size & measurements.
    if (pendingEstimate.body_shoulder_width    != null) setField('body_shoulder_width',    String(pendingEstimate.body_shoulder_width));
    if (pendingEstimate.body_sleeve_length     != null) setField('body_sleeve_length',     String(pendingEstimate.body_sleeve_length));
    if (pendingEstimate.body_upper_body_length != null) setField('body_upper_body_length', String(pendingEstimate.body_upper_body_length));
    // A previously saved shape must not shadow the fresh estimate: clearing the
    // override lets the badge re-derive from the just-estimated bust/waist/hip.
    setBodyShapeOverride(null);
    setPendingEstimate(null);
  }, [pendingEstimate, setPendingEstimate, setField, setBodyShapeOverride]);
  const [weightUnit, setWeightUnit] = React.useState('KG');

  const handleContinue = async () => {
    // Toggle values are UI-only (label swap); convert to the stored units
    // (cm/kg) here using the same factors as the AI-capture branch below.
    const h = parseFloat(values.body_height);
    const heightCm = isFinite(h) ? (heightUnit === 'IN' ? h * 2.54 : h) : undefined;
    const w = parseFloat(values.body_weight);
    const weightKg = isFinite(w) ? (weightUnit === 'LB' ? w * 0.453592 : w) : undefined;
    const overrides: Partial<Record<'body_height' | 'body_weight', number>> = {};
    if (heightCm !== undefined) overrides.body_height = heightCm;
    if (weightKg !== undefined) overrides.body_weight = weightKg;

    const result = await save(overrides);
    if (!result.ok) {
      if (result.message) Alert.alert(t('onboardingMeasurements_invalidAlertTitle'), result.message);
      return;
    }
    router.push('/(onboarding)/styles');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <Pressable onPress={() => router.push('/(onboarding)/styles')} style={styles.skipBtn}>
          <Text style={styles.skipText}>{t('onboarding_measurements_skip')}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={{ height: 32 }} />
        <Text style={styles.h1}>{t('onboarding_measurements_title')}</Text>
        <Text style={styles.caption}>{t('onboarding_measurements_subtitle')}</Text>
        <View style={{ height: 40 }} />

        <Text style={styles.sectionLabel}>{t('onboarding_measurements_required')}</Text>
        <View style={{ height: 16 }} />

        <View style={styles.fieldWithSegment}>
          <View style={{ flex: 1 }}>
            <Field label={t('onboarding_measurements_heightLabel')} value={values.body_height} onChange={(val) => setField('body_height', val)} placeholder={t('onboarding_measurements_heightPlaceholder')} suffix={heightUnit.toLowerCase()} keyboardType="number-pad" />
          </View>
          <Segmented options={['CM', 'IN']} value={heightUnit} onChange={setHeightUnit} />
        </View>
        <View style={{ height: 16 }} />
        <View style={styles.fieldWithSegment}>
          <View style={{ flex: 1 }}>
            <Field label={t('onboarding_measurements_weightLabel')} value={values.body_weight} onChange={(val) => setField('body_weight', val)} placeholder={t('onboarding_measurements_weightPlaceholder')} suffix={weightUnit.toLowerCase()} keyboardType="number-pad" />
          </View>
          <Segmented options={['KG', 'LB']} value={weightUnit} onChange={setWeightUnit} />
        </View>

        <View style={{ height: 40 }} />
        <Text style={styles.sectionLabel}>{t('onboarding_measurements_optional')}</Text>
        <View style={{ height: 16 }} />

        <View style={styles.twoCol}>
          <View style={styles.colItem}>
            <Field label={t('onboarding_measurements_chestLabel')} value={values.body_bust} onChange={(val) => setField('body_bust', val)} placeholder={t('onboarding_measurements_chestPlaceholder')} keyboardType="number-pad" />
          </View>
          <View style={styles.colItem}>
            <Field label={t('onboarding_measurements_waistLabel')} value={values.body_waist} onChange={(val) => setField('body_waist', val)} placeholder={t('onboarding_measurements_waistPlaceholder')} keyboardType="number-pad" />
          </View>
          <View style={styles.colItem}>
            <Field label={t('onboarding_measurements_hipsLabel')} value={values.body_hip} onChange={(val) => setField('body_hip', val)} placeholder={t('onboarding_measurements_hipsPlaceholder')} keyboardType="number-pad" />
          </View>
          <View style={styles.colItem}>
            <Field label={t('onboarding_measurements_inseamLabel')} value={values.body_inseam} onChange={(val) => setField('body_inseam', val)} placeholder={t('onboarding_measurements_inseamPlaceholder')} keyboardType="number-pad" />
          </View>
          <View style={styles.colItem}>
            <Field label={t('onboarding_measurements_thighLabel')} value={values.body_thigh} onChange={(val) => setField('body_thigh', val)} placeholder={t('onboarding_measurements_thighPlaceholder')} keyboardType="number-pad" />
          </View>
          <View style={styles.colItem}>
            <Field label={t('onboarding_measurements_riseLabel')} value={values.body_rise} onChange={(val) => setField('body_rise', val)} placeholder={t('onboarding_measurements_risePlaceholder')} keyboardType="number-pad" />
          </View>
        </View>

        <View style={styles.bodyShapeBadge}>
          <Text style={styles.bodyShapeLabel}>{t('measurements_bodyShapeLabel')}</Text>
          {bodyShape && <Text style={styles.bodyShapeValue}>{t(SHAPE_LABEL_KEYS[bodyShape]).toUpperCase()}</Text>}
          <View style={styles.shapeRow}>
            <Tag selected={!bodyShapeOverride} onPress={() => setBodyShapeOverride(null)}>{t('onboardingCommon_autoTag')}</Tag>
            {SHAPE_OPTIONS.map((s) => (
              <Tag key={s} selected={bodyShapeOverride === s} onPress={() => setBodyShapeOverride(s)}>{t(SHAPE_LABEL_KEYS[s]).toUpperCase()}</Tag>
            ))}
          </View>
        </View>

        <View style={{ height: 32 }} />

        {/* Consent */}
        <Pressable style={styles.consentRow} onPress={() => setConsentGiven(!consentGiven)}>
          <View style={[styles.checkbox, consentGiven && styles.checkboxChecked]}>
            {consentGiven && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.consentText}>{t('onboardingMeasurements_consentLabel')}</Text>
        </Pressable>

        <View style={{ height: 32 }} />
        <View style={{ alignItems: 'center' }}>
          <TextLink color={T.color.primary} arrow onPress={() => {
            // Pass the in-progress height + weight (not yet saved to the store) so
            // the scanner has its scale reference and BMI depth refinement.
            const h = parseFloat(values.body_height);
            const cm = isFinite(h) ? (heightUnit === 'IN' ? h * 2.54 : h) : undefined;
            const w = parseFloat(values.body_weight);
            const kg = isFinite(w) ? (weightUnit === 'LB' ? w * 0.453592 : w) : undefined;
            const qs = [
              cm && cm > 0 ? `heightCm=${Math.round(cm)}` : null,
              kg && kg > 0 ? `weightKg=${Math.round(kg)}` : null,
            ].filter(Boolean).join('&');
            router.push(qs ? `/measurements-scan?${qs}` : '/measurements-scan');
          }}>{t('onboarding_measurements_aiCapture')}</TextLink>
          <Text style={[type.caption, { fontSize: 11, color: T.color.tertiary, marginTop: 8, textAlign: 'center' }]}>
            {t('onboarding_measurements_aiCaptureDesc')}
          </Text>
        </View>

        <View style={{ height: 48 }} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {error ? <View style={{ height: 12 }} /> : null}
        <PrimaryButton onPress={handleContinue} disabled={saving || !consentGiven}>
          {saving ? t('addItem_savingText') : t('onboarding_measurements_continue')}
        </PrimaryButton>
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
  sectionLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  fieldWithSegment: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  twoCol: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  colItem: { width: '47%' },
  bodyShapeBadge: { marginTop: 24, alignItems: 'flex-start' },
  bodyShapeLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 4 },
  bodyShapeValue: { fontFamily: T.font.serif, fontSize: 20, fontWeight: '300', color: T.color.primary },
  shapeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 20, height: 20, borderWidth: 0.5, borderColor: T.color.hairline,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  checkboxChecked: { backgroundColor: T.color.primary, borderColor: T.color.primary },
  checkmark: { color: T.color.canvas, fontSize: 12 },
  consentText: { ...type.caption, flex: 1 },
  error: { ...type.caption, fontSize: 12, color: '#A33' },
});
