// Wardrobe Critic (feature 010) — T022
// One gap recommendation, rendered stylist-note style: archetype label, the
// "unlocks N looks" proof point, the stylist's note, a small collage of the
// real items it would pair with, and two hairline text actions.
//
// `locked` renders the free-tier teaser row (FR-010): content is dimmed under
// a translucent scrim with an uppercase "PREMIUM" micro-label — no separate
// lock-icon asset, consistent with the hairline/no-gradient aesthetic — and
// the actions are inert (tapping does nothing until upgrade).

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { T, type } from '../../../design/tokens';
import { OutfitItemThumb } from '../../../components/outfit/Collage';
import { GapRecommendation } from '../../../types/wardrobeCritic';
import { useTranslation } from '../../../i18n';

interface GapCardProps {
  rec: GapRecommendation;
  /** Free-tier teaser: content dimmed, actions inert (FR-010). */
  locked?: boolean;
  onDismiss: () => void;
  onTryOn: () => void;
}

export function GapCard({ rec, locked = false, onDismiss, onTryOn }: GapCardProps) {
  const { t, i18n } = useTranslation();
  const vi = !!i18n.language?.startsWith('vi');
  const label = vi ? rec.label.vi : rec.label.en;
  const note = vi ? rec.note.vi : rec.note.en;
  const unlockLabel = t('gapCard_unlocks', {
    count: rec.unlockCount,
    suffix: rec.unlockCount === 1 ? '' : 's',
  });

  // Flatten sample outfits into a single de-duplicated row of real item ids.
  const sampleIds = Array.from(new Set(rec.sampleOutfits.flat())).slice(0, 5);

  return (
    <View style={styles.card}>
      <View style={[styles.content, locked && styles.contentDimmed]} pointerEvents={locked ? 'none' : 'auto'}>
        <Text style={styles.unlockLabel}>{unlockLabel}</Text>
        <Text style={styles.label}>{label}</Text>
        {!!note && <Text style={styles.note}>{note}</Text>}

        {sampleIds.length > 0 && (
          <View style={styles.thumbRow}>
            {sampleIds.map((id) => (
              <View key={id} style={styles.thumbBox}>
                <OutfitItemThumb
                  id={id}
                  style={styles.thumbInner}
                  imageStyle={styles.thumbImg}
                  fallbackStyle={styles.thumbFallback}
                />
              </View>
            ))}
          </View>
        )}

        <View style={styles.actionsRow}>
          <Pressable onPress={onTryOn} hitSlop={8}>
            <Text style={styles.tryOnText}>
              {t('gapCard_tryWhenShopping')}
            </Text>
          </Pressable>
          <Pressable onPress={onDismiss} hitSlop={8}>
            <Text style={styles.dismissText}>{t('gapCard_dismiss')}</Text>
          </Pressable>
        </View>
      </View>

      {locked && (
        <View style={styles.lockOverlay} pointerEvents="none">
          <Text style={styles.lockLabel}>{t('gapCard_premium')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    padding: T.s(5),
    position: 'relative',
    overflow: 'hidden',
  },
  content: {},
  contentDimmed: {
    opacity: 0.25,
  },
  unlockLabel: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
    letterSpacing: 1.5,
  },
  label: {
    fontFamily: T.font.serif,
    fontSize: 22,
    fontWeight: '400',
    color: T.color.primary,
    marginTop: T.s(2),
    lineHeight: 26,
  },
  note: {
    fontFamily: T.font.serifLight,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 20,
    color: T.color.secondary,
    marginTop: T.s(2),
  },
  thumbRow: {
    flexDirection: 'row',
    gap: T.s(2),
    marginTop: T.s(4),
  },
  thumbBox: {
    width: 44, height: 56,
    backgroundColor: T.color.elevated,
    borderWidth: 0.5, borderColor: T.color.hairline,
    alignItems: 'center', justifyContent: 'center', padding: 4,
  },
  thumbInner: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: '100%', height: '100%' },
  thumbFallback: { ...type.micro, fontSize: 7, color: T.color.tertiary, textAlign: 'center', lineHeight: 10 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: T.s(5),
    paddingTop: T.s(3),
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
  },
  tryOnText: {
    ...type.ui,
    fontSize: 10,
    color: T.color.primary,
  },
  dismissText: {
    ...type.ui,
    fontSize: 10,
    color: T.color.tertiary,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.color.overlay,
  },
  lockLabel: {
    ...type.micro,
    fontSize: 10,
    color: T.color.secondary,
    letterSpacing: 3,
  },
});
