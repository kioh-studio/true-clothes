// Try On (feature 008) — T030
// Mix & Match swipe feed: a Home-style vertical pager of complete outfits, each
// built around the scanned item. Fetches on mount; shows a loading, sparse, or
// error state as needed. Thin — all logic via useTryOn (Constitution II).

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T, type } from '../../../design/tokens';
import { Bounded } from '../../../components/ui/Bounded';
import { IconChevronLeft } from '../../../components/icons';
import { useTryOn } from '../useTryOn';
import { MatchFeedCard, pieceIds } from './MatchFeedCard';
import type { ScoredOutfit } from '../../../types/fitEngine';
import { useTranslation } from '../../../i18n';

export function MixMatchFeed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const {
    scannedItem, mixMatchOutfits, mixMatchLoading, error, fetchMixMatch,
  } = useTryOn();

  const [viewportH, setViewportH] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const didFetch = useRef(false);

  // Fetch once on mount if we don't already have results.
  useEffect(() => {
    if (didFetch.current) return;
    if (scannedItem && mixMatchOutfits.length === 0 && !mixMatchLoading) {
      didFetch.current = true;
      fetchMixMatch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (viewportH <= 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.y / viewportH);
    setActiveIdx((prev) => (i !== prev ? i : prev));
  }, [viewportH]);

  const goBack = () => router.back();

  // AI "wear on you" for a Mix & Match outfit: pass the OWNED item ids as the
  // outfit, and the scanned candidate as the `extra` garment (it has no cloud
  // photo yet, so the generator receives it as a text-described piece).
  const onWear = useCallback((outfit: ScoredOutfit, index: number) => {
    if (!scannedItem) return;
    const md = scannedItem.metadata;
    const owned = pieceIds(outfit, scannedItem.id);
    // A pinned WARDROBE item (build-around-item) has a real id + cloud photo —
    // send it as a normal outfit item so the generator gets its actual image.
    // A transient scan (not in the wardrobe yet) rides the `extra` param as a
    // text-described garment instead.
    const isOwnedPin = Boolean(scannedItem.sourceItemId);
    const itemIds = isOwnedPin ? [scannedItem.sourceItemId!, ...owned] : owned;
    router.push({
      pathname: '/try-on/wear' as any,
      params: {
        id: `mixmatch-${index}`,
        data: JSON.stringify({
          id: `mixmatch-${index}`,
          title: md.name || md.type,
          style: 'MIX & MATCH',
          context: isOwnedPin ? 'FROM CLOSET' : 'CONSIDERING',
          itemIds,
        }),
        ...(isOwnedPin ? {} : {
          extra: JSON.stringify({
            type: md.type, name: md.name, color: md.color,
            material: md.material, fit: md.fit,
          }),
        }),
      },
    });
  }, [scannedItem, router]);

  const renderCard = useCallback(({ item, index }: { item: ScoredOutfit; index: number }) => (
    <MatchFeedCard
      scannedItem={scannedItem!}
      outfit={item}
      index={index}
      height={viewportH}
      onWear={() => onWear(item, index)}
    />
  ), [scannedItem, viewportH, onWear]);

  // No item (deep-link / lost session) → send back to scan.
  if (!scannedItem) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.caption}>{t('mixMatchFeed_noItem')}</Text>
        <Pressable onPress={goBack} hitSlop={8} style={styles.backLink}>
          <Text style={styles.backLinkLabel}>{t('mixMatchFeed_goBack')}</Text>
        </Pressable>
      </View>
    );
  }

  const showLoading = mixMatchLoading && mixMatchOutfits.length === 0;
  const showSparse = !mixMatchLoading && !error && mixMatchOutfits.length === 0;

  return (
    <View style={styles.container}>
      {/* Feed viewport */}
      <View
        style={styles.feed}
        onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
      >
        {showLoading ? (
          <View style={styles.stateCenter}>
            <ActivityIndicator size="large" color={T.color.primary} />
            <Text style={styles.stateLabel}>{t('mixMatchFeed_building')}</Text>
          </View>
        ) : error && mixMatchOutfits.length === 0 ? (
          <View style={styles.stateCenter}>
            <Text style={styles.stateLabel}>{error}</Text>
            <Pressable
              onPress={() => fetchMixMatch()}
              hitSlop={8}
              style={styles.retryBtn}
            >
              <Text style={styles.retryLabel}>{t('measurementsScan_tryAgain')}</Text>
            </Pressable>
          </View>
        ) : showSparse ? (
          <View style={styles.stateCenter}>
            <Text style={styles.sparseTitle}>{t('mixMatchFeed_sparseTitle')}</Text>
            <Text style={styles.sparseBody}>
              {t('mixMatchFeed_sparseBody')}
            </Text>
          </View>
        ) : viewportH > 0 ? (
          <FlatList
            data={mixMatchOutfits}
            keyExtractor={(_, i) => `mm-${i}`}
            renderItem={renderCard}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={viewportH}
            snapToAlignment="start"
            decelerationRate="fast"
            onScroll={onScroll}
            scrollEventThrottle={16}
            getItemLayout={(_, index) => ({
              length: viewportH, offset: viewportH * index, index,
            })}
          />
        ) : null}

        {/* Top overlay — back + matching context */}
        <View style={[styles.topOverlay, { paddingTop: insets.top + T.s(2) }]} pointerEvents="box-none">
          <Pressable onPress={goBack} hitSlop={10} style={styles.backChip}>
            <IconChevronLeft size={18} strokeWidth={1.5} color={T.color.primary} />
          </Pressable>
          <View style={styles.matchingChip}>
            <Text style={styles.matchingLabel}>{t('mixMatchFeed_matching')}</Text>
            <Text style={styles.matchingName} numberOfLines={1}>
              {scannedItem.metadata.name || scannedItem.metadata.type}
            </Text>
          </View>
        </View>

        {/* Page dots */}
        {mixMatchOutfits.length > 1 ? (
          <View style={styles.dots} pointerEvents="none">
            {mixMatchOutfits.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === activeIdx ? styles.dotActive : null]}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* Bottom action — back to result */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + T.s(3) }]}>
        <Bounded>
          <Pressable onPress={goBack} style={styles.backToResult} hitSlop={6}>
            <IconChevronLeft size={15} strokeWidth={1.5} color={T.color.primary} />
            <Text style={styles.backToResultLabel}>{t('mixMatchFeed_backToResult')}</Text>
          </Pressable>
        </Bounded>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  feed: { flex: 1, position: 'relative' },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.color.canvas, padding: T.s(6), gap: T.s(4),
  },
  stateCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    padding: T.s(8), gap: T.s(4),
  },
  stateLabel: { ...type.body, color: T.color.secondary, textAlign: 'center' },
  sparseTitle: { ...type.h2, color: T.color.primary, textAlign: 'center' },
  sparseBody: { ...type.caption, color: T.color.secondary, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: T.s(4), paddingVertical: T.s(2),
    borderWidth: 0.5, borderColor: T.color.primary,
  },
  retryLabel: { ...type.ui, fontSize: 9, color: T.color.primary },
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
    paddingHorizontal: T.s(4),
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backChip: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.color.elevated, borderWidth: 0.5, borderColor: T.color.hairline,
    alignItems: 'center', justifyContent: 'center',
  },
  matchingChip: {
    backgroundColor: T.color.elevated, borderWidth: 0.5, borderColor: T.color.hairline,
    paddingHorizontal: T.s(3), paddingVertical: T.s(2), alignItems: 'flex-end', maxWidth: '60%',
  },
  matchingLabel: { ...type.ui, fontSize: 8.5, color: T.color.tertiary },
  matchingName: {
    fontFamily: T.font.serif, fontSize: 14, color: T.color.primary, marginTop: 1,
  },
  dots: {
    position: 'absolute', right: T.s(2), top: '50%', zIndex: 30,
    gap: T.s(2),
  },
  dot: {
    width: 5, height: 5, borderRadius: 3, backgroundColor: T.color.hairlineStrong,
  },
  dotActive: { height: 16, backgroundColor: T.color.primary },
  bottomBar: {
    paddingHorizontal: T.s(6), paddingTop: T.s(3),
    backgroundColor: T.color.canvas,
    borderTopWidth: 0.5, borderTopColor: T.color.hairline,
  },
  backToResult: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: T.s(2),
    height: 48, borderWidth: 0.5, borderColor: T.color.primary,
  },
  backToResultLabel: { ...type.ui, color: T.color.primary },
  caption: { ...type.caption, color: T.color.secondary, textAlign: 'center' },
  backLink: {
    paddingHorizontal: T.s(4), paddingVertical: T.s(2),
    borderWidth: 0.5, borderColor: T.color.primary,
  },
  backLinkLabel: { ...type.ui, fontSize: 9, color: T.color.primary },
});
