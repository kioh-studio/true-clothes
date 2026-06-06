import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { OUTFITS, itemById, Outfit } from '../src/data';
import { OutfitCollage } from '../src/components/outfit/Collage';
import { IconChevronLeft } from '../src/components/icons';
import { useAppStore } from '../src/stores/appStore';
import { useFitFeed } from '../src/features/feed/useFitFeed';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 24 * 2 - 12) / 2;

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = today.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wornHistory } = useAppStore();
  const { outfits: generatedOutfits, isGenerated } = useFitFeed();
  const allOutfits = isGenerated ? [...OUTFITS, ...generatedOutfits] : OUTFITS;

  // Group by date
  const grouped = wornHistory.reduce<Record<string, Array<{ outfitId: string; outfit: Outfit }>>>((acc, entry) => {
    const outfit = allOutfits.find(o => o.id === entry.outfitId);
    if (!outfit) return acc;
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push({ outfitId: entry.outfitId, outfit });
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Nav */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.title}>History</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {dates.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing worn yet.</Text>
            <Text style={styles.emptyCaption}>
              When you mark an outfit as "worn today" it will appear here.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.statsText}>
              {wornHistory.length} outfit{wornHistory.length !== 1 ? 's' : ''} worn across {dates.length} day{dates.length !== 1 ? 's' : ''}
            </Text>
            <View style={{ height: 24 }} />

            {dates.map(date => (
              <View key={date} style={styles.dateGroup}>
                <Text style={styles.dateLabel}>{formatDate(date)}</Text>
                <View style={styles.grid}>
                  {grouped[date].map(({ outfit }, i) => (
                    <Pressable
                      key={`${date}-${outfit.id}-${i}`}
                      onPress={() => router.push(`/outfit/${outfit.id}`)}
                      style={[styles.card, { width: CARD_W }]}
                    >
                      <View style={styles.cardCollage}>
                        <OutfitCollage outfit={outfit} compact containerHeight={CARD_W * 1.3} />
                      </View>
                      <View style={{ padding: 4, paddingTop: 10 }}>
                        <Text style={styles.cardStyle}>{outfit.style}</Text>
                        <Text style={styles.cardTitle} numberOfLines={1}>{outfit.title}</Text>
                        <Text style={styles.cardMeta}>{outfit.itemIds.length} items · {outfit.weather}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
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
  title: { fontFamily: T.font.serif, fontSize: 20, fontWeight: '400', color: T.color.primary },

  emptyState: { paddingVertical: 80, alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { ...type.h2, color: T.color.primary },
  emptyCaption: { ...type.caption, marginTop: 12, textAlign: 'center' },

  statsText: { ...type.caption, fontSize: 13, color: T.color.tertiary },

  dateGroup: { marginBottom: 32 },
  dateLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  card: { marginBottom: 4 },
  cardCollage: {
    width: '100%', aspectRatio: 3 / 4,
    backgroundColor: T.color.elevated,
    borderWidth: 0.5, borderColor: T.color.hairline,
    overflow: 'hidden',
  },
  cardStyle: { ...type.ui, fontSize: 9, color: T.color.tertiary },
  cardTitle: { fontFamily: T.font.serif, fontSize: 15, fontWeight: '400', color: T.color.primary, marginTop: 2 },
  cardMeta: { ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 2 },
});
