// Try On (feature 008) — T020
// Scan Result + Verdict screen. Composes ItemOnWhite + extracted attributes + VerdictPanel.
// On mount, if verdict is null, triggers evaluate(). Thin — all logic via useTryOn.
//
// US2 and US3 placeholders are clearly marked below.

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T, type } from '../../../design/tokens';
import { PrimaryButton } from '../../../components/ui';
import {
  IconChevronLeft, IconChevronRight, IconX, IconLayers, IconCheck,
} from '../../../components/icons';
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
  const {
    status, scannedItem, verdict, error, mixMatchOutfits,
    evaluate, discard, fetchMixMatch, addToWardrobe,
  } = useTryOn();

  // Trigger evaluation on mount if verdict is not yet available
  useEffect(() => {
    if (scannedItem && !verdict) {
      evaluate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (mixMatchOutfits.length === 0) fetchMixMatch();
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

        {/* ── Mix & match with closet (US2) ───────────────────────────────────── */}
        <Pressable onPress={handleMixMatch} style={styles.mixMatchCta}>
          <View style={styles.mixMatchIcon}>
            <IconLayers size={20} strokeWidth={1.3} color={T.color.canvas} />
          </View>
          <View style={styles.mixMatchCopy}>
            <Text style={styles.mixMatchTitle}>Mix &amp; match with closet</Text>
            <Text style={styles.mixMatchSub}>
              {mixMatchOutfits.length > 0
                ? `${mixMatchOutfits.length} outfits we'd build around this from what you own.`
                : "Outfits we'd build around this from what you own."}
            </Text>
          </View>
          <IconChevronRight size={15} strokeWidth={1.4} color={T.color.canvas} />
        </Pressable>

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

      {/* ── Decide · Buy or Pass (US3) ──────────────────────────────────────── */}
      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + T.s(3) }]}>
        {error && !adding ? (
          <Text style={styles.addError}>{error}</Text>
        ) : null}
        <PrimaryButton onPress={handleAdd} disabled={adding}>
          {adding ? 'ADDING…' : 'ADD TO WARDROBE'}
        </PrimaryButton>
        <Pressable onPress={handleBack} hitSlop={8} style={styles.passBtn} disabled={adding}>
          <Text style={styles.passLabel}>Not for me</Text>
        </Pressable>
      </View>

      {/* ── Success affordance after Add (T036) ─────────────────────────────── */}
      {justAdded ? (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successCheck}>
              <IconCheck size={22} strokeWidth={1.5} color={T.color.primary} />
            </View>
            <Text style={styles.successTitle}>Added to your wardrobe</Text>
            <Text style={styles.successBody}>
              {scannedItem.metadata.name || scannedItem.metadata.type} is now part
              of your closet and will appear in outfit suggestions.
            </Text>
            <PrimaryButton onPress={handleViewWardrobe}>VIEW WARDROBE</PrimaryButton>
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
