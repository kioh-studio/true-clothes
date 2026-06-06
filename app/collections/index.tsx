import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { OUTFITS } from '../../src/data';
import { Photo } from '../../src/components/ui';
import { IconChevronLeft, IconPlus } from '../../src/components/icons';
import { useAppStore } from '../../src/stores/appStore';
import { Dimensions } from 'react-native';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 24 * 2 - 12) / 2;

export default function CollectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { collections } = useAppStore();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.title}>Collections</Text>
        <Pressable style={styles.iconBtn}>
          <IconPlus size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {collections.map(c => {
            const outs = c.outfitIds.map(id => OUTFITS.find(o => o.id === id)).filter(Boolean) as typeof OUTFITS;
            return (
              <Pressable key={c.id} onPress={() => router.push(`/collections/${c.id}`)} style={{ width: CARD_W }}>
                <View style={[styles.collageGrid, { height: CARD_W * (4 / 3) }]}>
                  {[0, 1, 2, 3].map(i => (
                    <View key={i} style={styles.collageCell}>
                      {outs[i] && <Photo src={outs[i].img} label="" tone={outs[i].tone} />}
                    </View>
                  ))}
                </View>
                <View style={{ paddingTop: 12 }}>
                  <Text style={styles.collName}>{c.name}</Text>
                  <Text style={styles.collMeta}>{outs.length} outfits · Updated 2 days ago</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: T.font.serif, fontSize: 20, fontWeight: '400', color: T.color.primary },
  content: { padding: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  collageGrid: {
    borderWidth: 0.5, borderColor: T.color.hairline,
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: T.color.hairline, gap: 1,
    overflow: 'hidden',
  },
  collageCell: { width: '49.5%', height: '49.5%', backgroundColor: T.color.elevated, overflow: 'hidden' },
  collName: { fontFamily: T.font.serif, fontSize: 17, fontWeight: '400', color: T.color.primary },
  collMeta: { ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 4 },
});
