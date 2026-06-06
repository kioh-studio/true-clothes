import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { OUTFITS } from '../../src/data';
import { Photo } from '../../src/components/ui';
import { IconChevronLeft, IconEdit } from '../../src/components/icons';
import { useAppStore } from '../../src/stores/appStore';
import { Dimensions } from 'react-native';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 24 * 2 - 12) / 2;

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { collections } = useAppStore();

  const collection = collections.find(c => c.id === id) || collections[0];
  const outs = collection.outfitIds.map(oid => OUTFITS.find(o => o.id === oid)).filter(Boolean) as typeof OUTFITS;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.navTitle}>{collection.name}</Text>
        <Pressable style={styles.iconBtn}>
          <IconEdit size={18} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={{ paddingBottom: 24 }}>
          <Text style={styles.h1}>{collection.name}</Text>
          <Text style={[type.caption, { marginTop: 12 }]}>{collection.description}</Text>
          <Text style={[type.ui, { fontSize: 10, color: T.color.tertiary, marginTop: 16 }]}>
            {outs.length} OUTFITS · {collection.createdDate}
          </Text>
        </View>
        <View style={styles.grid}>
          {outs.map(o => (
            <Pressable key={o.id} onPress={() => router.push(`/outfit/${o.id}`)} style={{ width: CARD_W, height: CARD_W * (4 / 3), borderWidth: 0.5, borderColor: T.color.hairline, overflow: 'hidden', position: 'relative' }}>
              <Photo src={o.img} label={o.title} tone={o.tone} style={StyleSheet.absoluteFillObject} />
              <View style={styles.cardGradient} />
              <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
                <Text style={{ ...type.ui, fontSize: 9, color: 'rgba(242,237,228,0.8)' }}>{o.style}</Text>
                <Text style={{ fontFamily: T.font.serif, fontSize: 15, color: T.color.canvas, marginTop: 4 }}>{o.title}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontFamily: T.font.serif, fontSize: 20, fontWeight: '400', color: T.color.primary },
  content: { padding: 24 },
  h1: { fontFamily: T.font.serif, fontSize: 36, fontWeight: '300', color: T.color.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cardGradient: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '35%',
    backgroundColor: 'rgba(26,24,21,0.5)',
  },
});
