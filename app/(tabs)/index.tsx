// Home — Outfit Feed (TikTok-style vertical pager)
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, useWindowDimensions, Share,
} from 'react-native';
import { useRouter, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { OUTFITS, Outfit } from '../../src/data';
import { OutfitCollage, OutfitItemThumb } from '../../src/components/outfit/Collage';
import { BottomNav } from '../../src/components/ui/BottomNav';
import { BottomSheet, TextLink } from '../../src/components/ui';
import { useAppStore } from '../../src/stores/appStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useFitEngineStore } from '../../src/stores/fitEngineStore';
import { useWardrobeCriticStore } from '../../src/stores/wardrobeCriticStore';
import { useFitFeed } from '../../src/features/feed/useFitFeed';
import {
  IconHeart, IconCalendar, IconSparkle, IconShare, IconThermometer, IconMenu, IconBook,
} from '../../src/components/icons';
import { useTranslation } from '../../src/i18n';
import { MEDIA_MAX } from '../../src/design/layout';

// T022: 2 curated demo outfits for empty wardrobe state
const DEMO_OUTFITS = OUTFITS.slice(0, 2);

// Display-tag helpers (2026-07-12) — silhouette + dominant colour on the feed
// card meta line. Both are display-only (see ScoredOutfit.silhouette/colorTone,
// engine/silhouette.ts + engine/scoring.ts) and never affect ranking.
const SILHOUETTE_I18N_KEYS: Record<string, string> = {
  fitted: 'outfitSilhouette_fitted',
  straight: 'outfitSilhouette_straight',
  relaxed: 'outfitSilhouette_relaxed',
  'top-volume': 'outfitSilhouette_topVolume',
  'bottom-volume': 'outfitSilhouette_bottomVolume',
};

// Silhouette family has a translated vocabulary; resolve + uppercase to match
// the existing `outfit.style`/`outfit.weather` casing on the meta line.
function silhouetteMetaLabel(t: (key: string) => string, silhouette?: string): string | undefined {
  if (!silhouette) return undefined;
  const key = SILHOUETTE_I18N_KEYS[silhouette];
  if (!key) return undefined;
  return t(key).toUpperCase();
}

// Geometric-shape tag for the RESULTING BODY silhouette (2026-07-12) — the
// user's body_shape baseline as modified by the outfit's garment volume, NOT
// a relabel of `silhouette` (see engine/silhouette.ts resultingBodySilhouette).
// Shown as an additional chip right after the descriptive silhouette tag;
// never replaces it.
const SHAPE_I18N_KEYS: Record<string, string> = {
  'hourglass': 'outfitShape_hourglass',
  'rectangle': 'outfitShape_rectangle',
  'oval': 'outfitShape_oval',
  'inverted-triangle': 'outfitShape_invertedTriangle',
  'triangle': 'outfitShape_triangle',
};

function silhouetteShapeMetaLabel(t: (key: string) => string, shape?: string): string | undefined {
  if (!shape) return undefined;
  const key = SHAPE_I18N_KEYS[shape];
  if (!key) return undefined;
  return t(key).toUpperCase();
}

// Colour NAMEs (PrimaryColor, ~37 values) don't have a translated vocabulary
// yet (see backlog.md) — render capitalized in both locales for now.
function colorToneMetaLabel(colorTone?: string): string | undefined {
  if (!colorTone) return undefined;
  return colorTone.toUpperCase();
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [activeIdx, setActiveIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const listRef = useRef<FlatList<Outfit>>(null);

  const { savedSet, toggleSave, toggleSchedule, items, wardrobeItems, weatherContext } = useAppStore();
  const { logout } = useAuthStore();
  const { feedError, fetchOutfits, fetchMoreOutfits, isFetchingMore } = useFitEngineStore();
  const { outfits: generatedOutfits, isGenerated } = useFitFeed();

  // 010-wardrobe-critic: background refresh (cache-hit is a no-op — cheap) so
  // the end-of-feed stylist card reflects the latest report without the user
  // ever having to open Wardrobe Report first.
  const wardrobeCriticFetchReport = useWardrobeCriticStore((s) => s.fetchReport);
  const hasWardrobeGaps = useWardrobeCriticStore((s) => s.visibleRecommendations().length > 0);
  useEffect(() => { wardrobeCriticFetchReport(); }, [wardrobeCriticFetchReport]);

  // T022: Empty wardrobe → show 2 curated demo outfits. The weather FILTER bar was
  // removed (it gated on each outfit's `weather`, but generated outfits all carry a
  // hardcoded '22°C', so the live-band default emptied the feed on hot/cold days for
  // no real benefit). Live weather still drives the engine's seasonal scoring via
  // fitEngineStore.weatherIntent() and the °C label below — only the UI filter is gone.
  const isDemo = wardrobeItems.length === 0;
  const feed: Outfit[] = isDemo
    ? DEMO_OUTFITS
    : isGenerated ? generatedOutfits : OUTFITS;

  // Page height must equal the FlatList's real viewport, or every snap leaves
  // a sliver of the neighbouring card visible. Window dimensions are
  // unreliable on Android edge-to-edge, so measure the list itself; the
  // formula is only the pre-layout estimate.
  const { height: winH } = useWindowDimensions();
  const [pageH, setPageH] = useState(0);
  const CARD_H = pageH || winH - insets.bottom - 64;

  // Guard against double-tap pushing the outfit detail route twice while the
  // first navigation is still in flight.
  const openOutfitInFlightRef = useRef(false);
  const openOutfit = useCallback((outfit: Outfit) => {
    if (openOutfitInFlightRef.current) return;
    openOutfitInFlightRef.current = true;
    router.push({ pathname: '/outfit/[id]', params: { id: outfit.id, data: JSON.stringify(outfit) } });
    setTimeout(() => { openOutfitInFlightRef.current = false; }, 400);
  }, [router]);

  const onAddItems = useCallback(() => {
    router.replace('/(tabs)/wardrobe');
  }, [router]);

  // T023: retry handler
  const handleRetry = () => { fetchOutfits(); };

  const weatherLabel = weatherContext
    ? `${Math.round(weatherContext.temperatureCelsius)}°C`
    : t('tabs_home_weatherLabel');

  const renderCard = useCallback(({ item: outfit, index }: { item: Outfit; index: number }) => (
    <FeedCard
      outfit={outfit}
      active={index === activeIdx}
      cardH={CARD_H}
      saved={savedSet.has(outfit.id)}
      isDemo={isDemo}
      topInset={insets.top}
      onOpen={openOutfit}
      onToggleSave={toggleSave}
      onToggleSchedule={toggleSchedule}
      onAddItems={onAddItems}
    />
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [activeIdx, CARD_H, savedSet, isDemo, insets.top, openOutfit, toggleSave, toggleSchedule, onAddItems]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Top overlay */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
        {/* T023: Error retry banner */}
        {feedError && (
          <Pressable onPress={handleRetry} style={styles.errorBanner} pointerEvents="auto">
            <Text style={styles.errorBannerText}>{t('tabs_home_errorBanner')}</Text>
          </Pressable>
        )}
        <View style={styles.topRow}>
          <Text style={styles.brand}>{t('tabs_home_brand')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <IconThermometer size={13} color={T.color.tertiary} strokeWidth={1.4} />
            <Text style={styles.weatherLabel}>{weatherLabel}</Text>
            <Pressable onPress={() => setMenuOpen(true)} style={styles.bellBtn}>
              <IconMenu size={18} color={T.color.tertiary} strokeWidth={1.4} />
            </Pressable>
          </View>
        </View>
      </View>

      {feed.length === 0 ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyTitle}>{t('tabs_home_emptyFeedTitle')}</Text>
          <Text style={styles.emptyCaption}>{t('tabs_home_emptyFeedCaption')}</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={feed}
          keyExtractor={o => o.id}
          renderItem={renderCard}
          onLayout={e => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (h > 0 && h !== pageH) setPageH(h);
          }}
          showsVerticalScrollIndicator={false}
          snapToInterval={CARD_H}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="fast"
          // Track active index only after a snap settles — avoids setState on every
          // scroll frame and eliminates redundant re-renders of all FeedCards.
          onMomentumScrollEnd={e => {
            const i = Math.round(e.nativeEvent.contentOffset.y / CARD_H);
            if (i !== activeIdx) setActiveIdx(i);
          }}
          style={{ flex: 1 }}
          getItemLayout={(_, index) => ({ length: CARD_H, offset: CARD_H * index, index })}
          // Perf: only render 3 pages around the viewport; clip off-screen items.
          removeClippedSubviews
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          // Threshold is a fraction (0–1), not a pixel count.
          // Only fire on the real generated feed; demo/static paths don't paginate.
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (isGenerated && !isDemo && !isFetchingMore) fetchMoreOutfits();
          }}
          ListFooterComponent={
            <>
              {isFetchingMore && (
                <View style={{ height: 2, backgroundColor: T.color.hairline }} />
              )}
              {/* T030: end-of-feed stylist card — the one touch point into Wardrobe
                  Report from the daily feed (FR-009). Only shown once the report has
                  at least one gap recommendation still visible (not dismissed). */}
              {hasWardrobeGaps && (
                <Pressable onPress={() => router.push('/wardrobe-report' as any)} style={styles.stylistNoteCard}>
                  <Text style={styles.stylistNoteLabel}>
                    {t('tabs_home_stylistNoteLabel')}
                  </Text>
                  <Text style={styles.stylistNoteBody}>
                    {t('tabs_home_stylistNoteBody')}
                  </Text>
                  <Text style={styles.stylistNoteCta}>{t('tabs_home_stylistNoteCta')}</Text>
                </Pressable>
              )}
            </>
          }
        />
      )}

      <BottomNav active="home" onChange={(tab) => {
        if (tab === 'wardrobe') router.replace('/(tabs)/wardrobe');
        if (tab === 'scan') router.push('/try-on');
        if (tab === 'profile') router.replace('/(tabs)/profile');
      }} />

      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)}
        onOpenProfile={() => { setMenuOpen(false); router.push('/(tabs)/profile'); }}
        onOpenCollections={() => { setMenuOpen(false); router.push('/collections'); }}
        onSignOut={() => { setMenuOpen(false); logout().then(() => router.replace('/(onboarding)')); }}
      />
    </View>
  );
}

function FeedCardInner({ outfit, active, cardH, saved, isDemo, topInset, onOpen, onToggleSave, onToggleSchedule, onAddItems }: {
  outfit: Outfit; active: boolean; cardH: number; saved: boolean; isDemo: boolean; topInset: number;
  onOpen: (o: Outfit) => void; onToggleSave: (id: string) => void;
  onToggleSchedule: (id: string) => void; onAddItems: () => void;
}) {
  const { t } = useTranslation();
  // The meta block sizes to its content (a stylist note adds up to two lines),
  // so the collage height must be measured, not assumed as a fixed share of
  // the card — a fixed split lets meta overflow onto the next card.
  const [collageH, setCollageH] = useState(cardH * 0.84);

  // Display-only tags (silhouette + dominant colour) — absent on older/static
  // outfits, so each segment is only appended when present.
  const silhouetteTag = silhouetteMetaLabel(t, outfit.silhouette);
  const silhouetteShapeTag = silhouetteShapeMetaLabel(t, outfit.silhouetteShape);
  const colorToneTag = colorToneMetaLabel(outfit.colorTone);

  return (
    <View style={[styles.card, { height: cardH }]}>
      <Pressable
        onPress={() => onOpen(outfit)}
        onLayout={e => setCollageH(e.nativeEvent.layout.height)}
        style={[styles.collageArea, { opacity: active ? 1 : 0.7 }]}
      >
        <View style={{ width: '100%', maxWidth: MEDIA_MAX, alignSelf: 'center', flex: 1 }}>
          <OutfitCollage outfit={outfit} titleTop={topInset + 88} containerHeight={collageH} />
        </View>

        {/* Right actions — bookmark removed (duplicates heart/save); bell
            removed (no notifications feature); share wired to native sheet. */}
        <View style={styles.actions}>
          <ActionBtn onPress={() => onToggleSave(outfit.id)}>
            <IconHeart filled={saved} size={22} color={T.color.primary} strokeWidth={1.4} />
          </ActionBtn>
          <ActionBtn onPress={() => onToggleSchedule(outfit.id)}>
            <IconCalendar size={22} color={T.color.primary} strokeWidth={1.4} />
          </ActionBtn>
          <ActionBtn onPress={() => onOpen(outfit)}>
            <IconSparkle size={22} color={T.color.primary} strokeWidth={1.4} />
          </ActionBtn>
          <ActionBtn onPress={() => {
            Share.share({ message: t('tabs_home_shareMessage', { style: outfit.style, title: outfit.title }) });
          }}>
            <IconShare size={20} color={T.color.primary} strokeWidth={1.4} />
          </ActionBtn>
        </View>
      </Pressable>

      {/* Bottom meta — auto-height; collage area above shrinks to make room */}
      <View style={styles.meta}>
        <View style={{ width: '100%', maxWidth: MEDIA_MAX, alignSelf: 'center' }}>
          {outfit.stylistNote ? (
            <Text style={styles.stylistNote} numberOfLines={2}>“{outfit.stylistNote}”</Text>
          ) : null}
          <View style={styles.metaTop}>
            <Text style={styles.metaStyle}>
              {outfit.style} · {outfit.weather}
              {silhouetteTag ? ` · ${silhouetteTag}` : ''}
              {silhouetteShapeTag ? ` · ${silhouetteShapeTag}` : ''}
              {colorToneTag ? ` · ${colorToneTag}` : ''}
              {' · '}{outfit.itemIds.length} {t('tabs_home_metaItems')}
            </Text>
            <Pressable onPress={() => onOpen(outfit)}>
              <Text style={styles.metaDetails}>{t('tabs_home_metaDetails')}</Text>
            </Pressable>
          </View>
          <View style={styles.thumbnails}>
            {outfit.itemIds.map(id => (
              <Pressable key={id} onPress={() => onOpen(outfit)} style={styles.thumb}>
                <OutfitItemThumb
                  id={id}
                  style={styles.thumbInner}
                  imageStyle={styles.thumbImg}
                  fallbackStyle={styles.thumbType}
                />
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* T022: Demo banner — sticky at bottom of card when showing demo outfits */}
      {isDemo && active && (
        <Pressable onPress={onAddItems} style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>{t('tabs_home_demoBannerText')}</Text>
          <Text style={styles.demoBannerCta}>{t('tabs_home_demoBannerCta')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const FeedCard = React.memo(FeedCardInner);

function ActionBtn({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={styles.actionBtn}>
      {children}
    </Pressable>
  );
}

function MenuSheet({ open, onClose, onOpenProfile, onOpenCollections, onSignOut }: any) {
  const { t } = useTranslation();
  const { IconDashedSquare, IconCalendar, IconLayers, IconUser, IconSettings, IconChat, IconBookmark, IconClock } = require('../../src/components/icons');
  const menuItems = [
    { icon: <IconDashedSquare size={22} color={T.color.primary} strokeWidth={1.4} />, title: t('tabs_menu_buildOutfit'), action: () => router.push('/build') },
    { icon: <IconCalendar size={22} color={T.color.primary} strokeWidth={1.4} />, title: t('tabs_menu_scheduleOutfits'), action: () => router.push('/schedule') },
    { icon: <IconLayers size={22} color={T.color.primary} strokeWidth={1.4} />, title: t('tabs_menu_collections'), action: onOpenCollections },
    { icon: <IconBookmark size={22} color={T.color.primary} strokeWidth={1.4} />, title: t('tabs_menu_savedOutfits'), action: () => router.push('/saved') },
    { icon: <IconClock size={22} color={T.color.primary} strokeWidth={1.4} />, title: t('tabs_menu_outfitHistory'), action: () => router.push('/history') },
    { icon: <IconBook size={22} color={T.color.primary} strokeWidth={1.4} />, title: t('tabs_menu_wardrobeReport'), action: () => router.push('/wardrobe-report' as any) },
    { icon: <IconUser size={22} color={T.color.primary} strokeWidth={1.4} />, title: t('tabs_menu_profile'), action: onOpenProfile },
    { icon: <IconSettings size={22} color={T.color.primary} strokeWidth={1.4} />, title: t('tabs_menu_settings'), action: () => router.push('/settings') },
    { icon: <IconChat size={22} color={T.color.primary} strokeWidth={1.4} />, title: t('tabs_menu_helpFeedback'), action: () => router.push('/help') },
  ];

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="80%">
      <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 }}>
        <Text style={{ fontFamily: T.font.serif, fontSize: 20, fontWeight: '400', color: T.color.primary, marginTop: 8 }}>{t('tabs_menu_title')}</Text>
        <View style={{ height: 24 }} />
        {menuItems.map((item, i) => (
          <Pressable key={i} onPress={() => { item.action(); onClose(); }}
            style={{ flexDirection: 'row', alignItems: 'center', height: 64, gap: 16,
              borderBottomWidth: i === menuItems.length - 1 ? 0 : 0.5, borderBottomColor: T.color.hairline }}>
            {item.icon}
            <Text style={{ flex: 1, fontFamily: T.font.serif, fontSize: 17, color: T.color.primary }}>{item.title}</Text>
          </Pressable>
        ))}
        <View style={{ height: 32 }} />
        <View style={{ alignItems: 'center' }}>
          <TextLink onPress={onSignOut} color={T.color.tertiary}>{t('tabs_menu_signOut')}</TextLink>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  topOverlay: {
    position: 'absolute', left: 0, right: 0, top: 0,
    paddingHorizontal: 24, zIndex: 20,
  },
  // T023: error banner
  errorBanner: {
    backgroundColor: T.color.canvas,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
    paddingVertical: 8,
    alignItems: 'center',
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  errorBannerText: {
    ...type.caption,
    fontSize: 11,
    color: T.color.warning,
  },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  brand: { fontFamily: T.font.serif, fontSize: 12, fontWeight: '400', color: T.color.tertiary, letterSpacing: 2.5, textTransform: 'uppercase' },
  weatherLabel: { ...type.micro, fontSize: 10, color: T.color.tertiary },
  bellBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', backgroundColor: T.color.canvas, overflow: 'hidden' },
  collageArea: { flex: 1, position: 'relative' },
  actions: {
    position: 'absolute', right: 8, bottom: 24,
    flexDirection: 'column', gap: 6, zIndex: 50,
  },
  actionBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  meta: {
    borderTopWidth: 0.5, borderTopColor: T.color.hairline,
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 14,
    backgroundColor: T.color.canvas,
  },
  metaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaStyle: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  stylistNote: {
    fontFamily: T.font.serifLight,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    color: T.color.secondary,
    marginBottom: 8,
  },
  metaDetails: { ...type.ui, fontSize: 10, color: T.color.primary, textDecorationLine: 'underline' },
  thumbnails: { flexDirection: 'row', gap: 8, marginTop: 8 },
  thumb: {
    width: 44, height: 56, backgroundColor: T.color.elevated,
    borderWidth: 0.5, borderColor: T.color.hairline,
    alignItems: 'center', justifyContent: 'center', padding: 4,
  },
  thumbInner: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: '100%', height: '100%' },
  thumbType: { ...type.micro, fontSize: 7, color: T.color.tertiary, textAlign: 'center', lineHeight: 10 },
  emptyFeed: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 48 },
  emptyTitle: { ...type.h2, color: T.color.primary, textAlign: 'center' },
  emptyCaption: { ...type.caption, marginTop: 12, textAlign: 'center' },
  // T022: demo banner
  demoBanner: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: T.color.canvas,
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 4,
  },
  demoBannerText: {
    fontFamily: T.font.serifLight,
    fontSize: 15,
    fontWeight: '300',
    color: T.color.primary,
    textAlign: 'center',
  },
  demoBannerCta: {
    ...type.ui,
    fontSize: 10,
    color: T.color.primary,
  },
  // T030: end-of-feed stylist card (Wardrobe Report entry point)
  stylistNoteCard: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
    alignItems: 'center',
    gap: 8,
  },
  stylistNoteLabel: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
    letterSpacing: 2,
  },
  stylistNoteBody: {
    fontFamily: T.font.serifLight,
    fontSize: 18,
    fontWeight: '300',
    color: T.color.primary,
    textAlign: 'center',
  },
  stylistNoteCta: {
    ...type.ui,
    fontSize: 10,
    color: T.color.primary,
  },
});
