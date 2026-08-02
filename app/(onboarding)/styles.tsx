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
import { useGridCardWidth, useGridColumns } from '../../src/design/layout';
import { useTranslation } from '../../src/i18n';

const RELATED_MAP: Record<string, string[]> = {
  oldmoney: ['preppy', 'smartcasual'],
  streetwear: ['athleisure', 'y2k'],
  minimalist: ['smartcasual'],
  smartcasual: ['oldmoney', 'preppy'],
};

// Fallback to the static catalog for image/description when the DB row
// has NULL values (many live rows are missing image_url/description).
function withStaticFallback(s: StyleCatalogItem | StyleOption): StyleOption {
  if ('img' in s) return s;
  const fallback = STYLES.find(x => x.id === s.id);
  return {
    id: s.id,
    name: s.name,
    desc: s.description ?? fallback?.desc ?? '',
    img: s.imageUrl ?? fallback?.img ?? '',
  };
}

function StyleCard({ style: s, selected, onPress, small = false, cols }: { style: StyleCatalogItem | StyleOption; selected: boolean; onPress: () => void; small?: boolean; cols?: number }) {
  const CARD_W = useGridCardWidth(cols ?? 2);
  const w = small ? 130 : CARD_W;
  const h = w * (4 / 3);
  const view = withStaticFallback(s);
  return (
    <Pressable onPress={onPress} style={[styles.card, { width: w, height: h }]}>
      <Photo src={view.img} label={view.name} tone={selected ? 0 : 2} style={StyleSheet.absoluteFillObject} />
      <View style={styles.cardGradient} />
      <View style={styles.cardLabel}>
        <Text style={styles.cardName}>{view.name}</Text>
        <Text style={styles.cardDesc}>{view.desc}</Text>
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
  const { t } = useTranslation();
  const { setStyleProfile, styles: catalogStyles } = useFitEngineStore();
  const [selected, setSelected] = useState<string[]>([]);
  const cols = useGridColumns();

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

  // Build related from catalog neighbors (top by weight) if available, else RELATED_MAP
  const related = catalogStyles.length > 0
    ? [...new Set(
        selected
          .flatMap(id => {
            const item = catalogStyles.find(s => s.id === id);
            return [...(item?.neighbors ?? [])]
              .sort((a, b) => b.weight - a.weight)
              .slice(0, 4)
              .map(n => n.id);
          })
          .filter(id => !selected.includes(id)),
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
            {selected.length > 0 ? t('onboardingCommon_selectedCount', { count: selected.length }) : t('onboarding_styles_skip')}
          </Text>

        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={{ height: 24 }} />
        <Text style={styles.h1}>{t('onboarding_styles_title')}</Text>
        <Text style={styles.caption}>{t('onboarding_styles_subtitle')}</Text>
        <View style={{ height: 24 }} />

        {selected.length >= MAX_STYLES && (
          <Text style={[styles.caption, { color: T.color.tertiary, fontSize: 11 }]}>
            {t('onboarding_styles_maximumSelected')}
          </Text>
        )}

        {related.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedLabel}>
              {t('onboarding_styles_youMightAlsoLike')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 24 }}>
              {related.slice(0, 4).map(id => {
                const s = catalogStyles.length > 0
                  ? catalogStyles.find(x => x.id === id)
                  : STYLES.find(x => x.id === id);
                if (!s) return null;
                const isSelected = selected.includes(id);
                return (
                  <StyleCard
                    key={id}
                    style={s}
                    small
                    cols={cols}
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
                style={s}
                cols={cols}
                selected={selected.includes(id)}
                onPress={() => toggle(id)}
              />
            );
          })}
        </View>

        <View style={{ height: 24 }} />
        <PrimaryButton onPress={handleContinue} disabled={selected.length === 0}>
          {selected.length > 0 ? t('onboardingStyles_continueWithCount', { count: selected.length, max: MAX_STYLES }) : t('onboarding_styles_selectAtLeastOne')}
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
