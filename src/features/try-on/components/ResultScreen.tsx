// Try On (feature 008) — T020
// Scan Result + Verdict screen. Composes ItemOnWhite + extracted attributes + VerdictPanel.
// On mount, if verdict is null, triggers evaluate(). Thin — all logic via useTryOn.
//
// US2 and US3 placeholders are clearly marked below.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T, type } from '../../../design/tokens';
import { CONTENT_MAX } from '../../../design/layout';
import { PrimaryButton, Bounded } from '../../../components/ui';
import {
  IconChevronLeft, IconChevronRight, IconX, IconLayers, IconCheck,
} from '../../../components/icons';
import { useTryOn } from '../useTryOn';
import { useCandidateUnlock } from '../useCandidateUnlock';
import { computeWardrobeFit } from '../wardrobeFit';
import { ItemOnWhite } from './ItemOnWhite';
import { VerdictPanel } from './VerdictPanel';
import { measureGroupForType, MEASURE_FIELDS } from '../../wardrobe-add/measureSchema';
import { MeasurementAIMap } from '../../../components/measurements/MeasurementAIMap';
import { MeasureField } from '../../../components/measurements/MeasureField';
import type { MKey } from '../../../types/fitEngine';
import { useWardrobeCriticStore } from '../../../stores/wardrobeCriticStore';
import { useTranslation } from '../../../i18n';

// Attribute chips shown below the product image
const CHIP_KEYS = [
  { key: 'type',         labelKey: 'resultScreen_chipCategory' },
  { key: 'color',        labelKey: 'resultScreen_chipColor' },
  { key: 'material',     labelKey: 'resultScreen_chipMaterial' },
  { key: 'fit',          labelKey: 'resultScreen_chipFit' },
  { key: 'warmthSeason', labelKey: 'resultScreen_chipSeason' },
  { key: 'pattern',      labelKey: 'resultScreen_chipPattern' },
] as const;

type ChipKey = typeof CHIP_KEYS[number]['key'];

export function ResultScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const {
    status, scannedItem, verdict, error, mixMatchOutfits, mixMatchLoading,
    evaluate, discard, fetchMixMatch, prefetchMixMatch, addToWardrobe, applyMeasurements,
  } = useTryOn();

  // 010-wardrobe-critic Try-On bridge (T031): if the user arrived here via a
  // GapCard's "try when shopping" action, wardrobeCriticStore remembers WHICH
  // gap they're checking.
  const pendingGapArchetypeId = useWardrobeCriticStore((s) => s.pendingGapArchetypeId);
  const pendingGapLabel = useWardrobeCriticStore((s) => s.pendingGapLabel);
  const clearPendingGap = useWardrobeCriticStore((s) => s.clearPendingGap);

  // Re-score the ACTUAL scanned item against the critic (T032, 2026-08-11) —
  // only while the gap-fill banner below would render, so an ordinary scan
  // never spends the shared wardrobe-critic rate-limit budget. Fails silently
  // (see useCandidateUnlock's header); the label-only banner line is never
  // gated on this.
  const candidateUnlock = useCandidateUnlock(
    scannedItem?.metadata ?? null,
    Boolean(pendingGapArchetypeId && pendingGapLabel),
  );

  // Trigger evaluation on mount if verdict is not yet available
  useEffect(() => {
    if (scannedItem && !verdict) {
      evaluate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hardware back / swipe-back pops this screen (unmounts it) without going
  // through handleBack, which previously left the temp cut-out file leaked
  // forever. A Stack push (e.g. Mix & Match) does NOT unmount this screen, so
  // this only fires on an actual pop — safe to call unconditionally since
  // discard() is idempotent (a no-op once scannedItem is already cleared, as
  // it is after handleBack/handleViewWardrobe already ran it explicitly).
  useEffect(() => {
    return () => { discard(); clearPendingGap(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background-prefetch Mix & Match so the wardrobe-fit signal can be shown
  // on the Result screen and the feed opens instantly when the user taps.
  useEffect(() => {
    if (scannedItem && mixMatchOutfits.length === 0 && !mixMatchLoading) {
      prefetchMixMatch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive wardrobe-fit info whenever the prefetch results arrive.
  const wardrobeFit = useMemo(
    () => (mixMatchOutfits.length ? computeWardrobeFit(mixMatchOutfits) : null),
    [mixMatchOutfits],
  );

  // When the verdict can't be scored at all (no profile data overlaps the item),
  // route the "complete profile" CTA to the most impactful missing section.
  // measurement/fit live in measurements-edit; style and colour have their own.
  const completeProfileRoute = useMemo(() => {
    if (!verdict) return null;
    const unavailable = new Set(
      verdict.criteria.filter(c => !c.available).map(c => c.key),
    );
    if (unavailable.has('measurement') || unavailable.has('fit')) return '/measurements-edit';
    if (unavailable.has('style')) return '/styles-edit';
    if (unavailable.has('color')) return '/colors-edit';
    return '/measurements-edit';
  }, [verdict]);

  const [adding, setAdding] = useState(false);
  const isEvaluating = status === 'evaluating' && !verdict;
  const justAdded = status === 'added';

  const handleBack = () => {
    // Leaving the result without buying = discard (deletes temp cut-out, FR-015).
    discard();
    router.back();
  };

  const handleMixMatch = () => {
    // Warm the fetch so the feed has results sooner; the feed also self-fetches.
    // Skip when already loading (prefetchMixMatch may have started in the background).
    if (mixMatchOutfits.length === 0 && !mixMatchLoading) fetchMixMatch();
    router.push('/try-on/mix-match');
  };

  const handleAdd = async () => {
    if (adding) return;
    setAdding(true);
    try {
      await addToWardrobe();
    } finally {
      setAdding(false);
    }
  };

  const handleViewWardrobe = () => {
    discard();
    router.replace('/(tabs)/wardrobe');
  };

  // If we have no scannedItem (e.g. deep-linked), redirect back to scan
  if (!scannedItem) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.caption}>{t('resultScreen_noItemScanned')}</Text>
        <Pressable onPress={() => router.back()} style={styles.retryBtn}>
          <Text style={styles.retryBtnLabel}>{t('resultScreen_scanAnItem')}</Text>
        </Pressable>
      </View>
    );
  }

  const meta = scannedItem.metadata;

  // Estimated garment measurements (cm; EU number for shoes), type-aware. Editable
  // here so the user can correct AI estimates or fill blanks; accessories carry none
  // → the section is hidden. Every commit re-scores the Verdict (FR measurement crit).
  const measureFields = MEASURE_FIELDS[measureGroupForType(meta.type)];

  // Commit one edited field: rebuild the full measurements map (clearing the key
  // when emptied) and re-evaluate via the store.
  const commitMeasure = (key: MKey, v: number | undefined) => {
    const next: Partial<Record<MKey, number>> = { ...(meta.measurements ?? {}) };
    if (v === undefined) delete next[key];
    else next[key] = v;
    applyMeasurements(next).catch(() => {});
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
          <IconChevronLeft size={18} strokeWidth={1.3} color={T.color.primary} />
        </Pressable>
        <Text style={styles.headerLabel}>{t('resultScreen_headerLabel')}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Bounded>
        {/* AI-isolated item on white */}
        <ItemOnWhite
          localImageUri={scannedItem.localImageUri}
          label={meta.name || meta.type}
        />

        {/* Item name / type */}
        <View style={styles.identity}>
          <Text style={styles.itemName}>{meta.name || meta.type}</Text>
          {meta.brand ? (
            <Text style={styles.itemBrand}>{meta.brand.toUpperCase()}</Text>
          ) : null}
        </View>

        {/* Extracted attribute grid */}
        <View style={styles.chipGrid}>
          {CHIP_KEYS.map((c, i) => {
            const value = meta[c.key as ChipKey];
            const displayValue =
              Array.isArray(value) ? value.join(', ') : (value ?? '—');
            return (
              <View
                key={c.key}
                style={[
                  styles.chip,
                  i % 2 === 0 && styles.chipBorderRight,
                  i < CHIP_KEYS.length - 2 && styles.chipBorderBottom,
                ]}
              >
                <Text style={styles.chipLabel}>{t(c.labelKey)}</Text>
                <Text style={styles.chipValue}>
                  {String(displayValue)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Estimated measurements (scaled from the user's body when worn), editable,
            + inline AI mapping (paste shop sizes → fills these + re-scores the Verdict). */}
        {measureFields.length > 0 && (
          <View style={styles.measureSection}>
            <Text style={styles.measureSectionLabel}>{t('resultScreen_estimatedMeasurements')}</Text>
            <View style={styles.measureGrid}>
              {measureFields.map(({ key, label }) => (
                <View key={key} style={styles.measureCell}>
                  <MeasureField
                    label={label}
                    value={meta.measurements?.[key]}
                    onCommit={(v) => commitMeasure(key, v)}
                    unit={key === 'm_shoe_size' ? 'EU' : 'cm'}
                  />
                </View>
              ))}
            </View>
            <MeasurementAIMap
              garmentType={meta.type}
              currentMeasurements={meta.measurements ?? {}}
              onApply={(m) =>
                applyMeasurements({ ...(meta.measurements ?? {}), ...m }).catch(() => {})
              }
            />
          </View>
        )}

        {/* ── Mix & match with closet (US2) ───────────────────────────────────── */}
        <Pressable onPress={handleMixMatch} style={styles.mixMatchCta}>
          <View style={styles.mixMatchIcon}>
            <IconLayers size={20} strokeWidth={1.3} color={T.color.canvas} />
          </View>
          <View style={styles.mixMatchCopy}>
            <Text style={styles.mixMatchTitle}>{t('resultScreen_mixMatchTitle')}</Text>
            <Text style={styles.mixMatchSub}>
              {mixMatchLoading && mixMatchOutfits.length === 0
                ? t('resultScreen_mixMatchFinding')
                : wardrobeFit
                  ? t('resultScreen_mixMatchStrongMatches', {
                      count: wardrobeFit.highCount,
                      suffix: wardrobeFit.highCount === 1 ? '' : 'es',
                      total: wardrobeFit.total,
                    })
                  : t('resultScreen_mixMatchDefault')}
            </Text>
          </View>
          <IconChevronRight size={15} strokeWidth={1.4} color={T.color.canvas} />
        </Pressable>

        {/* ── Verdict ──────────────────────────────────────────────────────── */}
        {isEvaluating && !verdict ? (
          <View style={styles.evaluatingState}>
            <ActivityIndicator size="small" color={T.color.primary} />
            <Text style={styles.evaluatingLabel}>{t('resultScreen_scoring')}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={evaluate} hitSlop={8}>
              <Text style={styles.retryLabel}>{t('resultScreen_retryLabel')}</Text>
            </Pressable>
            <Pressable onPress={() => {}} hitSlop={8}>
              <IconX size={12} strokeWidth={1.4} color={T.color.error} />
            </Pressable>
          </View>
        ) : null}

        {pendingGapArchetypeId && pendingGapLabel ? (
          <View style={styles.gapFillBanner}>
            <Text style={styles.gapFillText}>
              {t('resultScreen_fillsGap', {
                label: i18n.language?.startsWith('vi') ? pendingGapLabel.vi : pendingGapLabel.en,
              })}
            </Text>
            {/* Real re-score of THIS scanned item (T032) — only appears once the
                critic call resolves; absent on failure/timeout, never a spinner. */}
            {candidateUnlock ? (
              <Text style={styles.gapFillUnlockText}>
                {t('resultScreen_fillsGapUnlocks', {
                  count: candidateUnlock.unlockCount,
                  suffix: candidateUnlock.unlockCount === 1 ? '' : 's',
                })}
              </Text>
            ) : null}
          </View>
        ) : null}

        {verdict ? (
          <VerdictPanel
            verdict={verdict}
            wardrobeFit={wardrobeFit}
            wardrobeFitLoading={mixMatchLoading}
            onCompleteProfile={
              completeProfileRoute
                ? () => router.push(completeProfileRoute)
                : undefined
            }
          />
        ) : null}

        {/* Bottom padding for sticky bar */}
        <View style={styles.bottomSpacer} />
        </Bounded>
      </ScrollView>

      {/* ── Decide · Buy or Pass (US3) ──────────────────────────────────────── */}
      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + T.s(3) }]}>
        <Bounded>
        {error && !adding ? (
          <Text style={styles.addError}>{error}</Text>
        ) : null}
        <PrimaryButton onPress={handleAdd} disabled={adding}>
          {adding ? t('resultScreen_adding') : t('addItem_saveButton')}
        </PrimaryButton>
        <Pressable onPress={handleBack} hitSlop={8} style={styles.passBtn} disabled={adding}>
          <Text style={styles.passLabel}>{t('resultScreen_notForMe')}</Text>
        </Pressable>
        </Bounded>
      </View>

      {/* ── Success affordance after Add (T036) ─────────────────────────────── */}
      {justAdded ? (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successCheck}>
              <IconCheck size={22} strokeWidth={1.5} color={T.color.primary} />
            </View>
            <Text style={styles.successTitle}>{t('resultScreen_addedTitle')}</Text>
            <Text style={styles.successBody}>
              {t('resultScreen_addedBody', { name: scannedItem.metadata.name || scannedItem.metadata.type })}
            </Text>
            <PrimaryButton onPress={handleViewWardrobe}>{t('resultScreen_viewWardrobe')}</PrimaryButton>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.color.canvas,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.color.canvas,
    padding: T.s(6),
    gap: T.s(4),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: T.s(4),
    paddingVertical: T.s(3),
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -T.s(2),
  },
  headerLabel: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: T.s(6),
    paddingTop: T.s(4),
  },
  identity: {
    marginTop: T.s(4),
    gap: T.s(1),
  },
  itemName: {
    fontFamily: T.font.serif,
    fontSize: 22,
    fontWeight: '400',
    color: T.color.primary,
    lineHeight: 26,
  },
  itemBrand: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
  },
  chipGrid: {
    marginTop: T.s(4),
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    width: '50%',
    padding: T.s(3),
  },
  chipBorderRight: {
    borderRightWidth: 0.5,
    borderRightColor: T.color.hairline,
  },
  chipBorderBottom: {
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
  },
  chipLabel: {
    ...type.ui,
    fontSize: 8.5,
    color: T.color.tertiary,
  },
  chipValue: {
    fontFamily: T.font.serif,
    fontSize: 14,
    color: T.color.primary,
    marginTop: T.s(1),
  },
  measureSection: {
    marginTop: T.s(5),
  },
  measureSectionLabel: {
    ...type.ui,
    fontSize: 8.5,
    color: T.color.tertiary,
    marginBottom: T.s(3),
  },
  measureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.s(3),
  },
  measureCell: {
    width: '47%',
  },
  mixMatchCta: {
    marginTop: T.s(6),
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.s(3),
    backgroundColor: T.color.primary,
    paddingVertical: T.s(4),
    paddingHorizontal: T.s(4),
  },
  mixMatchIcon: {
    width: 42,
    height: 42,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixMatchCopy: {
    flex: 1,
  },
  mixMatchTitle: {
    fontFamily: T.font.serif,
    fontSize: 18,
    color: T.color.canvas,
  },
  mixMatchSub: {
    ...type.caption,
    fontSize: 11.5,
    color: T.color.canvas,
    opacity: 0.7,
    marginTop: T.s(1),
  },
  gapFillBanner: {
    marginTop: T.s(5),
    paddingVertical: T.s(3),
    paddingHorizontal: T.s(4),
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    backgroundColor: T.color.elevated,
  },
  gapFillText: {
    ...type.caption,
    fontSize: 12,
    color: T.color.secondary,
    fontStyle: 'italic',
    fontFamily: T.font.serifLight,
  },
  gapFillUnlockText: {
    ...type.ui,
    fontSize: 10,
    color: T.color.tertiary,
    marginTop: T.s(1.5),
  },
  evaluatingState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.s(3),
    paddingVertical: T.s(6),
  },
  evaluatingLabel: {
    ...type.body,
    color: T.color.secondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.color.elevated,
    borderWidth: 0.5,
    borderColor: T.color.error,
    paddingHorizontal: T.s(4),
    paddingVertical: T.s(3),
    marginTop: T.s(4),
    gap: T.s(2),
  },
  errorText: {
    ...type.body,
    color: T.color.error,
    flex: 1,
  },
  retryLabel: {
    ...type.ui,
    fontSize: 9,
    color: T.color.primary,
  },
  caption: {
    ...type.caption,
    color: T.color.secondary,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: T.s(4),
    paddingVertical: T.s(2),
    borderWidth: 0.5,
    borderColor: T.color.primary,
  },
  retryBtnLabel: {
    ...type.ui,
    fontSize: 9,
    color: T.color.primary,
  },
  bottomSpacer: {
    height: T.s(8),
  },
  stickyBar: {
    paddingHorizontal: T.s(6),
    paddingTop: T.s(3),
    backgroundColor: T.color.canvas,
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
  },
  passBtn: {
    alignItems: 'center',
    paddingVertical: T.s(3),
    marginTop: T.s(1),
  },
  passLabel: {
    ...type.caption,
    color: T.color.tertiary,
    textDecorationLine: 'underline',
  },
  addError: {
    ...type.caption,
    fontSize: 12,
    color: T.color.error,
    textAlign: 'center',
    marginBottom: T.s(2),
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,24,21,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: T.s(6),
  },
  successCard: {
    width: '100%',
    maxWidth: CONTENT_MAX,
    backgroundColor: T.color.canvas,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    padding: T.s(6),
    alignItems: 'center',
    gap: T.s(3),
  },
  successCheck: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: T.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.s(1),
  },
  successTitle: {
    ...type.h2,
    color: T.color.primary,
    textAlign: 'center',
  },
  successBody: {
    ...type.caption,
    color: T.color.secondary,
    textAlign: 'center',
    marginBottom: T.s(2),
  },
});
