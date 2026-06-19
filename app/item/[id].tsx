import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { OUTFITS, COLOR_HEX, itemById } from '../../src/data';
import { PrimaryButton, SecondaryButton, TextLink, Divider, Segmented } from '../../src/components/ui';
import { IconChevronLeft, IconEdit, IconShare, IconChevronRight } from '../../src/components/icons';
import { useAppStore } from '../../src/stores/appStore';
import { Photo } from '../../src/components/ui';


const MEASUREMENTS_BY_TYPE: Record<string, Array<[string, string | number, string?]>> = {
  TEE:      [['Chest', 56], ['Length', 70], ['Sleeve', 24], ['Shoulder', 50]],
  SHIRT:    [['Chest', 58], ['Length', 72], ['Sleeve', 64], ['Shoulder', 51]],
  KNIT:     [['Chest', 58], ['Length', 70], ['Sleeve', 64], ['Shoulder', 51]],
  POLO:     [['Chest', 56], ['Length', 70], ['Sleeve', 24], ['Shoulder', 50]],
  JACKET:   [['Chest', 60], ['Length', 68], ['Sleeve', 64], ['Shoulder', 52]],
  BLAZER:   [['Chest', 56], ['Length', 74], ['Sleeve', 64], ['Shoulder', 46]],
  COAT:     [['Chest', 62], ['Length', 100], ['Sleeve', 65], ['Shoulder', 54]],
  JEANS:    [['Waist', 84], ['Hip', 100], ['Inseam', 78], ['Rise', 27], ['Leg opening', 22]],
  TROUSERS: [['Waist', 80], ['Hip', 96],  ['Inseam', 80], ['Rise', 28], ['Leg opening', 20]],
  CHINOS:   [['Waist', 82], ['Hip', 98],  ['Inseam', 80], ['Rise', 27], ['Leg opening', 21]],
  LOAFERS:  [['Size (US)', 9, ''], ['Size (EU)', 42, ''], ['Width', 'D', '']],
  SNEAKERS: [['Size (US)', 9, ''], ['Size (EU)', 42, ''], ['Width', 'D', '']],
  BAG:      [['Width', 32], ['Height', 36], ['Depth', 12], ['Strap drop', 24]],
};

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, removeItem } = useAppStore();
  const [unit, setUnit] = useState('CM');

  const item = itemById(id) || items.find(i => i.id === id) || items[0];
  if (!item) return null;

  const outfitsUsing = OUTFITS.filter(o => o.itemIds.includes(item.id));
  const measurements = item.measurements
    ? item.measurements.map(m => ({ label: m.label, value: m.value, unit: m.unit ?? 'cm' }))
    : (MEASUREMENTS_BY_TYPE[item.type] || []).map(([label, value, u]) => ({
        label, value, unit: u !== undefined ? u : 'cm',
      }));

  const convert = (v: string | number) => {
    if (typeof v !== 'number') return String(v);
    return unit === 'CM' ? String(v) : (v / 2.54).toFixed(1);
  };

  const attributes = [
    { label: 'TYPE', value: item.type },
    { label: 'COLOR', value: item.color, swatch: COLOR_HEX[item.color] },
    { label: 'MATERIAL', value: item.material || '—' },
    { label: 'FIT', value: item.fit || 'Regular' },
    { label: 'SEASON', value: 'Spring · Summer' },
    { label: 'OCCASION', value: 'Casual · Smart casual' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Nav */}
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
          </Pressable>
          <View style={{ flexDirection: 'row' }}>
            <Pressable style={styles.iconBtn}><IconEdit size={18} color={T.color.primary} strokeWidth={1.4} /></Pressable>
            <Pressable style={styles.iconBtn}><IconShare size={20} color={T.color.primary} strokeWidth={1.4} /></Pressable>
          </View>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          {item.png ? (
            <Image source={item.png} style={styles.heroImg} resizeMode="contain" />
          ) : (
            <Text style={{ ...type.micro, color: T.color.tertiary }}>NO IMAGE YET</Text>
          )}
          <Text style={styles.heroType}>{item.type}</Text>
        </View>

        {/* Title */}
        <View style={{ padding: 24, paddingBottom: 0 }}>
          <Text style={styles.ownedLabel}>OWNED · ADDED {(item.addedDate || '').toUpperCase()}</Text>
          <View style={{ height: 8 }} />
          <Text style={styles.h1}>{item.name}</Text>
          <View style={{ height: 12 }} />
          <Text style={type.caption}>
            {item.color} {item.material ? item.material.toLowerCase() : ''}. Worn {item.wornCount || 0} times.
          </Text>
        </View>

        {/* Stats */}
        <View style={{ padding: 24 }}>
          <View style={styles.statsGrid}>
            {[
              { label: 'WORN', value: item.wornCount || 0 },
              { label: 'LAST', value: '3D AGO' },
              { label: 'OUTFITS', value: outfitsUsing.length },
            ].map((s, i) => (
              <View key={s.label} style={[styles.statCell, i === 2 && { borderRightWidth: 0 }]}>
                <Text style={styles.statNum}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Attributes */}
        <View style={{ paddingHorizontal: 24 }}>
          <Text style={styles.sectionLabel}>DETAILS</Text>
          <View style={{ height: 8 }} />
          {attributes.map((a, i) => (
            <View key={a.label} style={[styles.attrRow, { borderBottomWidth: i === attributes.length - 1 ? 0 : 0.5, borderBottomColor: T.color.hairline }]}>
              <Text style={styles.attrKey}>{a.label}</Text>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {a.swatch && <View style={[styles.swatch, { backgroundColor: a.swatch }]} />}
                <Text style={{ fontFamily: T.font.sans, fontSize: 15, color: T.color.primary }}>{a.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Measurements */}
        {measurements.length > 0 && (
          <View style={{ paddingHorizontal: 24, paddingTop: 40 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.sectionLabel}>MEASUREMENTS{item.size ? ` · SIZE ${item.size}` : ''}</Text>
              <Segmented options={['CM', 'IN']} value={unit} onChange={setUnit} />
            </View>
            <View style={styles.measureGrid}>
              {measurements.map((m, i) => {
                const lastInRow = (i % 2) === 1;
                const lastRow = i >= measurements.length - 2;
                const valDisplay = m.unit === '' ? String(m.value) : convert(m.value);
                const unitDisplay = m.unit === '' ? '' : (unit === 'CM' ? 'cm' : 'in');
                return (
                  <View key={m.label} style={[styles.measureCell, !lastInRow && { borderRightWidth: 0.5, borderRightColor: T.color.hairline }, !lastRow && { borderBottomWidth: 0.5, borderBottomColor: T.color.hairline }]}>
                    <Text style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>{String(m.label).toUpperCase()}</Text>
                    <Text style={styles.measureVal}>
                      {valDisplay}
                      {unitDisplay ? <Text style={{ fontSize: 12, color: T.color.tertiary }}> {unitDisplay}</Text> : null}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={[type.caption, { color: T.color.secondary, marginTop: 16 }]}>True to size.</Text>
          </View>
        )}

        {/* Wear with */}
        {outfitsUsing.length > 0 && (
          <View style={{ paddingTop: 40 }}>
            <View style={{ paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
              <Text style={styles.sectionLabel}>WEAR WITH ({outfitsUsing.length})</Text>
              <TextLink color={T.color.primary}>SEE ALL</TextLink>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}>
              {outfitsUsing.map(o => (
                <Pressable key={o.id} onPress={() => router.push(`/outfit/${o.id}`)} style={styles.miniCard}>
                  <View style={styles.miniThumb}>
                    <Photo src={o.img} label={o.title} tone={o.tone} />
                  </View>
                  <Text style={{ ...type.ui, fontSize: 9, color: T.color.tertiary, marginTop: 10 }}>{o.style}</Text>
                  <Text style={{ fontFamily: T.font.serif, fontSize: 14, color: T.color.primary, marginTop: 2 }}>{o.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Actions */}
        <View style={{ padding: 24 }}>
          <PrimaryButton onPress={() => outfitsUsing[0] && router.push(`/outfit/${outfitsUsing[0].id}`)}>
            BUILD AN OUTFIT
          </PrimaryButton>
          <View style={{ height: 12 }} />
          <SecondaryButton>FIND SIMILAR</SecondaryButton>
          <View style={{ height: 24 }} />
          <View style={{ alignItems: 'center' }}>
            <TextLink onPress={() => { removeItem(item.id); router.back(); }} color={T.color.error}>
              Remove from wardrobe
            </TextLink>
          </View>
        </View>

        <View style={{ height: insets.bottom + 48 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: {
    width: '100%', aspectRatio: 4 / 5, backgroundColor: T.color.canvas,
    alignItems: 'center', justifyContent: 'center', padding: 48,
    borderBottomWidth: 0.5, borderBottomColor: T.color.hairline,
    position: 'relative',
  },
  heroImg: { width: '100%', height: '100%' },
  heroType: { ...type.ui, fontSize: 10, color: T.color.tertiary, position: 'absolute', top: 16, left: 24 },
  ownedLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  h1: { fontFamily: T.font.serif, fontSize: 36, fontWeight: '300', color: T.color.primary },
  statsGrid: { borderWidth: 0.5, borderColor: T.color.hairline, flexDirection: 'row' },
  statCell: { flex: 1, paddingVertical: 16, alignItems: 'center', borderRightWidth: 0.5, borderRightColor: T.color.hairline },
  statNum: { fontFamily: T.font.serif, fontSize: 24, fontWeight: '300', color: T.color.primary },
  statLabel: { ...type.ui, fontSize: 9, color: T.color.tertiary, marginTop: 4 },
  sectionLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  attrRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  attrKey: { ...type.ui, fontSize: 10, color: T.color.tertiary, width: 110 },
  swatch: { width: 14, height: 14, borderRadius: 999, borderWidth: 0.5, borderColor: T.color.hairline },
  measureGrid: { borderWidth: 0.5, borderColor: T.color.hairline, flexDirection: 'row', flexWrap: 'wrap' },
  measureCell: { width: '50%', padding: 14 },
  measureVal: { fontFamily: T.font.serif, fontSize: 20, fontWeight: '300', color: T.color.primary, marginTop: 4 },
  miniCard: { width: 160 },
  miniThumb: { width: '100%', aspectRatio: 4 / 5, borderWidth: 0.5, borderColor: T.color.hairline, overflow: 'hidden' },
});
