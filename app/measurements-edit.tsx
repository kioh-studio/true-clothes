import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { Field, PrimaryButton, Tag, Segmented, TextLink } from '../src/components/ui';
import { IconChevronLeft } from '../src/components/icons';
import { useFitEngineStore } from '../src/stores/fitEngineStore';
import { validateMeasurements } from '../src/features/measurements/useMeasurements';
import { computeBodyShape, computeBodyShapeLegacy, stabilizeBodyShape, type BodyShape } from '../src/types/measurements';
import { useTranslation } from '../src/i18n';

import type { PreferredFit } from '../src/types/fitEngine';

const FIT_OPTIONS: PreferredFit[] = ['SLIM', 'REGULAR', 'RELAXED', 'OVERSIZED'];
const FIT_LABEL_KEYS: Record<PreferredFit, string> = {
  SLIM: 'measurementsEdit_fitSlim',
  REGULAR: 'measurementsEdit_fitRegular',
  RELAXED: 'measurementsEdit_fitRelaxed',
  OVERSIZED: 'measurementsEdit_fitOversized',
};
const SHAPE_OPTIONS: BodyShape[] = ['hourglass', 'rectangle', 'triangle', 'inverted_triangle', 'apple'];
const SHAPE_LABEL_KEYS: Record<BodyShape, string> = {
  hourglass: 'measurements_shapeHourglass',
  rectangle: 'measurements_shapeRectangle',
  triangle: 'measurements_shapeTriangle',
  inverted_triangle: 'measurements_shapeInvertedTriangle',
  apple: 'measurements_shapeApple',
};

function cmStr(val?: number) { return val ? String(Math.round(val)) : ''; }

export default function MeasurementsEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { bodyMeasurements, setBodyMeasurements } = useFitEngineStore();
  const bm = bodyMeasurements;

  const [v, setV] = useState({
    height:     cmStr(bm.body_height),
    heightUnit: 'CM',
    weight:     cmStr(bm.body_weight),
    weightUnit: 'KG',
    chest:      cmStr(bm.body_bust),
    waist:      cmStr(bm.body_waist),
    hips:       cmStr(bm.body_hip),
    inseam:     cmStr(bm.body_inseam),
    thigh:      cmStr(bm.body_thigh),
    rise:       cmStr(bm.body_rise),
    shoulder:   cmStr(bm.body_shoulder_width),
    sleeve:     cmStr(bm.body_sleeve_length),
    torso:      cmStr(bm.body_upper_body_length),
    fit:        (bm.preferredFit ?? 'REGULAR') as PreferredFit,
  });

  const initial = useRef({ ...v }).current;
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  // Body shape is derived live from bust/waist/hip — whether typed by hand or
  // pre-filled by the AI scan — unless the user picks a manual override below.
  // A saved shape counts as an override only if it matches NEITHER the current
  // classifier NOR the legacy (pre-2026-08-03) classifier's output (same
  // convention as useMeasurements).
  const derivedShape = useMemo(() => {
    const num = (s: string): number | undefined => {
      const n = parseFloat(s);
      return isFinite(n) ? n : undefined;
    };
    return stabilizeBodyShape(bm.bodyShape ?? null, { body_bust: num(v.chest), body_waist: num(v.waist), body_hip: num(v.hips) });
  }, [v.chest, v.waist, v.hips, bm.bodyShape]);
  const [shapeOverride, setShapeOverride] = useState<BodyShape | null>(() => {
    const saved = bm.bodyShape ?? null;
    if (!saved) return null;
    const current = computeBodyShape(bm);
    const legacy = computeBodyShapeLegacy(bm);
    return saved === current || saved === legacy ? null : saved;
  });
  const initialShapeOverride = useRef(shapeOverride).current;
  const bodyShape = shapeOverride ?? derivedShape;
  const dirty = JSON.stringify(v) !== JSON.stringify(initial) || shapeOverride !== initialShapeOverride;

  // Nudge the user toward completing/confirming the auto-derived body shape.
  // No nudge once they've manually overridden it — they already chose.
  const girthsFilled = [v.chest, v.waist, v.hips]
    .filter((s) => s?.trim() && !isNaN(parseFloat(s))).length;
  const shapeNudgeKey = shapeOverride
    ? null
    : bodyShape
      ? 'measurements_shapeNudgeConfirm'
      : (girthsFilled < 3 ? 'measurements_shapeNudgeMissing' : null);

  // Consume pose-estimated values from the AI scan screen (measurements-scan.tsx).
  // pendingEstimate is set by the scan screen before router.back(), so it will be
  // non-null when this screen regains focus. Clearing it prevents double-apply.
  const pendingEstimate    = useFitEngineStore((s) => s.pendingEstimate);
  const setPendingEstimate = useFitEngineStore((s) => s.setPendingEstimate);
  useEffect(() => {
    if (!pendingEstimate) return;
    setV((prev) => ({
      ...prev,
      ...(pendingEstimate.body_bust   != null ? { chest:  String(pendingEstimate.body_bust) }   : {}),
      ...(pendingEstimate.body_waist  != null ? { waist:  String(pendingEstimate.body_waist) }  : {}),
      ...(pendingEstimate.body_hip    != null ? { hips:   String(pendingEstimate.body_hip) }    : {}),
      ...(pendingEstimate.body_inseam != null ? { inseam: String(pendingEstimate.body_inseam) } : {}),
      ...(pendingEstimate.body_shoulder_width    != null ? { shoulder: String(pendingEstimate.body_shoulder_width) }    : {}),
      ...(pendingEstimate.body_sleeve_length     != null ? { sleeve:   String(pendingEstimate.body_sleeve_length) }     : {}),
      ...(pendingEstimate.body_upper_body_length != null ? { torso:    String(pendingEstimate.body_upper_body_length) } : {}),
    }));
    // A fresh estimate should not stay shadowed by an old manual pick — revert
    // to AUTO so the shape re-derives from the just-estimated numbers.
    setShapeOverride(null);
    setPendingEstimate(null);
  }, [pendingEstimate, setPendingEstimate]);
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    setSaveError('');
    const heightCm = v.height
      ? v.heightUnit === 'IN' ? parseFloat(v.height) * 2.54 : parseFloat(v.height)
      : undefined;
    const weightKg = v.weight
      ? v.weightUnit === 'LB' ? parseFloat(v.weight) * 0.453592 : parseFloat(v.weight)
      : undefined;

    // parseFloat can yield NaN on stray input (e.g. "-", "."); isFinite() guards
    // every field so NaN never slips past the </>/> validation below (NaN
    // comparisons are always false) and gets written to the DB.
    const numOrUndef = (s: string): number | undefined => {
      const n = parseFloat(s);
      return isFinite(n) ? n : undefined;
    };

    const parsed = {
      body_height: heightCm != null && isFinite(heightCm) ? heightCm : undefined,
      body_weight: weightKg != null && isFinite(weightKg) ? weightKg : undefined,
      body_bust:   v.chest  ? numOrUndef(v.chest)  : undefined,
      body_waist:  v.waist  ? numOrUndef(v.waist)  : undefined,
      body_hip:    v.hips   ? numOrUndef(v.hips)   : undefined,
      body_inseam: v.inseam ? numOrUndef(v.inseam) : undefined,
      body_thigh:  v.thigh  ? numOrUndef(v.thigh)  : undefined,
      body_rise:   v.rise   ? numOrUndef(v.rise)   : undefined,
      body_shoulder_width:    v.shoulder ? numOrUndef(v.shoulder) : undefined,
      body_sleeve_length:     v.sleeve   ? numOrUndef(v.sleeve)   : undefined,
      body_upper_body_length: v.torso    ? numOrUndef(v.torso)    : undefined,
    };

    const validationError = validateMeasurements(parsed, t);
    if (validationError) {
      setSaveError(validationError);
      Alert.alert(t('onboardingMeasurements_invalidAlertTitle'), validationError);
      return;
    }

    await setBodyMeasurements({
      ...parsed,
      bodyShape: bodyShape ?? undefined,
      preferredFit: v.fit as PreferredFit,
    });
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('tabs_menu_sizeMeasurements')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>{t('measurementsEdit_title')}</Text>
        <Text style={styles.caption}>{t('measurementsEdit_caption')}</Text>

        <View style={{ height: 32 }} />
        <Text style={styles.sectionLabel}>{t('measurementsEdit_basicsLabel')}</Text>

        <View style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Field
              label={t('onboarding_measurements_heightLabel')}
              value={v.height}
              onChange={(val) => set('height', val)}
              placeholder={t('onboarding_measurements_heightPlaceholder')}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.unitToggle}>
            <Segmented
              options={['CM', 'IN']}
              value={v.heightUnit}
              onChange={(u) => set('heightUnit', u)}
            />
          </View>
        </View>

        <View style={{ height: 16 }} />
        <View style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Field
              label={t('onboarding_measurements_weightLabel')}
              value={v.weight}
              onChange={(val) => set('weight', val)}
              placeholder={t('onboarding_measurements_weightPlaceholder')}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.unitToggle}>
            <Segmented
              options={['KG', 'LB']}
              value={v.weightUnit}
              onChange={(u) => set('weightUnit', u)}
            />
          </View>
        </View>

        <View style={{ height: 40 }} />
        <Text style={styles.sectionLabel}>{t('measurementsEdit_bodyAccuracyLabel')}</Text>
        <View style={{ height: 16 }} />
        <View style={styles.grid2}>
          <Field label={t('onboarding_measurements_chestLabel')}  value={v.chest}  onChange={(val) => set('chest', val)}  placeholder={t('onboarding_measurements_chestPlaceholder')} keyboardType="numeric" style={styles.gridItem} />
          <Field label={t('onboarding_measurements_waistLabel')}  value={v.waist}  onChange={(val) => set('waist', val)}  placeholder={t('onboarding_measurements_waistPlaceholder')} keyboardType="numeric" style={styles.gridItem} />
          <Field label={t('onboarding_measurements_hipsLabel')}   value={v.hips}   onChange={(val) => set('hips', val)}   placeholder={t('onboarding_measurements_hipsPlaceholder')} keyboardType="numeric" style={styles.gridItem} />
          <Field label={t('onboarding_measurements_inseamLabel')} value={v.inseam} onChange={(val) => set('inseam', val)} placeholder={t('onboarding_measurements_inseamPlaceholder')} keyboardType="numeric" style={styles.gridItem} />
          <Field label={t('onboarding_measurements_thighLabel')}  value={v.thigh}  onChange={(val) => set('thigh', val)}  placeholder={t('onboarding_measurements_thighPlaceholder')} keyboardType="numeric" style={styles.gridItem} />
          <Field label={t('onboarding_measurements_riseLabel')}   value={v.rise}   onChange={(val) => set('rise', val)}   placeholder={t('onboarding_measurements_risePlaceholder')} keyboardType="numeric" style={styles.gridItem} />
          <Field label={t('measurements_shoulderLabel')}  value={v.shoulder} onChange={(val) => set('shoulder', val)} placeholder={t('onboarding_measurements_risePlaceholder')} keyboardType="numeric" style={styles.gridItem} />
          <Field label={t('measurements_sleeveLabel')}    value={v.sleeve}   onChange={(val) => set('sleeve', val)}   placeholder={t('onboarding_measurements_risePlaceholder')} keyboardType="numeric" style={styles.gridItem} />
          <Field label={t('measurements_upperBodyLabel')} value={v.torso}    onChange={(val) => set('torso', val)}    placeholder={t('onboarding_measurements_risePlaceholder')} keyboardType="numeric" style={styles.gridItem} />
        </View>

        <View style={{ height: 40 }} />
        <Text style={styles.sectionLabel}>{t('measurements_bodyShapeLabel')}</Text>
        <Text style={[styles.caption, { marginTop: 8, fontSize: 11 }]}>
          {t('measurementsEdit_bodyShapeCaption')}
        </Text>
        <View style={{ height: 12 }} />
        <View style={styles.fitRow}>
          <Tag selected={!shapeOverride} onPress={() => setShapeOverride(null)}>
            {!shapeOverride && derivedShape ? `${t('onboardingCommon_autoTag')} · ${t(SHAPE_LABEL_KEYS[derivedShape]).toUpperCase()}` : t('onboardingCommon_autoTag')}
          </Tag>
          {SHAPE_OPTIONS.map((s) => (
            <Tag key={s} selected={shapeOverride === s} onPress={() => setShapeOverride(s)}>{t(SHAPE_LABEL_KEYS[s]).toUpperCase()}</Tag>
          ))}
        </View>
        {shapeNudgeKey && <Text style={[styles.caption, { marginTop: 10, fontSize: 11 }]}>{t(shapeNudgeKey)}</Text>}

        <View style={{ height: 40 }} />
        <Text style={styles.sectionLabel}>{t('measurementsEdit_preferredFitLabel')}</Text>
        <View style={{ height: 12 }} />
        <View style={styles.fitRow}>
          {FIT_OPTIONS.map((f) => (
            <Tag key={f} selected={v.fit === f} onPress={() => set('fit', f)}>{t(FIT_LABEL_KEYS[f])}</Tag>
          ))}
        </View>

        <View style={{ height: 32 }} />
        <View style={{ alignItems: 'center' }}>
          <TextLink color={T.color.primary} arrow onPress={() => {
            // Pass the in-progress height + weight (may differ from the stored
            // values) as the scanner's scale reference and BMI depth refinement.
            const cm = v.height
              ? (v.heightUnit === 'IN' ? parseFloat(v.height) * 2.54 : parseFloat(v.height))
              : undefined;
            const kg = v.weight
              ? (v.weightUnit === 'LB' ? parseFloat(v.weight) * 0.453592 : parseFloat(v.weight))
              : undefined;
            const qs = [
              cm && isFinite(cm) && cm > 0 ? `heightCm=${Math.round(cm)}` : null,
              kg && isFinite(kg) && kg > 0 ? `weightKg=${Math.round(kg)}` : null,
            ].filter(Boolean).join('&');
            router.push(qs ? `/measurements-scan?${qs}` : '/measurements-scan');
          }}>{t('measurementsEdit_reestimateLink')}</TextLink>
          <Text style={[styles.caption, { textAlign: 'center', marginTop: 8, fontSize: 11 }]}>
            {t('measurementsEdit_reestimateCaption')}
          </Text>
        </View>
      </ScrollView>

      {/* Sticky save bar */}
      <View style={[styles.saveBar, { paddingBottom: insets.bottom + 12 }]}>
        {saveError ? (
          <Text style={[styles.saveError, { position: 'absolute', top: -28, left: 24, right: 24 }]}>{saveError}</Text>
        ) : null}
        {dirty && (
          <Pressable onPress={() => { setV({ ...initial }); setSaveError(''); }} style={styles.discardBtn}>
            <Text style={styles.discardText}>{t('common_discard')}</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <PrimaryButton onPress={dirty ? handleSave : undefined} disabled={!dirty}>
            {dirty ? t('profileEdit_saveButton') : t('common_noChanges')}
          </PrimaryButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: { ...type.h3, color: T.color.primary },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24, paddingTop: 8 },
  h1: { ...type.h1, color: T.color.primary },
  caption: { ...type.caption },
  sectionLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  unitToggle: { marginTop: 24 },
  // Two-column layout. Each Field collapses to ~0 width without an explicit
  // basis (TextInput uses flex:1 inside a width-less wrapper), so the body grid
  // needs a per-item width; space-between forms the column gutter.
  grid2: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 },
  gridItem: { width: '48%' },
  fitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  saveBar: {
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
    backgroundColor: T.color.canvas,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  discardBtn: { height: 56, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  discardText: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  saveError: { ...type.caption, fontSize: 12, color: '#A33', textAlign: 'center' },
});
