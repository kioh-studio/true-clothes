import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { WardrobeItem } from '../../src/types/fitEngine';
import { BottomNav } from '../../src/components/ui/BottomNav';
import { PrimaryButton, Tag, Field } from '../../src/components/ui';
import { IconSearch, IconPlus } from '../../src/components/icons';
import { useAppStore } from '../../src/stores/appStore';
import { useItemPhoto } from '../../src/features/wardrobe-photos';
import { useGridCardWidth, useGridColumns } from '../../src/design/layout';
import { useTranslation } from '../../src/i18n';

const FILTERS = ['ALL', 'TOPS', 'BOTTOMS', 'OUTERWEAR', 'DRESSES', 'FOOTWEAR', 'ACCESSORIES', 'HEADWEAR'];
const FILTER_CATS: Record<string, WardrobeItem['category']> = {
  TOPS: 'top',
  BOTTOMS: 'bottom',
  OUTERWEAR: 'outerwear',
  DRESSES: 'dress',
  FOOTWEAR: 'footwear',
  ACCESSORIES: 'accessory',
  HEADWEAR: 'headwear',
};
// Filter ids above are stable internal identifiers (not displayed directly) —
// this maps each to its translated label key.
const FILTER_LABEL_KEYS: Record<string, string> = {
  ALL: 'tabs_wardrobe_filterAll',
  TOPS: 'tabs_wardrobe_filterTops',
  BOTTOMS: 'tabs_wardrobe_filterBottoms',
  OUTERWEAR: 'tabs_wardrobe_filterOuterwear',
  DRESSES: 'tabs_wardrobe_filterDresses',
  FOOTWEAR: 'tabs_wardrobe_filterFootwear',
  ACCESSORIES: 'tabs_wardrobe_filterAccessories',
  HEADWEAR: 'tabs_wardrobe_filterHeadwear',
};

function WardrobeItemCard({ item, cols, onPress }: { item: WardrobeItem; cols: number; onPress: () => void }) {
  const CARD_W = useGridCardWidth(cols);
  const { source, status } = useItemPhoto(item);
  return (
    <Pressable onPress={onPress} style={[styles.itemCard, { width: CARD_W }]}>
      <View style={styles.itemThumb}>
        {status === 'ready' && source ? (
          <Image source={source} style={styles.itemImg} resizeMode="cover" />
        ) : (
          <Text style={styles.itemTypeFallback}>{item.category.toUpperCase()}</Text>
        )}
      </View>
      <View style={{ padding: 4, paddingTop: 12 }}>
        <Text style={styles.itemType}>{item.category.toUpperCase()}</Text>
        <View style={{ height: 4 }} />
        <Text style={styles.itemName} numberOfLines={1}>{item.name || item.notes || item.category}</Text>
        <View style={{ height: 4 }} />
        <Text style={styles.itemMeta}>{item.colors.join(', ')}{item.brand ? ` · ${item.brand}` : ''}</Text>
      </View>
    </Pressable>
  );
}

export default function WardrobeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const cols = useGridColumns();
  const { wardrobeItems, wardrobeError } = useAppStore();
  const [filter, setFilter] = useState('ALL');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = filter === 'ALL'
    ? wardrobeItems
    : wardrobeItems.filter(i => i.category === FILTER_CATS[filter]);

  const visible = search
    ? filtered.filter(i =>
      i.category.toLowerCase().includes(search.toLowerCase()) ||
      (i.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (i.notes ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (i.brand ?? '').toLowerCase().includes(search.toLowerCase())
    )
    : filtered;

  const counts: Record<string, number> = { ALL: wardrobeItems.length };
  Object.keys(FILTER_CATS).forEach(f => {
    counts[f] = wardrobeItems.filter(i => i.category === FILTER_CATS[f]).length;
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Error banner */}
      {wardrobeError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{wardrobeError}</Text>
        </View>
      ) : null}

      {/* Nav */}
      <View style={styles.nav}>
        <Pressable onPress={() => setSearchOpen(v => !v)} style={styles.iconBtn}>
          <IconSearch size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.title}>{t('tabs_wardrobe_nav')}</Text>
        <Pressable onPress={() => router.push('/add-item' as any)} style={styles.iconBtn}>
          <IconPlus size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
      </View>

      {searchOpen && (
        <View style={{ paddingHorizontal: 24, paddingBottom: 8 }}>
          <Field label="" value={search} onChange={setSearch} placeholder={t('tabs_wardrobe_searchPlaceholder')} autoFocus />
        </View>
      )}

      {/* Filter bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { borderBottomWidth: 0.5, borderBottomColor: T.color.hairline }]}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 8, alignItems: 'center' }}>
        {FILTERS.map(f => (
          <Tag key={f} selected={filter === f} onPress={() => setFilter(f)} size="sm">
            {t(FILTER_LABEL_KEYS[f])} ({counts[f] || 0})
          </Tag>
        ))}
      </ScrollView>

      {visible.length === 0 ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 80, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t('tabs_wardrobe_emptyTitle')}</Text>
            <Text style={styles.emptyCaption}>{t('tabs_wardrobe_emptyCaption')}</Text>
            <View style={{ height: 32 }} />
            <PrimaryButton onPress={() => router.push('/add-item' as any)} fullWidth={false} style={{ paddingHorizontal: 48 }}>
              {t('tabs_wardrobe_addFirstItem')}
            </PrimaryButton>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          key={`grid-${cols}`}
          data={visible}
          keyExtractor={(item) => item.id}
          numColumns={cols}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 80, gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <WardrobeItemCard item={item} cols={cols} onPress={() => router.push(`/item/${item.id}` as any)} />
          )}
        />
      )}

      {/* FAB — navigates to Add to Wardrobe wizard */}
      <Pressable onPress={() => router.push('/add-item' as any)} style={[styles.fab, { bottom: insets.bottom + 88 }]}>
        <IconPlus size={24} color={T.color.canvas} strokeWidth={1.4} />
      </Pressable>

      <BottomNav active="wardrobe" onChange={(tab) => {
        if (tab === 'home') router.replace('/(tabs)');
        if (tab === 'scan') router.push('/try-on');
        if (tab === 'profile') router.replace('/(tabs)/profile');
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  errorBanner: { backgroundColor: '#B0413E', paddingHorizontal: 16, paddingVertical: 8 },
  errorBannerText: { ...type.caption, fontSize: 12, color: '#FFF', textAlign: 'center' },
  nav: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: T.font.serif, fontSize: 20, fontWeight: '400', color: T.color.primary },
  filterBar: { maxHeight: 48 },
  itemCard: { marginBottom: 4 },
  itemThumb: {
    width: '100%', aspectRatio: 3 / 4,
    backgroundColor: T.color.elevated,
    borderWidth: 0.5, borderColor: T.color.hairline,
    alignItems: 'center', justifyContent: 'center', padding: 16,
    overflow: 'hidden',
  },
  itemImg: { width: '100%', height: '100%' },
  itemTypeFallback: { ...type.micro, fontSize: 11, color: T.color.tertiary, textAlign: 'center', lineHeight: 14 },
  itemType: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  itemName: { fontFamily: T.font.serif, fontSize: 15, fontWeight: '400', color: T.color.primary },
  itemMeta: { ...type.caption, fontSize: 11, color: T.color.tertiary },
  emptyState: { paddingVertical: 64, alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { ...type.h2, color: T.color.primary },
  emptyCaption: { ...type.caption, marginTop: 12, textAlign: 'center' },
  fab: {
    position: 'absolute', right: 24,
    width: 56, height: 56, borderRadius: 999,
    backgroundColor: T.color.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: T.color.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 8,
    elevation: 8, zIndex: 5,
  },
});
