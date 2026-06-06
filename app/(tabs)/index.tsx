// Home — Outfit Feed (TikTok-style vertical pager)
import React, { useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions, Pressable, Image, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { OUTFITS, itemById, Outfit } from '../../src/data';
import { OutfitCollage } from '../../src/components/outfit/Collage';
import { BottomNav } from '../../src/components/ui/BottomNav';
import { BottomSheet, PrimaryButton, SecondaryButton, TextLink, Tag } from '../../src/components/ui';
import { useAppStore } from '../../src/stores/appStore';
import { useFitFeed } from '../../src/features/feed/useFitFeed';
import {
  IconBell, IconHeart, IconBookmark, IconCalendar, IconSparkle, IconShare, IconThermometer,
} from '../../src/components/icons';

const { width: W, height: H } = Dimensions.get('window');

// Mock weather — simulates current conditions for filtering
const MOCK_WEATHER = { temp: 26, label: '26°C', condition: 'Partly cloudy', city: 'Ho Chi Minh City' };

const WEATHER_FILTERS = [
  { label: 'ALL', min: -Infinity, max: Infinity },
  { label: 'HOT 28°+', min: 28, max: Infinity },
  { label: 'WARM 22–27°', min: 22, max: 27 },
  { label: 'COOL 16–21°', min: 16, max: 21 },
  { label: 'COLD –15°', min: -Infinity, max: 15 },
];

function parseTemp(weather: string): number {
  const match = weather.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 24;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeIdx, setActiveIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [weatherFilter, setWeatherFilter] = useState('ALL');
  const { savedSet, scheduledSet, toggleSave, toggleSchedule, items } = useAppStore();
  const { outfits: generatedOutfits, isGenerated } = useFitFeed();
  const allOutfits: Outfit[] = isGenerated ? generatedOutfits : OUTFITS;

  const feed = useMemo(() => {
    if (weatherFilter === 'ALL') return allOutfits;
    const range = WEATHER_FILTERS.find(f => f.label === weatherFilter);
    if (!range) return allOutfits;
    return allOutfits.filter(o => {
      const temp = parseTemp(o.weather);
      return temp >= range.min && temp <= range.max;
    });
  }, [allOutfits, weatherFilter]);

  const CARD_H = H - insets.bottom - 64; // subtract bottom nav

  const openOutfit = (outfit: Outfit) => {
    router.push({ pathname: '/outfit/[id]', params: { id: outfit.id, data: JSON.stringify(outfit) } });
  };

  const renderCard = ({ item: outfit, index }: { item: Outfit; index: number }) => {
    const saved = savedSet.has(outfit.id);
    const scheduled = scheduledSet.has(outfit.id);
    const active = index === activeIdx;

    return (
      <View style={[styles.card, { height: CARD_H }]}>
        {/* Collage — top 84% */}
        <Pressable
          onPress={() => openOutfit(outfit)}
          style={[styles.collageArea, { opacity: active ? 1 : 0.7 }]}
        >
          <OutfitCollage outfit={outfit} titleTop={insets.top + 60} containerHeight={CARD_H * 0.84} />

          {/* Right actions */}
          <View style={styles.actions}>
            <ActionBtn onPress={() => toggleSave(outfit.id)}>
              <IconHeart filled={saved} size={22} color={T.color.primary} strokeWidth={1.4} />
            </ActionBtn>
            <ActionBtn onPress={() => {}}>
              <IconBookmark size={22} color={T.color.primary} strokeWidth={1.4} />
            </ActionBtn>
            <ActionBtn onPress={() => toggleSchedule(outfit.id)}>
              <IconCalendar size={22} color={T.color.primary} strokeWidth={1.4} />
            </ActionBtn>
            <ActionBtn onPress={() => openOutfit(outfit)}>
              <IconSparkle size={22} color={T.color.primary} strokeWidth={1.4} />
            </ActionBtn>
            <ActionBtn onPress={() => {}}>
              <IconShare size={20} color={T.color.primary} strokeWidth={1.4} />
            </ActionBtn>
          </View>
        </Pressable>

        {/* Bottom meta */}
        <View style={styles.meta}>
          <View style={styles.metaTop}>
            <Text style={styles.metaStyle}>{outfit.style} · {outfit.weather} · {outfit.itemIds.length} ITEMS</Text>
            <Pressable onPress={() => openOutfit(outfit)}>
              <Text style={styles.metaDetails}>DETAILS →</Text>
            </Pressable>
          </View>
          <View style={styles.thumbnails}>
            {outfit.itemIds.map(id => {
              const item = itemById(id);
              if (!item) return null;
              return (
                <Pressable key={id} onPress={() => openOutfit(outfit)} style={styles.thumb}>
                  {item.png ? (
                    <Image source={item.png} style={styles.thumbImg} resizeMode="contain" />
                  ) : (
                    <Text style={styles.thumbType}>{item.type}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Top overlay */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Text style={styles.brand}>TRUE CLOTHES</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <IconThermometer size={13} color={T.color.tertiary} strokeWidth={1.4} />
            <Text style={styles.weatherLabel}>{MOCK_WEATHER.label}</Text>
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
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={CARD_H}
          decelerationRate="fast"
          onScroll={e => {
            const i = Math.round(e.nativeEvent.contentOffset.y / CARD_H);
            if (i !== activeIdx) setActiveIdx(i);
          }}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          getItemLayout={(_, index) => ({ length: CARD_H, offset: CARD_H * index, index })}
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
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  brand: { fontFamily: T.font.serif, fontSize: 12, fontWeight: '400', color: T.color.tertiary, letterSpacing: 2.5, textTransform: 'uppercase' },
  weatherLabel: { ...type.micro, fontSize: 10, color: T.color.tertiary },
  bellBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  weatherBar: { marginTop: 8, marginHorizontal: -24, paddingLeft: 24 },
  card: { width: W, backgroundColor: T.color.canvas, overflow: 'hidden' },
  collageArea: { flex: 1, position: 'relative' },
  actions: {
    position: 'absolute', right: 8, bottom: 24,
    flexDirection: 'column', gap: 6, zIndex: 50,
  },
  actionBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  meta: {
    height: '16%', borderTopWidth: 0.5, borderTopColor: T.color.hairline,
    paddingHorizontal: 24, paddingTop: 14,
    backgroundColor: T.color.canvas,
  },
  metaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaStyle: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  metaDetails: { ...type.ui, fontSize: 10, color: T.color.primary, textDecorationLine: 'underline' },
  thumbnails: { flexDirection: 'row', gap: 8, marginTop: 8 },
  thumb: {
    width: 44, height: 56, backgroundColor: T.color.elevated,
    borderWidth: 0.5, borderColor: T.color.hairline,
    alignItems: 'center', justifyContent: 'center', padding: 4,
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbType: { ...type.micro, fontSize: 7, color: T.color.tertiary, textAlign: 'center', lineHeight: 10 },
  emptyFeed: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 48 },
  emptyTitle: { ...type.h2, color: T.color.primary, textAlign: 'center' },
  emptyCaption: { ...type.caption, marginTop: 12, textAlign: 'center' },
});
