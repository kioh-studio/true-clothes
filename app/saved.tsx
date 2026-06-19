import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { Photo } from '../src/components/ui';
import { IconChevronLeft, IconBookmark } from '../src/components/icons';
import { useAppStore } from '../src/stores/appStore';
import { OUTFITS } from '../src/data';
import { useGridCardWidth } from '../src/design/layout';

export default function SavedOutfitsScreen() {
  const CARD_W = useGridCardWidth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { savedSet, toggleSave } = useAppStore();

  const saved = OUTFITS.filter((o) => savedSet.has(o.id));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Saved</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {saved.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <IconBookmark size={22} color={T.color.primary} strokeWidth={1.2} />
            </View>
            <View style={{ height: 24 }} />
            <Text style={styles.emptyTitle}>Nothing saved yet.</Text>
            <Text style={styles.emptyCaption}>
              Tap the bookmark on any outfit in your feed to keep it for later.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.listHeader}>
              <Text style={styles.h1}>Saved</Text>
              <Text style={styles.count}>
                {saved.length} OUTFIT{saved.length === 1 ? '' : 'S'}
              </Text>
            </View>
            <View style={styles.grid}>
              {saved.map((o) => (
                <Pressable
                  key={o.id}
                  onPress={() => router.push(`/outfit/${o.id}`)}
                  style={[styles.card, { width: CARD_W }]}
                >
                  <View style={StyleSheet.absoluteFillObject}>
                    <Photo src={o.img} label={o.title} tone={o.tone} />
                  </View>
                  <View style={styles.cardGradient} />
                  <View style={styles.cardLabel}>
                    <Text style={styles.cardStyle}>{o.style}</Text>
                    <Text style={styles.cardTitle} numberOfLines={1}>{o.title}</Text>
                  </View>
                  <Pressable
                    onPress={() => toggleSave(o.id)}
                    style={styles.unsaveBtn}
                    hitSlop={8}
                  >
                    <IconBookmark size={14} color={T.color.primary} strokeWidth={1.4} filled />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.color.canvas,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: {
    ...type.h3,
    color: T.color.primary,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  listHeader: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  h1: {
    ...type.h1,
    color: T.color.primary,
  },
  count: {
    ...type.ui,
    fontSize: 10,
    color: T.color.tertiary,
    marginTop: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    aspectRatio: 3 / 4,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    position: 'relative',
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
    backgroundColor: 'transparent',
    // gradient approximated via opacity overlay
  },
  cardLabel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  cardStyle: {
    ...type.ui,
    fontSize: 9,
    color: 'rgba(242,237,228,0.85)',
  },
  cardTitle: {
    fontFamily: T.font.serif,
    fontSize: 15,
    color: T.color.canvas,
    marginTop: 4,
  },
  unsaveBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(250,247,242,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingTop: 64,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...type.h2,
    color: T.color.primary,
    textAlign: 'center',
  },
  emptyCaption: {
    ...type.caption,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 260,
  },
});
