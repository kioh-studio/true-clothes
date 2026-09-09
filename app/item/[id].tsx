import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, Share, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../../src/design/tokens';
import { OUTFITS, COLOR_HEX, itemById, ClothingItem } from '../../src/data';
import { PrimaryButton, TextLink, Segmented, Bounded } from '../../src/components/ui';
import { IconChevronLeft, IconEdit, IconShare } from '../../src/components/icons';
import { useAppStore } from '../../src/stores/appStore';
import { useTryOnStore } from '../../src/stores/tryOnStore';
import { Photo } from '../../src/components/ui';
import { useItemPhoto, photoSourceUri } from '../../src/features/wardrobe-photos';
import type { PhotoInput } from '../../src/features/wardrobe-photos/types';
import type { WardrobeItem } from '../../src/types/fitEngine';
import { warmthLabel } from '../../src/features/wardrobe-add/vocab';
import i18n, { useTranslation } from '../../src/i18n';

// Measurement labels below are internal English words used as the join key
// between MEASUREMENTS_BY_TYPE / MKEY_LABELS / demo data (src/data) — they are
// not displayed directly. This maps each to its translated display label.
const MEASURE_LABEL_KEYS: Record<string, string> = {
  'Chest': 'itemDetail_measureChest',
  'Length': 'itemDetail_measureLength',
  'Sleeve': 'itemDetail_measureSleeve',
  'Shoulder': 'itemDetail_measureShoulder',
  'Waist': 'itemDetail_measureWaist',
  'Hip': 'itemDetail_measureHip',
  'Inseam': 'itemDetail_measureInseam',
  'Thigh': 'itemDetail_measureThigh',
  'Rise': 'itemDetail_measureRise',
  'Leg opening': 'itemDetail_measureLegOpening',
  'Size (US)': 'itemDetail_measureSizeUs',
  'Size (EU)': 'itemDetail_measureSizeEu',
  'Width': 'itemDetail_measureWidth',
  'Height': 'itemDetail_measureHeight',
  'Depth': 'itemDetail_measureDepth',
  'Strap drop': 'itemDetail_measureStrapDrop',
  'Skirt length': 'itemDetail_measureSkirtLength',
  'Head circ.': 'itemDetail_measureHeadCirc',
};

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
  season: string | null;   // real warmthSeason display label, when known
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
    season: null,   // demo catalogue items don't carry warmthSeason data
  };
}

function formatAdded(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US';
  return date.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
}

function normalizeWardrobe(w: WardrobeItem, t: (key: string) => string): ItemVM {
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
    name: w.name || w.notes || (type ? type.charAt(0) + type.slice(1).toLowerCase() : t('itemDetail_itemFallbackName')),
    addedLabel: formatAdded(w.createdAt),
    swatchColor: w.primaryColor || w.colors[0] || '',
    colorText: w.colors.length ? w.colors.join(', ') : (w.primaryColor || '—'),
    material: w.material,
    fit: w.fit,
    wornCount: 0,            // wear history not tracked for wardrobe items yet
    size: w.sizeLabel,
    measurements: fromGarment.length ? fromGarment : measurementsForType(type),
    isWardrobe: true,
    season: w.warmthSeason?.length ? w.warmthSeason.map(warmthLabel).join(' · ') : null,
  };
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { items, wardrobeItems, removeItem, removeWardrobeItem } = useAppStore();
  const { height: winH } = useWindowDimensions();
  const [unit, setUnit] = useState('CM');
  const [deleting, setDeleting] = useState(false);

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
    ? normalizeWardrobe(wardrobeItem, t)
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
          <Text style={styles.emptyTitle}>{t('itemDetail_notFoundTitle')}</Text>
          <Text style={[type.caption, { marginTop: 12, textAlign: 'center' }]}>
            {t('itemDetail_notFoundCaption')}
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
    { label: t('itemDetail_attrType'), value: vm.type || '—' },
    { label: t('itemDetail_attrColor'), value: vm.colorText, swatch: COLOR_HEX[vm.swatchColor] },
    { label: t('itemDetail_attrMaterial'), value: vm.material || '—' },
    { label: t('itemDetail_attrFit'), value: vm.fit || t('itemDetail_fitRegular') },
    // Real warmthSeason (feature 006) when the item has it; otherwise fall
    // back to the old placeholder so the row still renders something.
    { label: t('itemDetail_attrSeason'), value: vm.season || t('itemDetail_seasonFallback') },
    { label: t('itemDetail_attrOccasion'), value: t('itemDetail_occasionFallback') },
  ];

  const performRemove = async () => {
    if (deleting) return;
    setDeleting(true);
    if (vm.isWardrobe) {
      await removeWardrobeItem(vm.id);
      const err = useAppStore.getState().wardrobeError;
      if (err) {
        setDeleting(false);
        Alert.alert(t('itemDetail_couldNotRemoveTitle'), err);
        return;
      }
    } else {
      removeItem(vm.id);
    }
    router.back();
  };

  // Destructive action — confirm first, same as every other destructive flow
  // in the app (delete collection, remove from collection).
  const handleRemove = () => {
    if (deleting) return;
    Alert.alert(
      t('itemDetail_removeAlertTitle'),
      t('itemDetail_removeAlertMessage', { name: vm.name }),
      [
        { text: t('common_cancel'), style: 'cancel' },
        { text: t('extraction_removeButton'), style: 'destructive', onPress: performRemove },
      ],
    );
  };

  const handleShare = () => {
    const itemDesc = [vm.name, vm.type, vm.colorText].filter(Boolean).join(' · ');
    Share.share({ message: itemDesc });
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
            <Pressable style={styles.iconBtn} onPress={handleShare}><IconShare size={20} color={T.color.primary} strokeWidth={1.4} /></Pressable>
          </View>
        </View>

        {/* Hero — full-bleed, height is a share of the viewport so it holds the
            same proportion of the screen on a phone and on an iPad (see
            src/design/responsive/design.md). */}
        <View style={[styles.hero, { height: winH * 0.58 }]}>
          {photo.status === 'ready' && photo.source ? (
            <Image source={photo.source} style={styles.heroImg} resizeMode="contain" />
          ) : (
            <Text style={{ ...type.micro, color: T.color.tertiary }}>{t('itemDetail_noImageYet')}</Text>
          )}
          <Text style={styles.heroType}>{vm.type}</Text>
        </View>

        <Bounded>
        {/* Title */}
        <View style={{ padding: 24, paddingBottom: 0 }}>
          <Text style={styles.ownedLabel}>
            {vm.addedLabel ? t('itemDetail_ownedAdded', { date: vm.addedLabel.toUpperCase() }) : t('itemDetail_ownedLabel')}
          </Text>
          <View style={{ height: 8 }} />
          <Text style={styles.h1}>{vm.name}</Text>
          <View style={{ height: 12 }} />
          <Text style={type.caption}>
            {vm.colorText} {vm.material ? vm.material.toLowerCase() : ''}. {t('itemDetail_wornCount', { count: vm.wornCount })}
          </Text>
        </View>

        {/* Stats */}
        <View style={{ padding: 24 }}>
          <View style={styles.statsGrid}>
            {[
              { label: t('itemDetail_statWorn'), value: vm.wornCount },
              { label: t('itemDetail_statLast'), value: vm.wornCount > 0 ? t('itemDetail_statLastAgo') : '—' },
              { label: t('itemDetail_statOutfits'), value: outfitsUsing.length },
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
          <Text style={styles.sectionLabel}>{t('itemDetail_detailsLabel')}</Text>
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
              <Text style={styles.sectionLabel}>
                {vm.size ? t('itemDetail_measurementsLabelWithSize', { size: vm.size }) : t('itemDetail_measurementsLabel')}
              </Text>
              <Segmented options={[t('itemDetail_unitCm'), t('itemDetail_unitIn')]} value={unit} onChange={setUnit} />
            </View>
            <View style={styles.measureGrid}>
              {measurements.map((m, i) => {
                const lastInRow = (i % 2) === 1;
                const lastRow = i >= measurements.length - 2;
                const valDisplay = m.unit === '' ? String(m.value) : convert(m.value);
                const unitDisplay = m.unit === '' ? '' : (unit === t('itemDetail_unitCm') ? t('onboarding_measurements_cmUnit') : t('onboarding_measurements_inUnit'));
                return (
                  <View key={m.label} style={[styles.measureCell, !lastInRow && { borderRightWidth: 0.5, borderRightColor: T.color.hairline }, !lastRow && { borderBottomWidth: 0.5, borderBottomColor: T.color.hairline }]}>
                    <Text style={{ ...type.ui, fontSize: 9, color: T.color.tertiary }}>{t(MEASURE_LABEL_KEYS[m.label] ?? m.label, { defaultValue: m.label }).toUpperCase()}</Text>
                    <Text style={styles.measureVal}>
                      {valDisplay}
                      {unitDisplay ? <Text style={{ fontSize: 12, color: T.color.tertiary }}> {unitDisplay}</Text> : null}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={[type.caption, { color: T.color.secondary, marginTop: 16 }]}>{t('itemDetail_trueToSize')}</Text>
          </View>
        )}

        {/* Wear with */}
        {outfitsUsing.length > 0 && (
          <View style={{ paddingTop: 40 }}>
            <View style={{ paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
              <Text style={styles.sectionLabel}>{t('itemDetail_wearWith', { count: outfitsUsing.length })}</Text>
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
          <PrimaryButton
            onPress={handleBuildOutfit}
            disabled={!wardrobeItem && outfitsUsing.length === 0}
          >
            {t('itemDetail_buildOutfitButton')}
          </PrimaryButton>
          <View style={{ height: 24 }} />
          <View style={{ alignItems: 'center' }}>
            <TextLink onPress={handleRemove} color={T.color.error}>
              {t('itemDetail_removeFromWardrobe')}
            </TextLink>
          </View>
        </View>
        </Bounded>

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
    width: '100%', backgroundColor: T.color.canvas,
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
