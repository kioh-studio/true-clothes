// Try On (feature 008) — T029
// One full-bleed Mix & Match outfit card: the scanned item ("considering"),
// framed and anchored, surrounded by the owned wardrobe pieces it pairs with,
// plus the match score, a title/rationale, and a thumbnail strip.
//
// The pinned slot id "scanned" is NOT a wardrobe/mock item, so it can't be
// resolved through OutfitCollage (which looks items up by id). We render it
// directly from the scanned item's local cut-out image and resolve the other
// slots — owned pieces — via OutfitItemThumb. Thin & token-only (Constitution I/II).

import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { T, type } from '../../../design/tokens';
import { OutfitItemThumb } from '../../../components/outfit/Collage';
import type { ScannedItem } from '../../../types/tryOn';
import type { ScoredOutfit } from '../../../types/fitEngine';
import { useTranslation } from '../../../i18n';

const TITLE_KEYS = [
  'matchFeedCard_titleConsideredBuy', 'matchFeedCard_titleNewAnchor',
  'matchFeedCard_titleEarnsItsPlace', 'matchFeedCard_titleBuiltAroundIt',
  'matchFeedCard_titleEasyWin', 'matchFeedCard_titleWorthTheCloset',
  'matchFeedCard_titleQuietlyVersatile', 'matchFeedCard_titleThreeWaysIn',
];

// Closet-cutout float positions around the framed candidate (percentages of the
// collage stage). Up to three owned pieces surface per card.
const FLOAT_SLOTS = [
  { top: '8%' as const,  right: '6%' as const,  width: '34%' as const, height: '34%' as const },
  { top: '42%' as const, right: '12%' as const, width: '30%' as const, height: '30%' as const },
  { bottom: '6%' as const, right: '20%' as const, width: '30%' as const, height: '30%' as const },
];

export function pieceIds(outfit: ScoredOutfit, pinId: string): string[] {
  const { top, bottom, shoes, outwear, accessory, mid } = outfit.slots;
  return [...new Set([top, bottom, shoes, outwear, accessory, mid])]
    .filter((id): id is string => !!id && id !== pinId);
}

interface Props {
  scannedItem: ScannedItem;
  outfit: ScoredOutfit;
  index: number;
  /** Page height for the full-bleed card (set by the pager). */
  height: number;
  /** Open the AI "wear on you" flow for this outfit (scanned item included). */
  onWear?: () => void;
}

export function MatchFeedCard({ scannedItem, outfit, index, height, onWear }: Props) {
  const { t } = useTranslation();
  const pieces = pieceIds(outfit, scannedItem.id);
  const score = Math.round(Math.max(0, Math.min(1, outfit.totalScore)) * 100);
  const title = t(TITLE_KEYS[index % TITLE_KEYS.length]);
  const rationale =
    outfit.stylistNote ||
    t('matchFeedCard_rationale', { count: pieces.length, suffix: pieces.length === 1 ? '' : 's' });

  return (
    <View style={[styles.card, { height }]}>
      {/* ── Collage stage ───────────────────────────────────────────────────── */}
      <View style={styles.stage}>
        {/* Candidate — framed product card, the anchor */}
        <View style={styles.candidateFrame}>
          {scannedItem.localImageUri ? (
            <Image
              source={{ uri: scannedItem.localImageUri }}
              style={styles.candidateImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.candidatePlaceholder}>
              <Text style={styles.placeholderText}>
                {scannedItem.metadata.type}
              </Text>
            </View>
          )}
          <View style={styles.consideringTag}>
            <Text style={styles.consideringText}>{t('matchFeedCard_considering')}</Text>
          </View>
        </View>

        {/* Owned pieces float around the candidate */}
        {pieces.slice(0, 3).map((id, i) => (
          <OutfitItemThumb
            key={id}
            id={id}
            style={[styles.float, FLOAT_SLOTS[i]]}
            imageStyle={styles.floatImage}
            fallbackStyle={styles.floatFallback}
          />
        ))}

        {/* Match score, bottom-left */}
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreLabel}>{t('matchFeedCard_matchScore')}</Text>
          <Text style={styles.scoreValue}>{score}</Text>
        </View>
      </View>

      {/* ── Bottom meta strip ───────────────────────────────────────────────── */}
      <View style={styles.meta}>
        <View style={styles.metaHeader}>
          <Text style={styles.metaTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.metaCount}>
            {t('matchFeedCard_fromCloset', { count: pieces.length })}
          </Text>
        </View>
        <Text style={styles.metaRationale} numberOfLines={2}>{rationale}</Text>

        {/* Candidate + closet thumbnails, with the AI try-on action at the end */}
        <View style={styles.thumbRow}>
          <View style={styles.candidateThumb}>
            {scannedItem.localImageUri ? (
              <Image
                source={{ uri: scannedItem.localImageUri }}
                style={styles.thumbImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.thumbFallback}>{scannedItem.metadata.type}</Text>
            )}
          </View>
          <Text style={styles.plus}>+</Text>
          {pieces.map((id) => (
            <OutfitItemThumb
              key={id}
              id={id}
              style={styles.pieceThumb}
              imageStyle={styles.thumbImage}
              fallbackStyle={styles.thumbFallback}
            />
          ))}
          {onWear ? (
            <>
              <View style={{ flex: 1 }} />
              <Pressable onPress={onWear} hitSlop={10} style={styles.wearBtn}>
                <Text style={styles.wearBtnLabel}>{t('matchFeedCard_seeItOnYou')}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: T.color.canvas,
  },
  stage: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  // No white card — the scanned item is a transparent PNG that floats on the
  // stage like the owned pieces, so the feed reads like a normal outfit card.
  candidateFrame: {
    position: 'absolute',
    top: '12%',
    left: '6%',
    width: '50%',
    aspectRatio: 3 / 4,
  },
  candidateImage: {
    width: '100%',
    height: '100%',
  },
  candidatePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.color.elevated,
  },
  placeholderText: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
  },
  consideringTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    backgroundColor: T.color.primary,
    paddingHorizontal: T.s(2),
    paddingVertical: T.s(1),
  },
  consideringText: {
    ...type.ui,
    fontSize: 8,
    color: T.color.canvas,
  },
  float: {
    position: 'absolute',
  },
  floatImage: {
    width: '100%',
    height: '100%',
  },
  floatFallback: {
    ...type.ui,
    fontSize: 8,
    color: T.color.tertiary,
    textAlign: 'center',
  },
  scoreBlock: {
    position: 'absolute',
    bottom: '3%',
    left: T.s(6),
  },
  scoreLabel: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
  },
  scoreValue: {
    fontFamily: T.font.serif,
    fontSize: 44,
    fontWeight: '300',
    color: T.color.primary,
    lineHeight: 46,
  },
  meta: {
    height: '24%',
    backgroundColor: T.color.canvas,
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
    paddingHorizontal: T.s(6),
    paddingTop: T.s(3),
    justifyContent: 'space-between',
  },
  metaHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: T.s(3),
  },
  metaTitle: {
    fontFamily: T.font.serif,
    fontSize: 19,
    color: T.color.primary,
    flex: 1,
  },
  metaCount: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
  },
  metaRationale: {
    ...type.caption,
    fontSize: 12,
    color: T.color.tertiary,
    marginTop: T.s(2),
  },
  thumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.s(2),
    paddingBottom: T.s(3),
  },
  candidateThumb: {
    width: 44,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: T.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  pieceThumb: {
    width: 44,
    height: 56,
    backgroundColor: T.color.elevated,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    ...type.ui,
    fontSize: 7,
    color: T.color.tertiary,
    textAlign: 'center',
  },
  plus: {
    ...type.ui,
    fontSize: 12,
    color: T.color.tertiary,
  },
  wearBtn: {
    height: 40,
    paddingHorizontal: T.s(3),
    borderWidth: 0.5,
    borderColor: T.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wearBtnLabel: {
    ...type.ui,
    fontSize: 9,
    color: T.color.primary,
  },
});
