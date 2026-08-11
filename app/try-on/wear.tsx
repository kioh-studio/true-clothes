// AI Try-On "Wear on you" screen (feature 009)
// Opened from outfit detail. Flow: upload a photo → validate (clear person?) →
// generate the user wearing the outfit → show result + fit score. Thin screen;
// all logic lives in useWearOnYou. Visual language follows the design artifact.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OUTFITS, itemById } from '../../src/data';
import { PrimaryButton, SecondaryButton, TextLink } from '../../src/components/ui';
import { IconX, IconImage } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { useAppStore } from '../../src/stores/appStore';
import { useAuthStore } from '../../src/stores/authStore';
import { buildWearGarments } from '../../src/services/tryOnWearService';
import { useWearOnYou } from '../../src/features/try-on/useWearOnYou';
import { getFaceCompositeStats, type FaceCompositeStats } from '../../src/features/try-on/faceCompositeStats';
import { CreditQuotaNote } from '../../src/features/monetization/components/CreditQuotaNote';
import type { WearGarment, WearFrame, WearProfile } from '../../src/types/tryOn';
import type { BodyShape, BodyMeasurements } from '../../src/types/measurements';
import type { PreferredFit } from '../../src/types/fitEngine';
import { useTranslation } from '../../src/i18n';

// "DD/MM/YYYY" → age in years (best-effort; undefined when unparseable).
function ageFromDob(dob: string | undefined, now: Date): number | undefined {
  if (!dob) return undefined;
  const [d, m, y] = dob.split('/').map(Number);
  if (!y || !m || !d) return undefined;
  let age = now.getFullYear() - y;
  const beforeBirthday = now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age > 0 && age < 120 ? age : undefined;
}

// Map body_* measurement keys → clean labels for the generator (excludes
// height/weight which are sent separately, and non-numeric/meta fields).
const MEASUREMENT_LABELS: Record<string, string> = {
  body_bust: 'chest', body_waist: 'waist', body_hip: 'hips',
  body_shoulder_width: 'shoulder_width', body_sleeve_length: 'sleeve_length',
  body_upper_body_length: 'upper_body_length', body_upper_arm: 'upper_arm',
  body_neck: 'neck', body_inseam: 'inseam', body_thigh: 'thigh',
  body_rise: 'rise', body_foot_length: 'foot_length', body_foot_width: 'foot_width',
};

// Detail measurements shown on the "Your Frame" card, in display order — reuses
// the same i18n label keys as onboarding/measurements-edit (no new label keys).
const DETAIL_FIELDS: { key: keyof BodyMeasurements; labelKey: string }[] = [
  { key: 'body_bust', labelKey: 'onboarding_measurements_chestLabel' },
  { key: 'body_waist', labelKey: 'onboarding_measurements_waistLabel' },
  { key: 'body_hip', labelKey: 'onboarding_measurements_hipsLabel' },
  { key: 'body_shoulder_width', labelKey: 'measurements_shoulderLabel' },
  { key: 'body_sleeve_length', labelKey: 'measurements_sleeveLabel' },
  { key: 'body_upper_body_length', labelKey: 'measurements_upperBodyLabel' },
  { key: 'body_upper_arm', labelKey: 'measurements_upperArmLabel' },
  { key: 'body_neck', labelKey: 'measurements_neckLabel' },
  { key: 'body_inseam', labelKey: 'onboarding_measurements_inseamLabel' },
  { key: 'body_thigh', labelKey: 'onboarding_measurements_thighLabel' },
  { key: 'body_rise', labelKey: 'onboarding_measurements_riseLabel' },
  { key: 'body_foot_length', labelKey: 'measurements_footLengthLabel' },
  { key: 'body_foot_width', labelKey: 'measurements_footWidthLabel' },
];

// Same maps as measurements-edit.tsx (kept local — screens are thin and this
// is display-only; no shared export exists for these small label lookups).
const SHAPE_LABEL_KEYS: Record<BodyShape, string> = {
  hourglass: 'measurements_shapeHourglass',
  rectangle: 'measurements_shapeRectangle',
  triangle: 'measurements_shapeTriangle',
  inverted_triangle: 'measurements_shapeInvertedTriangle',
  apple: 'measurements_shapeApple',
};
const FIT_LABEL_KEYS: Record<PreferredFit, string> = {
  SLIM: 'measurementsEdit_fitSlim',
  REGULAR: 'measurementsEdit_fitRegular',
  RELAXED: 'measurementsEdit_fitRelaxed',
  OVERSIZED: 'measurementsEdit_fitOversized',
};

export default function WearOnYouScreen() {
  // `extra` (optional) — one garment NOT in the wardrobe, e.g. the scanned
  // Mix & Match candidate. It has no cloud photo, so it reaches the generator
  // as a text-described garment (type/color/material/fit) — supported server-side.
  const { id, data, extra } = useLocalSearchParams<{ id: string; data?: string; extra?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const wardrobeItems = useAppStore(s => s.wardrobeItems);
  const measurements = useAuthStore(s => s.measurements);
  const gender = useAuthStore(s => s.gender);
  const dob = useAuthStore(s => s.dob);

  // Guard against malformed/truncated nav params — JSON.parse throws on invalid
  // JSON, which would otherwise crash this screen; falling through to the
  // OUTFITS lookup instead. Same guard shape as app/outfit/[id].tsx.
  const outfit = useMemo(() => {
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        /* fall through */
      }
    }
    return OUTFITS.find(o => o.id === id) ?? OUTFITS[0];
  }, [data, id]);

  // The user's frame, from real measurements (cm/kg) — shown on the intro card.
  const frame: WearFrame = useMemo(() => ({
    height: measurements?.body_height ? `${measurements.body_height} cm` : undefined,
    weight: measurements?.body_weight ? `${measurements.body_weight} kg` : undefined,
  }), [measurements?.body_height, measurements?.body_weight]);

  // Detail measurements present on the profile (chest/waist/hips/…), in display
  // order — only the ones the user actually filled in, for the "Your Frame" card.
  const detailRows = useMemo(() => {
    if (!measurements) return [];
    return DETAIL_FIELDS
      .map(({ key, labelKey }) => {
        const v = measurements[key];
        return typeof v === 'number' && v > 0 ? { key, labelKey, value: v } : null;
      })
      .filter((r): r is { key: keyof BodyMeasurements; labelKey: string; value: number } => r !== null);
  }, [measurements]);

  // The three girths that most affect garment drape. When ALL are missing, a
  // detail grid would be near-empty — show the add-measurements CTA instead.
  const sparse = useMemo(() => {
    const has = (v: number | undefined) => typeof v === 'number' && v > 0;
    return !has(measurements?.body_bust) && !has(measurements?.body_waist) && !has(measurements?.body_hip);
  }, [measurements?.body_bust, measurements?.body_waist, measurements?.body_hip]);

  // Some (but not all) detail fields present → a soft, low-emphasis nudge to
  // fill in the rest, without competing with the sparse-state CTA.
  const hasMoreToAdd = !sparse && detailRows.length < DETAIL_FIELDS.length;

  // Detailed profile sent to the generator for accurate proportions & fit.
  const profile: WearProfile = useMemo(() => {
    const measurementsCm: Record<string, number> = {};
    if (measurements) {
      for (const [key, label] of Object.entries(MEASUREMENT_LABELS)) {
        const v = (measurements as Record<string, unknown>)[key];
        if (typeof v === 'number' && v > 0) measurementsCm[label] = v;
      }
    }
    return {
      gender: gender || undefined,
      age: ageFromDob(dob, new Date()),
      heightCm: measurements?.body_height,
      weightKg: measurements?.body_weight,
      // measurements.bodyShape can be an explicit `null` (cleared — see
      // measurementService.bodyToRow()); WearProfile only has an "absent" state.
      bodyShape: measurements?.bodyShape ?? undefined,
      preferredFit: measurements?.preferredFit,
      measurementsCm: Object.keys(measurementsCm).length ? measurementsCm : undefined,
    };
  }, [measurements, gender, dob]);

  // Resolve garments (with signed image URLs) for the edge function. Async because
  // cloud items need signing; until ready, GENERATE is disabled.
  const [garments, setGarments] = useState<WearGarment[]>([]);
  // Tracks whether garment resolution has finished, so the "no items" notice only
  // shows after the async resolve completes (never flashes while it's still loading).
  const [garmentsReady, setGarmentsReady] = useState(false);
  const extraGarment = useMemo(() => {
    if (!extra) return null;
    try {
      const e = JSON.parse(extra);
      return e && typeof e.type === 'string' && e.type.trim() ? e : null;
    } catch { return null; }
  }, [extra]);

  useEffect(() => {
    let cancelled = false;
    setGarmentsReady(false);
    const byId = new Map(wardrobeItems.map(w => [w.id, w]));
    const sources = (outfit.itemIds as string[]).map((iid) => {
      const w = byId.get(iid);
      if (w) return { type: w.type, category: w.category, name: w.name, primaryColor: w.primaryColor, colors: w.colors, material: w.material, fit: w.fit, photoStorage: w.photoStorage, photoPath: w.photoPath };
      const m = itemById(iid);
      return m ? { type: m.type, name: m.name, primaryColor: m.color, material: m.material, fit: m.fit, photoStorage: 'none' as const, photoPath: null } : null;
    }).filter(Boolean) as Parameters<typeof buildWearGarments>[0];
    // The scanned candidate leads the look — describe it first.
    if (extraGarment) {
      sources.unshift({
        type: extraGarment.type, name: extraGarment.name ?? undefined,
        primaryColor: extraGarment.color ?? undefined,
        material: extraGarment.material ?? undefined, fit: extraGarment.fit ?? undefined,
        photoStorage: 'none' as const, photoPath: null,
      });
    }
    buildWearGarments(sources).then((g) => { if (!cancelled) { setGarments(g); setGarmentsReady(true); } });
    return () => { cancelled = true; };
  }, [outfit.itemIds, wardrobeItems, extraGarment]);

  // No garment in this outfit resolved to a wardrobe item → WEAR ON would stay
  // greyed out with no explanation. Surface a clear reason instead.
  const noGarments = garmentsReady && garments.length === 0;

  const w = useWearOnYou({
    garments,
    profile,
    context: { title: outfit.title, style: outfit.style, occasion: outfit.context },
  });

  const itemCount = (outfit.itemIds as string[]).length + (extraGarment ? 1 : 0);

  // Dev-only face-composite diagnostics (2026-08-07) — plain-English, not
  // user-facing copy, so no i18n keys. Loads the cumulative on-device tally
  // once per arrival at the result phase.
  const [devFaceStats, setDevFaceStats] = useState<FaceCompositeStats | null>(null);
  useEffect(() => {
    if (!__DEV__) return;
    if (w.phase !== 'result') return;
    let cancelled = false;
    getFaceCompositeStats().then((stats) => { if (!cancelled) setDevFaceStats(stats); });
    return () => { cancelled = true; };
  }, [w.phase]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Nav */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconX size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.navTitle}>{t('wearOnYou_navTitle')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={styles.body}>
          {/* ── Header copy (hidden on result for a cleaner reveal) ── */}
          {w.phase !== 'result' && (
            <>
              <Text style={styles.label}>{t('wearOnYou_seeItOnYou')}</Text>
              <View style={{ height: 8 }} />
              <Text style={styles.h2}>{outfit.title}</Text>
              <Text style={[type.caption, { marginTop: 12 }]}>
                {t('wearOnYou_intro')}
              </Text>
              <View style={{ height: 24 }} />
            </>
          )}

          {/* ── Your frame ── */}
          {w.phase !== 'result' && (
            <View style={styles.card}>
              <Text style={styles.label}>{t('wearOnYou_yourFrame')}</Text>
              <View style={{ height: 12 }} />
              <View style={{ flexDirection: 'row', gap: 16 }}>
                {[
                  { label: t('wearOnYou_height'), value: frame.height ?? '—' },
                  { label: t('wearOnYou_weight'), value: frame.weight ?? '—' },
                  { label: t('wearOnYou_items'), value: String(itemCount) },
                ].map(s => (
                  <View key={s.label} style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>{s.label}</Text>
                    <Text style={styles.frameValue}>{s.value}</Text>
                  </View>
                ))}
              </View>

              {sparse ? (
                <>
                  <View style={{ height: 16 }} />
                  <Text style={[type.caption, { fontSize: 11, color: T.color.secondary }]}>
                    {t('wearOnYou_framePartialCta')}
                  </Text>
                  <View style={{ height: 12 }} />
                  <SecondaryButton onPress={() => router.push('/measurements-edit')}>
                    {t('wearOnYou_frameAddButton')}
                  </SecondaryButton>
                </>
              ) : (
                <>
                  <View style={{ height: 16 }} />
                  <View style={styles.detailGrid}>
                    {detailRows.map(r => (
                      <View key={r.key} style={styles.detailItem}>
                        <Text style={styles.miniLabel}>{t(r.labelKey)}</Text>
                        <Text style={styles.detailValue}>{r.value} cm</Text>
                      </View>
                    ))}
                    {measurements?.bodyShape && (
                      <View style={styles.detailItem}>
                        <Text style={styles.miniLabel}>{t('measurements_bodyShapeLabel')}</Text>
                        <Text style={styles.detailValue}>{t(SHAPE_LABEL_KEYS[measurements.bodyShape])}</Text>
                      </View>
                    )}
                    {measurements?.preferredFit && (
                      <View style={styles.detailItem}>
                        <Text style={styles.miniLabel}>{t('measurementsEdit_preferredFitLabel')}</Text>
                        <Text style={styles.detailValue}>{t(FIT_LABEL_KEYS[measurements.preferredFit])}</Text>
                      </View>
                    )}
                  </View>
                  {hasMoreToAdd && (
                    <>
                      <View style={{ height: 12 }} />
                      <TextLink onPress={() => router.push('/measurements-edit')} color={T.color.tertiary}>
                        {t('wearOnYou_frameUpdateLink')}
                      </TextLink>
                    </>
                  )}
                </>
              )}
            </View>
          )}

          <View style={{ height: 20 }} />

          {/* ── Photo zone (state-dependent) ── */}
          <View style={styles.photoZone}>
            {w.photoUri ? (
              <Image source={{ uri: w.result?.localImageUri ?? w.photoUri }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={styles.photoEmpty}>
                <IconImage size={32} color={T.color.tertiary} strokeWidth={1.2} />
                <Text style={[type.caption, { marginTop: 12, color: T.color.tertiary, textAlign: 'center' }]}>
                  {t('wearOnYou_photoHint')}
                </Text>
              </View>
            )}

            {/* Overlays */}
            {(w.phase === 'validating' || w.phase === 'rendering') && (
              <View style={styles.overlay}>
                <ActivityIndicator color={T.color.canvas} />
                <Text style={styles.overlayText}>
                  {w.phase === 'validating' ? t('wearOnYou_checkingPhoto') : t('wearOnYou_generating')}
                </Text>
              </View>
            )}
            {w.phase === 'result' && (
              <View style={styles.resultBadge}>
                <Text style={styles.resultBadgeText}>{t('wearOnYou_resultBadge', { title: outfit.title })}</Text>
              </View>
            )}
          </View>

          {/* ── Invalid reason ── */}
          {w.phase === 'invalid' && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{w.reason}</Text>
            </View>
          )}

          {/* ── Result title ── */}
          {w.phase === 'result' && w.result && (
            <>
              <View style={{ height: 16 }} />
              <Text style={styles.h2}>{t('wearOnYou_resultTitle', { title: outfit.title })}</Text>
              {w.result.qualityWarning && (
                <>
                  <View style={{ height: 8 }} />
                  <Text style={[type.caption, { fontSize: 11, color: T.color.tertiary }]}>
                    {t('wearOnYou_qualityWarning')}
                  </Text>
                </>
              )}
              {w.faceApplied === false && (
                <>
                  <View style={{ height: 8 }} />
                  <Text style={[type.caption, { fontSize: 11, color: T.color.tertiary }]}>
                    {t('wearOnYou_faceFallback')}
                  </Text>
                </>
              )}
              {__DEV__ && (
                <>
                  <View style={{ height: 8 }} />
                  <Text style={[type.caption, { fontSize: 10, color: T.color.tertiary }]}>
                    {`[dev] face composite: ${w.faceReason ?? 'n/a'}`}
                    {devFaceStats
                      ? ` · lifetime ${devFaceStats.applied}/${devFaceStats.attempts} applied · by reason: ${
                          Object.entries(devFaceStats.byReason)
                            .map(([reason, count]) => `${reason}=${count}`)
                            .join(', ') || 'none yet'
                        }`
                      : ''}
                  </Text>
                </>
              )}
            </>
          )}

          {/* ── Generation error ── */}
          {w.phase === 'error' && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{w.errorMsg}</Text>
            </View>
          )}

          {/* ── Credit blocked ── */}
          {w.creditBlocked && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                {t('wearOnYou_creditBlocked')}
              </Text>
            </View>
          )}

          {/* ── No wardrobe items resolved for this outfit ── */}
          {noGarments && w.phase !== 'result' && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                {t('wearOnYou_noGarments')}
              </Text>
            </View>
          )}

          <View style={{ height: 28 }} />

          {/* ── Actions (state machine) ── */}
          {(w.phase === 'upload' || w.phase === 'invalid') && (
            <>
              <PrimaryButton onPress={w.pickFromCamera}>{t('wearOnYou_takePhoto')}</PrimaryButton>
              <View style={{ height: 12 }} />
              <SecondaryButton onPress={w.pickFromLibrary}>{t('wearOnYou_pickFromLibrary')}</SecondaryButton>
            </>
          )}

          {w.phase === 'validating' && (
            <PrimaryButton disabled>{t('wearOnYou_checking')}</PrimaryButton>
          )}

          {w.phase === 'ready' && (
            <>
              {/* Monthly AI allowance, stated where it gets spent — the paywall
                  no longer names any numbers (src/design/paywall/design.md). */}
              <CreditQuotaNote status={w.quota} creditType="try_on" style={styles.quotaNote} />
              <PrimaryButton onPress={w.generate} disabled={garments.length === 0 || w.creditBlocked}>{t('wearOnYou_wearOn')}</PrimaryButton>
              <View style={{ height: 12 }} />
              <SecondaryButton onPress={w.pickAnother}>{t('wearOnYou_pickAnother')}</SecondaryButton>
              <View style={{ height: 12 }} />
              <Text style={[type.caption, { fontSize: 11, color: T.color.tertiary, textAlign: 'center' }]}>
                {t('wearOnYou_generateHint')}
              </Text>
            </>
          )}

          {w.phase === 'rendering' && (
            <PrimaryButton disabled>{t('wearOnYou_generatingButton')}</PrimaryButton>
          )}

          {(w.phase === 'result' || w.phase === 'error') && (
            <>
              {/* Regenerating spends another credit — same note, same reason. */}
              <CreditQuotaNote status={w.quota} creditType="try_on" style={styles.quotaNote} />
              <PrimaryButton onPress={w.regenerate} disabled={w.creditBlocked}>{t('wearOnYou_regenerate')}</PrimaryButton>
              <View style={{ height: 12 }} />
              <SecondaryButton onPress={w.pickAnother}>{t('wearOnYou_tryAnotherPhoto')}</SecondaryButton>
              <View style={{ height: 16 }} />
              <View style={{ alignItems: 'center' }}>
                <TextLink onPress={() => router.back()} color={T.color.tertiary}>{t('wearOnYou_done')}</TextLink>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  navTitle: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 24 },
  quotaNote: { textAlign: 'center', marginBottom: 12 },
  label: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  miniLabel: { ...type.ui, fontSize: 9, color: T.color.tertiary },
  h2: { ...type.h2, color: T.color.primary },
  card: { borderWidth: 0.5, borderColor: T.color.hairline, padding: 20 },
  frameValue: { fontFamily: T.font.serif, fontSize: 18, color: T.color.primary, marginTop: 4 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  detailItem: { flexBasis: '28%', flexGrow: 1 },
  detailValue: { fontFamily: T.font.serif, fontSize: 14, color: T.color.primary, marginTop: 3 },
  photoZone: {
    width: '100%', aspectRatio: 3 / 4, backgroundColor: T.color.elevated,
    borderWidth: 0.5, borderColor: T.color.hairline, overflow: 'hidden',
    position: 'relative', alignItems: 'center', justifyContent: 'center',
  },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,24,21,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  overlayText: { ...type.ui, fontSize: 10, color: T.color.canvas },
  resultBadge: {
    position: 'absolute', top: 12, left: 12, backgroundColor: T.color.canvas,
    paddingVertical: 4, paddingHorizontal: 8,
  },
  resultBadgeText: { ...type.ui, fontSize: 9, color: T.color.primary },
  notice: { marginTop: 16, borderWidth: 0.5, borderColor: T.color.hairline, padding: 16, backgroundColor: T.color.elevated },
  noticeText: { ...type.caption, color: T.color.secondary },
});
