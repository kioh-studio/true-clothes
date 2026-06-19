// Try On (feature 008) — T020
// Scan Result + Verdict screen. Composes ItemOnWhite + extracted attributes + VerdictPanel.
// On mount, if verdict is null, triggers evaluate(). Thin — all logic via useTryOn.
//
// US2 and US3 placeholders are clearly marked below.

import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T, type } from '../../../design/tokens';
import { SecondaryButton } from '../../../components/ui';
import { IconChevronLeft, IconX } from '../../../components/icons';
import { useTryOn } from '../useTryOn';
import { ItemOnWhite } from './ItemOnWhite';
import { VerdictPanel } from './VerdictPanel';

// Attribute chips shown below the product image
const CHIP_KEYS = [
  { key: 'type',         label: 'CATEGORY' },
  { key: 'color',        label: 'COLOR' },
  { key: 'material',     label: 'MATERIAL' },
  { key: 'fit',          label: 'FIT' },
  { key: 'warmthSeason', label: 'SEASON' },
  { key: 'pattern',      label: 'PATTERN' },
] as const;

type ChipKey = typeof CHIP_KEYS[number]['key'];

export function ResultScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status, scannedItem, verdict, error, evaluate, reset } = useTryOn();

  // Trigger evaluation on mount if verdict is not yet available
  useEffect(() => {
    if (scannedItem && !verdict) {
      evaluate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isEvaluating = status === 'evaluating' && !verdict;

  const handleBack = () => {
    reset();
    router.back();
  };

  // If we have no scannedItem (e.g. deep-linked), redirect back to scan
  if (!scannedItem) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.caption}>No item scanned yet.</Text>
        <Pressable onPress={() => router.back()} style={styles.retryBtn}>
          <Text style={styles.retryBtnLabel}>SCAN AN ITEM</Text>
        </Pressable>
      </View>
    );
  }

  const meta = scannedItem.metadata;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
          <IconChevronLeft size={18} strokeWidth={1.3} color={T.color.primary} />
        </Pressable>
        <Text style={styles.headerLabel}>SCAN RESULT</Text>
        <View style={styles.headerRight} />
      </View>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
                <Text style={styles.chipLabel}>{c.label}</Text>
                <Text style={styles.chipValue}>
                  {String(displayValue)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── US2 PLACEHOLDER: Mix & Match CTA ────────────────────────────────
         * TODO(US2/T030): Replace this placeholder with the Mix & Match button.
         * The button should call fetchMixMatch() from useTryOn() and then
         * navigate to '/try-on/mix-match'. Display outfit count when available.
         * ──────────────────────────────────────────────────────────────────── */}
        <View style={styles.mixMatchPlaceholder}>
          <Text style={styles.mixMatchPlaceholderText}>
            {/* US2: Mix & match CTA will appear here */}
            MIX & MATCH — Coming in US2
          </Text>
        </View>

        {/* ── Verdict ──────────────────────────────────────────────────────── */}
        {isEvaluating && !verdict ? (
          <View style={styles.evaluatingState}>
            <ActivityIndicator size="small" color={T.color.primary} />
            <Text style={styles.evaluatingLabel}>Scoring this item…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={evaluate} hitSlop={8}>
              <Text style={styles.retryLabel}>RETRY</Text>
            </Pressable>
            <Pressable onPress={() => {}} hitSlop={8}>
              <IconX size={12} strokeWidth={1.4} color={T.color.error} />
            </Pressable>
          </View>
        ) : null}

        {verdict ? <VerdictPanel verdict={verdict} /> : null}

        {/* Bottom padding for sticky bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ── US3 PLACEHOLDER: Sticky Add / No controls ───────────────────────
       * TODO(US3/T033,T034): Replace this placeholder with the sticky decision
       * bar. It should contain:
       *   - PrimaryButton "ADD TO WARDROBE" → calls addToWardrobe()
       *   - TextLink or SecondaryButton "Not for me" → calls discard()
       * Both should only be visible when status === 'result'.
       * ─────────────────────────────────────────────────────────────────── */}
      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + T.s(3) }]}>
        <View style={styles.addNoPlaceholder}>
          <Text style={styles.addNoPlaceholderText}>
            {/* US3: Add / No controls will appear here */}
            ADD / NO DECISION — Coming in US3
          </Text>
        </View>
      </View>
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
  mixMatchPlaceholder: {
    marginTop: T.s(6),
    padding: T.s(4),
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  mixMatchPlaceholderText: {
    ...type.ui,
    fontSize: 9,
    color: T.color.muted,
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
  addNoPlaceholder: {
    padding: T.s(4),
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addNoPlaceholderText: {
    ...type.ui,
    fontSize: 9,
    color: T.color.muted,
  },
});
