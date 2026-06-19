// Home — Outfit Feed (TikTok-style vertical pager)
import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ScrollView, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { OUTFITS, Outfit } from '../../src/data';
import { OutfitCollage, OutfitItemThumb } from '../../src/components/outfit/Collage';
import { BottomNav } from '../../src/components/ui/BottomNav';
import { BottomSheet, TextLink, Tag } from '../../src/components/ui';
import { useAppStore } from '../../src/stores/appStore';
import { useFitEngineStore } from '../../src/stores/fitEngineStore';
import { useFitFeed } from '../../src/features/feed/useFitFeed';
import {
  IconBell, IconHeart, IconBookmark, IconCalendar, IconSparkle, IconShare, IconThermometer,
} from '../../src/components/icons';

// T021: Map temperature band → filter label
const BAND_TO_FILTER: Record<string, string> = {
  hot:  'HOT 28°+',
  warm: 'WARM 22–27°',
  mild: 'COOL 16–21°',
  cold: 'COLD –15°',
};

const WEATHER_FILTERS = [
  { label: 'ALL', min: -Infinity, max: Infinity },
  { label: 'HOT 28°+', min: 28, max: Infinity },
  { label: 'WARM 22–27°', min: 22, max: 27 },
  { label: 'COOL 16–21°', min: 16, max: 21 },
  { label: 'COLD –15°', min: -Infinity, max: 15 },
];

// T022: 2 curated demo outfits for empty wardrobe state
const DEMO_OUTFITS = OUTFITS.slice(0, 2);

function parseTemp(weather: string): number {
  const match = weather.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 24;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeIdx, setActiveIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const { savedSet, toggleSave, toggleSchedule, items, wardrobeItems, weatherContext } = useAppStore();
  const { feedError, fetchOutfits, fetchMoreOutfits, isFetchingMore } = useFitEngineStore();
  const { outfits: generatedOutfits, isGenerated } = useFitFeed();

  // T021: Default filter to live weather band
  const defaultFilter = weatherContext ? (BAND_TO_FILTER[weatherContext.temperatureBand] ?? 'ALL') : 'ALL';
  const [weatherFilter, setWeatherFilter] = useState(defaultFilter);

  // Keep filter in sync when weather loads after mount
  useEffect(() => {
    if (weatherContext && weatherFilter === 'ALL') {
      const band = BAND_TO_FILTER[weatherContext.temperatureBand];
      if (band) setWeatherFilter(band);
    }
  }, [weatherContext]);

  // T022: Empty wardrobe → show 2 curated demo outfits
  const isDemo = wardrobeItems.length === 0;
  const allOutfits: Outfit[] = isDemo
    ? DEMO_OUTFITS
    : isGenerated ? generatedOutfits : OUTFITS;

  const feed = useMemo(() => {
    if (weatherFilter === 'ALL') return allOutfits;
    const range = WEATHER_FILTERS.find(f => f.label === weatherFilter);
    if (!range) return allOutfits;
    return allOutfits.filter(o => {
      const temp = parseTemp(o.weather);
      return temp >= range.min && temp <= range.max;
    });
  }, [allOutfits, weatherFilter]);

  // Page height must equal the FlatList's real viewport, or every snap leaves
  // a sliver of the neighbouring card visible. Window dimensions are
  // unreliable on Android edge-to-edge, so measure the list itself; the
  // formula is only the pre-layout estimate.
  const { height: winH } = useWindowDimensions();
  const [pageH, setPageH] = useState(0);
  const CARD_H = pageH || winH - insets.bottom - 64;

  const openOutfit = (outfit: Outfit) => {
    router.push({ pathname: '/outfit/[id]', params: { id: outfit.id, data: JSON.stringify(outfit) } });
  };

  // T023: retry handler
  const handleRetry = () => { fetchOutfits(); };

  const weatherLabel = weatherContext
    ? `${Math.round(weatherContext.temperatureCelsius)}°C`
    : '–';

  const renderCard = ({ item: outfit, index }: { item: Outfit; index: number }) => (
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
      onAddItems={() => router.replace('/(tabs)/wardrobe')}
    />
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Top overlay */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
        {/* T023: Error retry banner */}
        {feedError && (
          <Pressable onPress={handleRetry} style={styles.errorBanner} pointerEvents="auto">
            <Text style={styles.errorBannerText}>Couldn't refresh — tap to retry</Text>
          </Pressable>
        )}
        <View style={styles.topRow}>
          <Text style={styles.brand}>MIEN</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <IconThermometer size={13} color={T.color.tertiary} strokeWidth={1.4} />
            <Text style={styles.weatherLabel}>{weatherLabel}</Text>
            <Pressable style={styles.bellBtn}>
              <IconBell size={18} color={T.color.tertiary} strokeWidth={1.4} />
            </Pressable>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.weatherBar}
          contentContainerStyle={{ gap: 6, paddingRight: 24 }}
          pointerEvents="auto"
        >
          {WEATHER_FILTERS.map(f => (
            <Tag key={f.label} selected={weatherFilter === f.label}
              onPress={() => { setWeatherFilter(f.label); setActiveIdx(0); }} size="sm">
              {f.label}
            </Tag>
          ))}
        </ScrollView>
      </View>

      {feed.length === 0 ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyTitle}>No outfits for this weather.</Text>
          <Text style={styles.emptyCaption}>Try a different filter or add more items to your wardrobe.</Text>
        </View>
      ) : (
        <FlatList
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
          onScroll={e => {
            const i = Math.round(e.nativeEvent.contentOffset.y / CARD_H);
            if (i !== activeIdx) setActiveIdx(i);
          }}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          getItemLayout={(_, index) => ({ length: CARD_H, offset: CARD_H * index, index })}
          onEndReachedThreshold={3}
          onEndReached={() => { if (!isFetchingMore) fetchMoreOutfits(); }}
          ListFooterComponent={isFetchingMore ? (
            <View style={{ height: 2, backgroundColor: T.color.hairline }} />
          ) : null}
        />
      )}

      <BottomNav active="home" onChange={(tab) => {
        if (tab === 'wardrobe') router.replace('/(tabs)/wardrobe');
        if (tab === 'profile') router.replace('/(tabs)/profile');
      }} onMenu={() => setMenuOpen(true)} />

      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)}
        onOpenProfile={() => { setMenuOpen(false); router.push('/(tabs)/profile'); }}
        onOpenCollections={() => { setMenuOpen(false); router.push('/collections'); }}
        onSignOut={() => { setMenuOpen(false); router.replace('/(onboarding)'); }}
      />
    </View>
  );
}

function FeedCard({ outfit, active, cardH, saved, isDemo, topInset, onOpen, onToggleSave, onToggleSchedule, onAddItems }: {
  outfit: Outfit; active: boolean; cardH: number; saved: boolean; isDemo: boolean; topInset: number;
  onOpen: (o: Outfit) => void; onToggleSave: (id: string) => void;
  onToggleSchedule: (id: string) => void; onAddItems: () => void;
}) {
  // The meta block sizes to its content (a stylist note adds up to two lines),
  // so the collage height must be measured, not assumed as a fixed share of
  // the card — a fixed split lets meta overflow onto the next card.
  const [collageH, setCollageH] = useState(cardH * 0.84);

  return (
    <View style={[styles.card, { height: cardH }]}>
      <Pressable
        onPress={() => onOpen(outfit)}
        onLayout={e => setCollageH(e.nativeEvent.layout.height)}
        style={[styles.collageArea, { opacity: active ? 1 : 0.7 }]}
      >
        <OutfitCollage outfit={outfit} titleTop={topInset + 88} containerHeight={collageH} />

        {/* Right actions */}
        <View style={styles.actions}>
          <ActionBtn onPress={() => onToggleSave(outfit.id)}>
            <IconHeart filled={saved} size={22} color={T.color.primary} strokeWidth={1.4} />
          </ActionBtn>
          <ActionBtn onPress={() => {}}>
            <IconBookmark size={22} color={T.color.primary} strokeWidth={1.4} />
          </ActionBtn>
          <ActionBtn onPress={() => onToggleSchedule(outfit.id)}>
            <IconCalendar size={22} color={T.color.primary} strokeWidth={1.4} />
          </ActionBtn>
          <ActionBtn onPress={() => onOpen(outfit)}>
            <IconSparkle size={22} color={T.color.primary} strokeWidth={1.4} />
          </ActionBtn>
          <ActionBtn onPress={() => {}}>
            <IconShare size={20} color={T.color.primary} strokeWidth={1.4} />
          </ActionBtn>
        </View>
      </Pressable>

      {/* Bottom meta — auto-height; collage area above shrinks to make room */}
      <View style={styles.meta}>
        {outfit.stylistNote ? (
          <Text style={styles.stylistNote} numberOfLines={2}>“{outfit.stylistNote}”</Text>
        ) : null}
        <View style={styles.metaTop}>
          <Text style={styles.metaStyle}>{outfit.style} · {outfit.weather} · {outfit.itemIds.length} ITEMS</Text>
          <Pressable onPress={() => onOpen(outfit)}>
            <Text style={styles.metaDetails}>DETAILS →</Text>
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

      {/* T022: Demo banner — sticky at bottom of card when showing demo outfits */}
      {isDemo && active && (
        <Pressable onPress={onAddItems} style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>Add your wardrobe to personalise your feed</Text>
          <Text style={styles.demoBannerCta}>ADD ITEMS →</Text>
        </Pressable>
      )}
    </View>
  );
}

function ActionBtn({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={styles.actionBtn}>
      {children}
    </Pressable>
  );
}

function MenuSheet({ open, onClose, onOpenProfile, onOpenCollections, onSignOut }: any) {
  const { IconDashedSquare, IconCalendar, IconLayers, IconPin, IconBook, IconUser, IconSettings, IconChat } = require('../../src/components/icons');
  const menuItems = [
    { icon: <IconDashedSquare size={22} color={T.color.primary} strokeWidth={1.4} />, title: 'Build an outfit manually', action: () => {} },
    { icon: <IconCalendar size={22} color={T.color.primary} strokeWidth={1.4} />, title: 'Schedule outfits', action: () => {} },
    { icon: <IconLayers size={22} color={T.color.primary} strokeWidth={1.4} />, title: 'Collections', action: onOpenCollections },
    { icon: <IconPin size={22} color={T.color.primary} strokeWidth={1.4} />, title: 'Trending in your area', action: () => {} },
    { icon: <IconBook size={22} color={T.color.primary} strokeWidth={1.4} />, title: 'Style guide', action: () => {} },
    { icon: <IconUser size={22} color={T.color.primary} strokeWidth={1.4} />, title: 'Profile', action: onOpenProfile },
    { icon: <IconSettings size={22} color={T.color.primary} strokeWidth={1.4} />, title: 'Settings', action: () => {} },
    { icon: <IconChat size={22} color={T.color.primary} strokeWidth={1.4} />, title: 'Help & feedback', action: () => {} },
  ];

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="80%">
      <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 }}>
        <Text style={{ fontFamily: T.font.serif, fontSize: 20, fontWeight: '400', color: T.color.primary, marginTop: 8 }}>Menu</Text>
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
          <TextLink onPress={onSignOut} color={T.color.tertiary}>Sign out</TextLink>
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
  weatherBar: { marginTop: 8, marginHorizontal: -24, paddingLeft: 24 },
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
});
