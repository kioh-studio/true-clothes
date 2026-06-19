import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, TextLink, Field, Segmented } from '../../src/components/ui';
import { IconChevronLeft } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { useMeasurements } from '../../src/features/measurements/useMeasurements';
import { useTranslation } from '../../src/i18n';

export default function MeasurementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { values, setField, bodyShape, consentGiven, setConsentGiven, save, saving } = useMeasurements();

  const [heightUnit, setHeightUnit] = React.useState('CM');
  const [weightUnit, setWeightUnit] = React.useState('KG');

  const handleContinue = async () => {
    await save();
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

        {bodyShape && (
          <View style={styles.bodyShapeBadge}>
            <Text style={styles.bodyShapeLabel}>BODY SHAPE</Text>
            <Text style={styles.bodyShapeValue}>{bodyShape.replace('_', ' ').toUpperCase()}</Text>
          </View>
        )}

        <View style={{ height: 32 }} />

        {/* Consent */}
        <Pressable style={styles.consentRow} onPress={() => setConsentGiven(!consentGiven)}>
          <View style={[styles.checkbox, consentGiven && styles.checkboxChecked]}>
            {consentGiven && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.consentText}>I consent to my measurements being stored securely.</Text>
        </Pressable>

        <View style={{ height: 32 }} />
        <View style={{ alignItems: 'center' }}>
          <TextLink color={T.color.primary} arrow>{t('onboarding_measurements_aiCapture')}</TextLink>
          <Text style={[type.caption, { fontSize: 11, color: T.color.tertiary, marginTop: 8, textAlign: 'center' }]}>
            {t('onboarding_measurements_aiCaptureDesc')}
          </Text>
        </View>

        <View style={{ height: 48 }} />
        <PrimaryButton onPress={handleContinue} disabled={saving || !consentGiven}>
          {saving ? 'SAVING…' : t('onboarding_measurements_continue')}
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
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 20, height: 20, borderWidth: 0.5, borderColor: T.color.hairline,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  checkboxChecked: { backgroundColor: T.color.primary, borderColor: T.color.primary },
  checkmark: { color: T.color.canvas, fontSize: 12 },
  consentText: { ...type.caption, flex: 1 },
});
