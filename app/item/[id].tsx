import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { OUTFITS, COLOR_HEX, itemById, ClothingItem } from '../../src/data';
import { PrimaryButton, SecondaryButton, TextLink, Segmented } from '../../src/components/ui';
import { IconChevronLeft, IconEdit, IconShare } from '../../src/components/icons';
import { useAppStore } from '../../src/stores/appStore';
import { useTryOnStore } from '../../src/stores/tryOnStore';
import { Photo } from '../../src/components/ui';
import { useItemPhoto, photoSourceUri } from '../../src/features/wardrobe-photos';
import type { PhotoInput } from '../../src/features/wardrobe-photos/types';
import type { WardrobeItem } from '../../src/types/fitEngine';


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

// Garment-measurement key (feature 006) → human label for the detail grid.
// m_shoe_size is an EU number (unitless), everything else is centimetres.
const MKEY_LABELS: Array<[string, string, string?]> = [
  ['m_chest', 'Chest'], ['m_shoulder_width', 'Shoulder'], ['m_sleeves', 'Sleeve'],
  ['m_body_length', 'Length'], ['m_waist', 'Waist'], ['m_hip', 'Hip'],
  ['m_inseam', 'Inseam'], ['m_thigh', 'Thigh'], ['m_rise', 'Rise'],
  ['m_skirt_length', 'Skirt length'], ['m_shoe_size', 'Size (EU)', ''],
];

interface Measurement { label: string; value: string | number; unit: string }

// One normalized view-model so the JSX renders demo (mock) and real wardrobe
// items uniformly — they have different shapes (ClothingItem vs WardrobeItem).
interface ItemVM {
  id: string;
  type: string;
  name: string;
  addedLabel: string;
  swatchColor: string;   // colour NAME (looked up in COLOR_HEX for the swatch)
  colorText: string;
  material: string | null;
  fit: string | null;
  wornCount: number;
  size: string | null;
  measurements: Measurement[];
  isWardrobe: boolean;
}

function measurementsForType(t: string): Measurement[] {
  return (MEASUREMENTS_BY_TYPE[t] || []).map(([label, value, u]) => ({
    label: String(label), value, unit: u !== undefined ? u : 'cm',
  }));
}

function normalizeDemo(d: ClothingItem): ItemVM {
  return {
    id: d.id,
    type: d.type,
    name: d.name,
    addedLabel: d.addedDate || '',
    swatchColor: d.color,
    colorText: d.color,
    material: d.material ?? null,
    fit: d.fit ?? null,
    wornCount: d.wornCount || 0,
    size: d.size ?? null,
    measurements: d.measurements
      ? d.measurements.map(m => ({ label: m.label, value: m.value, unit: m.unit ?? 'cm' }))
      : measurementsForType(d.type),
    isWardrobe: false,
  };
}

function formatAdded(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function normalizeWardrobe(w: WardrobeItem): ItemVM {
  const type = (w.type || w.category || '').toUpperCase();
  // Prefer the garment's estimated measurements (feature 006); else a sensible
  // by-type default so the section still renders something useful.
  const garmentM = w.measurements ?? {};
  const fromGarment: Measurement[] = MKEY_LABELS
    .map(([key, label, u]): Measurement | null => {
      const value = garmentM[key as keyof typeof garmentM];
      return typeof value === 'number'
        ? { label, value, unit: u !== undefined ? u : 'cm' }
        : null;
    })
    .filter((m): m is Measurement => m !== null);

  return {
    id: w.id,
    type,
    name: w.name || w.notes || (type ? type.charAt(0) + type.slice(1).toLowerCase() : 'Item'),
    addedLabel: formatAdded(w.createdAt),
    swatchColor: w.primaryColor || w.colors[0] || '',
    colorText: w.colors.length ? w.colors.join(', ') : (w.primaryColor || '—'),
    material: w.material,
    fit: w.fit,
    wornCount: 0,            // wear history not tracked for wardrobe items yet
    size: w.sizeLabel,
    measurements: fromGarment.length ? fromGarment : measurementsForType(type),
    isWardrobe: true,
  };
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, wardrobeItems, removeItem, removeWardrobeItem } = useAppStore();
  const [unit, setUnit] = useState('CM');

  // Resolve the REAL wardrobe item first; only then the demo/mock catalogue.
  // The old `|| items[0]` fallback meant any unmatched id silently showed the
  // first demo item ("Oversized white tee") — so every wardrobe item opened the
  // same wrong detail. No silent fallback now: unknown id → explicit empty state.
  const wardrobeItem = wardrobeItems.find(i => i.id === id) ?? null;
  const demoItem = !wardrobeItem ? (itemById(id) || items.find(i => i.id === id) || null) : null;

  // useItemPhoto is a hook — call it unconditionally with a normalized PhotoInput.
  const photoInput: PhotoInput = wardrobeItem
    ? wardrobeItem
    : demoItem
      ? { id: demoItem.id, photoStorage: 'none', photoPath: null, png: demoItem.png }
      : { id: 'missing', photoStorage: 'none', photoPath: null };
  const photo = useItemPhoto(photoInput);

  const vm: ItemVM | null = wardrobeItem
    ? normalizeWardrobe(wardrobeItem)
    : demoItem
      ? normalizeDemo(demoItem)
      : null;

  if (!vm) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
          </Pressable>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Item not found.</Text>
          <Text style={[type.caption, { marginTop: 12, textAlign: 'center' }]}>
            It may have been removed from your wardrobe.
          </Text>
        </View>
      </View>
    );
  }

  // "Wear with" only applies to demo catalogue items (OUTFITS reference demo ids).
  const outfitsUsing = vm.isWardrobe ? [] : OUTFITS.filter(o => o.itemIds.includes(vm.id));
  const measurements = vm.measurements;

  const convert = (v: string | number) => {
    if (typeof v !== 'number') return String(v);
    return unit === 'CM' ? String(v) : (v / 2.54).toFixed(1);
  };

  const attributes = [
    { label: 'TYPE', value: vm.type || '—' },
    { label: 'COLOR', value: vm.colorText, swatch: COLOR_HEX[vm.swatchColor] },
    { label: 'MATERIAL', value: vm.material || '—' },
    { label: 'FIT', value: vm.fit || 'Regular' },
    { label: 'SEASON', value: 'Spring · Summer' },
    { label: 'OCCASION', value: 'Casual · Smart casual' },
  ];

  const handleRemove = () => {
    if (vm.isWardrobe) removeWardrobeItem(vm.id);
    else removeItem(vm.id);
    router.back();
  };

  // Build an outfit AROUND this item. Real wardrobe items use the live fit engine
  // (Mix & Match pins the item via generate-outfits); demo catalogue items keep
  // the old behaviour of opening an existing outfit that already uses them.
  const handleBuildOutfit = () => {
    if (wardrobeItem) {
      // Pass the already-resolved photo uri — the store can't run useItemPhoto.
      useTryOnStore.getState().pinWardrobeItem(wardrobeItem, photoSourceUri(photo.source));
      router.push('/try-on/mix-match');
    } else if (outfitsUsing[0]) {
      router.push(`/outfit/${outfitsUsing[0].id}`);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Nav */}
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
          </Pressable>
          <View style={{ flexDirection: 'row' }}>
            {vm.isWardrobe ? (
              <Pressable
                onPress={() => router.push({ pathname: '/item-edit', params: { id: vm.id } })}
                style={styles.iconBtn}
              >
                <IconEdit size={18} color={T.color.primary} strokeWidth={1.4} />
              </Pressable>
            ) : null}
            <Pressable style={styles.iconBtn}><IconShare size={20} color={T.color.primary} strokeWidth={1.4} /></Pressable>
          </View>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          {photo.status === 'ready' && photo.source ? (
            <Image source={photo.source} style={styles.heroImg} resizeMode="contain" />
          ) : (
            <Text style={{ ...type.micro, color: T.color.tertiary }}>NO IMAGE YET</Text>
          )}
          <Text style={styles.heroType}>{vm.type}</Text>
        </View>

        {/* Title */}
        <View style={{ padding: 24, paddingBottom: 0 }}>
          <Text style={styles.ownedLabel}>OWNED{vm.addedLabel ? ` · ADDED ${vm.addedLabel.toUpperCase()}` : ''}</Text>
          <View style={{ height: 8 }} />
          <Text style={styles.h1}>{vm.name}</Text>
          <View style={{ height: 12 }} />
          <Text style={type.caption}>
            {vm.colorText} {vm.material ? vm.material.toLowerCase() : ''}. Worn {vm.wornCount} times.
          </Text>
        </View>

        {/* Stats */}
        <View style={{ padding: 24 }}>
          <View style={styles.statsGrid}>
            {[
              { label: 'WORN', value: vm.wornCount },
              { label: 'LAST', value: vm.wornCount > 0 ? '3D AGO' : '—' },
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
              <Text style={styles.sectionLabel}>MEASUREMENTS{vm.size ? ` · SIZE ${vm.size}` : ''}</Text>
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
          <PrimaryButton onPress={handleBuildOutfit}>
            BUILD AN OUTFIT
          </PrimaryButton>
          <View style={{ height: 12 }} />
          <SecondaryButton>FIND SIMILAR</SecondaryButton>
          <View style={{ height: 24 }} />
          <View style={{ alignItems: 'center' }}>
            <TextLink onPress={handleRemove} color={T.color.error}>
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
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 80 },
  emptyTitle: { ...type.h2, color: T.color.primary },
});
