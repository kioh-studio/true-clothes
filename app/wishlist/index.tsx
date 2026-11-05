import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { IconChevronLeft } from '../../src/components/icons';
import { useGridCardWidth, useGridColumns } from '../../src/design/layout';
import { useWishlist, useWishlistPhoto } from '../../src/features/wishlist/useWishlist';
import type { WishlistItem } from '../../src/services/wishlistService';
import { useTranslation } from '../../src/i18n';

function Card({ item, width, onPress }: { item: WishlistItem; width: number; onPress: () => void }) {
  const uri = useWishlistPhoto(item.photoPath);
  const score = item.verdict?.overallScore;
  const m = item.metadata;
  return (
    <Pressable onPress={onPress} style={{ width }}>
      <View style={[styles.thumb, { height: width * (4 / 3) }]}>
        {uri ? <Image source={{ uri }} style={styles.img} resizeMode="contain" /> : null}
      </View>
      <View style={styles.meta}>
        <Text style={styles.cardTitle} numberOfLines={1}>{m.name || m.type}</Text>
        <Text style={styles.cardScore}>{typeof score === 'number' ? Math.round(score) : '—'}</Text>
      </View>
    </Pressable>
  );
}

export default function WishlistScreen() {
  const cols = useGridColumns();
  const cardW = useGridCardWidth(cols);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { considering, skippedSum, loading } = useWishlist();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.title}>{t('wishlist_title')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {!loading && considering.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('wishlist_emptyTitle')}</Text>
            <Text style={styles.emptyCaption}>{t('wishlist_emptyCaption')}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {considering.map(i => (
              <Card key={i.id} item={i} width={cardW} onPress={() => router.push(`/wishlist/${i.id}` as never)} />
            ))}
          </View>
        )}

        {skippedSum > 0 ? (
          <Text style={styles.footer}>
            {t('wishlist_skippedTotal', { amount: skippedSum.toLocaleString() })}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.h3, color: T.color.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  thumb: { borderWidth: 0.5, borderColor: T.color.hairline, alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
  meta: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 10 },
  cardTitle: { flex: 1, fontFamily: T.font.serif, fontSize: 14, color: T.color.primary },
  cardScore: { fontFamily: T.font.serif, fontSize: 18, fontWeight: '300', color: T.color.primary, marginLeft: 8 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { ...type.h2, color: T.color.primary, textAlign: 'center' },
  emptyCaption: { ...type.caption, color: T.color.secondary, textAlign: 'center', marginTop: 12 },
  footer: { ...type.caption, color: T.color.tertiary, textAlign: 'center', marginTop: 40 },
});
