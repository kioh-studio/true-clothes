import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, Photo } from '../../src/components/ui';
import { IconChevronLeft, IconCheck } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { STYLES, StyleOption } from '../../src/data';
import { useFitEngineStore } from '../../src/stores/fitEngineStore';
import { StyleCatalogItem } from '../../src/services/stylesCatalogService';
import { useGridCardWidth } from '../../src/design/layout';

const RELATED_MAP: Record<string, string[]> = {
  oldmoney: ['preppy', 'smartcasual'],
  streetwear: ['athleisure', 'y2k'],
  minimalist: ['smartcasual'],
  smartcasual: ['oldmoney', 'preppy'],
};

function StyleCard({ style: s, selected, onPress, small = false }: { style: StyleOption; selected: boolean; onPress: () => void; small?: boolean }) {
  const CARD_W = useGridCardWidth();
  const w = small ? 130 : CARD_W;
  const h = w * (4 / 3);
  return (
    <Pressable onPress={onPress} style={[styles.card, { width: w, height: h }]}>
      <Photo src={s.img} label={s.name} tone={selected ? 0 : 2} style={StyleSheet.absoluteFillObject} />
      <View style={styles.cardGradient} />
      <View style={styles.cardLabel}>
        <Text style={styles.cardName}>{s.name}</Text>
        <Text style={styles.cardDesc}>{s.desc}</Text>
      </View>
      {selected && (
        <>
          <View style={styles.selectedBorder} />
          <View style={styles.checkCircle}>
            <IconCheck size={14} color={T.color.primary} strokeWidth={1.8} />
          </View>
        </>
      )}
    </Pressable>
  );
}

const MAX_STYLES = 5;

export default function StylesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setStyleProfile, styles: catalogStyles } = useFitEngineStore();
  const [selected, setSelected] = useState<string[]>([]);

  // Use catalog if loaded, fall back to static STYLES
  const styleList = catalogStyles.length > 0
    ? catalogStyles
    : STYLES;

  const toggle = (id: string) => setSelected(s => {
    if (s.includes(id)) return s.filter(x => x !== id);
    if (s.length >= MAX_STYLES) return s; // enforce max 5
    return [...s, id];
  });

  const handleContinue = async () => {
    if (selected.length === 0) return;
    await setStyleProfile({ selectedStyles: selected });
    router.push('/(onboarding)/colors');
  };

  // Build related from catalog relatedSlugs if available, else RELATED_MAP
  const related = catalogStyles.length > 0
    ? [...new Set(
        selected
          .flatMap(id => {
            const item = catalogStyles.find(s => s.id === id || s.slug === id);
            return item?.relatedSlugs ?? [];
          })
          .filter(slug => !selected.some(id => {
            const item = catalogStyles.find(s => s.id === id || s.slug === id);
            return item?.slug === slug;
          })),
      )]
    : [...new Set(selected.flatMap(id => RELATED_MAP[id] || []).filter(id => !selected.includes(id)))];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <Pressable
          onPress={selected.length > 0 ? undefined : () => router.push('/(onboarding)/colors')}
          style={styles.skipBtn}
        >
          <Text style={[styles.skipText, selected.length > 0 && { color: T.color.primary }]}>
            {selected.length > 0 ? `${selected.length} SELECTED` : 'SKIP'}
          </Text>

        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={{ height: 24 }} />
        <Text style={styles.h1}>Find your styles.</Text>
        <Text style={styles.caption}>Select what speaks to you. We'll learn as you go.</Text>
        <View style={{ height: 24 }} />

        {selected.length >= MAX_STYLES && (
          <Text style={[styles.caption, { color: T.color.tertiary, fontSize: 11 }]}>
            Maximum 5 styles selected
          </Text>
        )}

        {related.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedLabel}>
              YOU MIGHT ALSO LIKE
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 24 }}>
              {related.slice(0, 4).map(slug => {
                const s = styleList instanceof Array && styleList.length > 0 && 'slug' in styleList[0]
                  ? (styleList as StyleCatalogItem[]).find(x => x.slug === slug)
                  : STYLES.find(x => x.id === slug);
                if (!s) return null;
                const id = 'slug' in s ? s.id : (s as StyleOption).id;
                const isSelected = selected.includes(id);
                return (
                  <StyleCard
                    key={id}
                    style={s as StyleOption}
                    small
                    selected={isSelected}
                    onPress={() => toggle(id)}
                  />
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.grid}>
          {styleList.map(s => {
            const id = s.id;
            return (
              <StyleCard
                key={id}
                style={s as StyleOption}
                selected={selected.includes(id)}
                onPress={() => toggle(id)}
              />
            );
          })}
        </View>

        <View style={{ height: 24 }} />
        <PrimaryButton onPress={handleContinue} disabled={selected.length === 0}>
          {selected.length > 0 ? `CONTINUE (${selected.length} / ${MAX_STYLES})` : 'SELECT AT LEAST ONE'}
        </PrimaryButton>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  topBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  skipBtn: { paddingHorizontal: 12, height: 44, alignItems: 'center', justifyContent: 'center' },
  skipText: { ...type.ui, color: T.color.tertiary },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24 },
  h1: { ...type.h1, color: T.color.primary },
  caption: { ...type.caption, marginTop: 12 },
  relatedSection: { marginBottom: 24, marginHorizontal: -24 },
  relatedLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary, paddingHorizontal: 24, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { borderRadius: 2, overflow: 'hidden', position: 'relative' },
  cardGradient: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%',
    backgroundColor: 'rgba(26,24,21,0.5)',
  },
  cardLabel: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  cardName: { fontFamily: T.font.serif, fontSize: 18, fontWeight: '400', color: T.color.canvas },
  cardDesc: { ...type.ui, fontSize: 9, color: 'rgba(242,237,228,0.8)', marginTop: 4 },
  selectedBorder: { position: 'absolute', inset: 0, borderWidth: 2, borderColor: T.color.canvas } as any,
  checkCircle: {
    position: 'absolute', top: 10, right: 10,
    width: 24, height: 24, borderRadius: 999,
    backgroundColor: T.color.canvas,
    alignItems: 'center', justifyContent: 'center',
  },
});
