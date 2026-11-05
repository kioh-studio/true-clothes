import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { IconChevronLeft } from '../src/components/icons';
import { Bounded } from '../src/components/ui';
import { useItemPhoto } from '../src/features/wardrobe-photos';
import { useWardrobeStats } from '../src/features/wardrobe/useWardrobeStats';
import type { ItemStat } from '../src/features/wardrobe/wardrobeStats';
import { useTranslation } from '../src/i18n';

function Row({ stat, right, onPress }: { stat: ItemStat; right: string; onPress: () => void }) {
  const { t } = useTranslation();
  const { item } = stat;
  const photo = useItemPhoto(item);
  const name = item.name || (item.type ? item.type.charAt(0) + item.type.slice(1).toLowerCase() : t('itemDetail_itemFallbackName'));
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.thumb}>
        {photo.status === 'ready' && photo.source
          ? <Image source={photo.source} style={styles.img} resizeMode="contain" />
          : null}
      </View>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      <Text style={styles.right}>{right}</Text>
    </Pressable>
  );
}

export default function WardrobeStatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { unworn, costPerWear } = useWardrobeStats();
  const open = (id: string) => router.push({ pathname: '/item/[id]', params: { id } });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.title}>{t('wardrobeStats_title')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <Bounded>
          <Text style={styles.section}>{t('wardrobeStats_unwornTitle')}</Text>
          {unworn.length === 0 ? (
            <Text style={styles.hint}>{t('wardrobeStats_unwornEmpty')}</Text>
          ) : unworn.map(s => (
            <Row
              key={s.item.id}
              stat={s}
              right={s.daysSinceWorn === null
                ? t('wardrobeStats_neverWorn')
                : t('wardrobeStats_unwornDays', { count: s.daysSinceWorn })}
              onPress={() => open(s.item.id)}
            />
          ))}

          <Text style={[styles.section, { marginTop: 40 }]}>{t('wardrobeStats_cpwTitle')}</Text>
          {costPerWear.length === 0 ? (
            <Text style={styles.hint}>{t('wardrobeStats_cpwHint')}</Text>
          ) : costPerWear.map(s => (
            <Row
              key={s.item.id}
              stat={s}
              right={`${Math.round(s.costPerWear as number).toLocaleString()} · ${t('wardrobeStats_cpwTimes', { count: s.count })}`}
              onPress={() => open(s.item.id)}
            />
          ))}
        </Bounded>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: T.font.serif, fontSize: 20, color: T.color.primary },
  section: { ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 8 },
  hint: { ...type.caption, color: T.color.secondary, paddingVertical: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 72,
    borderBottomWidth: 0.5, borderBottomColor: T.color.hairline,
  },
  thumb: { width: 48, height: 60, borderWidth: 0.5, borderColor: T.color.hairline, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  name: { flex: 1, fontFamily: T.font.serif, fontSize: 16, color: T.color.primary },
  right: { ...type.caption, color: T.color.secondary },
});
