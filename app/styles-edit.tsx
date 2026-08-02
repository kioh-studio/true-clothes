import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { PrimaryButton, Photo } from '../src/components/ui';
import { IconChevronLeft, IconCheck } from '../src/components/icons';
import { STYLES, STYLE_NICHES } from '../src/data';
import { useFitEngineStore } from '../src/stores/fitEngineStore';
import { useGridCardWidth, useGridColumns } from '../src/design/layout';
import { useTranslation } from '../src/i18n';

function StyleCard({ s, selected, onPress }: { s: typeof STYLES[number]; selected: boolean; onPress: () => void }) {
  const cols = useGridColumns();
  const CARD_W = useGridCardWidth(cols);
  const h = CARD_W * (4 / 3);
  return (
    <Pressable onPress={onPress} style={[styles.card, { width: CARD_W, height: h }]}>
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

export default function StylesEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { styleProfile, setStyleProfile, hydrated } = useFitEngineStore();

  const allStored = styleProfile.selectedStyles;
  const [selected, setSelected] = useState<string[]>(() => allStored.filter(id => !id.includes(':')));
  const [niches, setNiches] = useState<string[]>(() => allStored.filter(id => id.includes(':')));

  // Mutable "clean" baselines for the dirty check — re-anchored whenever a
  // late store hydrate adopts fresh data below (see effect), so a genuine
  // edit is never mistaken for a no-op just because it happened before or
  // after hydrate landed.
  const initialSelectedRef = useRef<string[]>([...selected]);
  const initialNichesRef = useRef<string[]>([...niches]);
  // Last store value we've reconciled against — lets the effect below tell
  // "the store just changed" apart from "this screen just re-rendered".
  const lastStoredRef = useRef<string[]>([...allStored]);

  const dirty =
    JSON.stringify([...selected].sort()) !== JSON.stringify([...initialSelectedRef.current].sort()) ||
    JSON.stringify([...niches].sort()) !== JSON.stringify([...initialNichesRef.current].sort());

  // styleProfile.selectedStyles hydrates asynchronously (fetched from
  // Supabase, and can re-run on the auth listener). If this screen mounted
  // before that finished, it arrives here later than useState's one-time
  // snapshot above. Re-sync when it changes — but only while the user hasn't
  // started editing yet (both local arrays still equal their previous store
  // snapshot) so an in-progress edit is never clobbered.
  useEffect(() => {
    const storeChanged = JSON.stringify(allStored) !== JSON.stringify(lastStoredRef.current);
    if (!storeChanged) return;
    lastStoredRef.current = [...allStored];
    const untouched =
      JSON.stringify([...selected].sort()) === JSON.stringify([...initialSelectedRef.current].sort()) &&
      JSON.stringify([...niches].sort()) === JSON.stringify([...initialNichesRef.current].sort());
    if (untouched) {
      const nextSelected = allStored.filter(id => !id.includes(':'));
      const nextNiches = allStored.filter(id => id.includes(':'));
      setSelected(nextSelected);
      setNiches(nextNiches);
      initialSelectedRef.current = [...nextSelected];
      initialNichesRef.current = [...nextNiches];
    }
  }, [allStored, selected, niches]);

  const toggle = (id: string) => {
    setSelected((s) => {
      if (s.includes(id)) {
        const childIds = (STYLE_NICHES[id] || []).map((n) => n.id);
        setNiches((ns) => ns.filter((n) => !childIds.includes(n)));
        return s.filter((x) => x !== id);
      }
      return [...s, id];
    });
  };

  const toggleNiche = (id: string) =>
    setNiches((ns) => (ns.includes(id) ? ns.filter((x) => x !== id) : [...ns, id]));

  const refinable = selected.filter((id) => (STYLE_NICHES[id] || []).length > 0);

  const handleSave = async () => {
    if (!hydrated) return;
    await setStyleProfile({ selectedStyles: [...selected, ...niches] });
    router.back();
  };

  const isNoneActive = selected.length === 0 && niches.length === 0;
  const clearAll = () => { setSelected([]); setNiches([]); };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('tabs_menu_stylePreferences')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>{t('stylesEdit_title')}</Text>
        <Text style={styles.caption}>
          {t('stylesEdit_caption')}
        </Text>

        {/* None / no style preference — explicit control so clearing every
            selection reads as a deliberate choice, not an empty/broken screen */}
        <View style={{ height: 24 }} />
        <Pressable
          onPress={clearAll}
          style={[styles.noneRow, isNoneActive && styles.noneRowActive]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.noneLabel, isNoneActive && styles.noneLabelActive]}>
              {t('stylesEdit_noneOption')}
            </Text>
            <Text style={[styles.noneHint, isNoneActive && styles.noneHintActive]}>
              {t('stylesEdit_noneHint')}
            </Text>
          </View>
          {isNoneActive && (
            <View style={styles.noneCheckCircle}>
              <IconCheck size={12} color={T.color.canvas} strokeWidth={1.8} />
            </View>
          )}
        </Pressable>

        {/* Step 01 */}
        <View style={styles.stepRow}>
          <Text style={[styles.stepNum, { color: T.color.primary }]}>01</Text>
          <Text style={[styles.stepLabel, { color: T.color.primary }]}>{t('stylesEdit_aestheticsLabel')}</Text>
          <View style={styles.stepLine} />
          <Text style={styles.stepCount}>{selected.length} / {STYLES.length}</Text>
        </View>

        <View style={styles.grid}>
          {STYLES.map((s) => (
            <StyleCard key={s.id} s={s} selected={selected.includes(s.id)} onPress={() => toggle(s.id)} />
          ))}
        </View>

        {/* Step 02 — Refinement */}
        <View style={[styles.stepRow, { marginTop: 40 }]}>
          <Text style={[styles.stepNum, { color: refinable.length ? T.color.primary : T.color.tertiary }]}>02</Text>
          <Text style={[styles.stepLabel, { color: refinable.length ? T.color.primary : T.color.tertiary }]}>{t('stylesEdit_refineLabel')}</Text>
          <View style={styles.stepLine} />
          <Text style={styles.stepCount}>{t('stylesEdit_pickedCount', { count: niches.length })}</Text>
        </View>

        {refinable.length === 0 ? (
          <View style={styles.refineEmpty}>
            <Text style={styles.refineEmptyText}>
              {t('stylesEdit_refineEmptyText')}
            </Text>
          </View>
        ) : (
          refinable.map((parentId) => {
            const parent = STYLES.find((s) => s.id === parentId);
            if (!parent) return null;
            const list = STYLE_NICHES[parentId] || [];
            const parentNicheCount = niches.filter((n) => n.startsWith(parentId + ':')).length;
            return (
              <View key={parentId} style={{ marginBottom: 28 }}>
                <View style={styles.nicheHeader}>
                  <View>
                    <Text style={styles.nicheLabel}>{t('stylesEdit_becauseYouLikeLabel')}</Text>
                    <Text style={styles.nicheParent}>{parent.name}</Text>
                  </View>
                  <Text style={styles.stepCount}>{parentNicheCount} / {list.length}</Text>
                </View>
                <View style={styles.nicheGrid}>
                  {list.map((n) => {
                    const isSelected = niches.includes(n.id);
                    return (
                      <Pressable
                        key={n.id}
                        onPress={() => toggleNiche(n.id)}
                        style={[styles.nicheBtn, isSelected && styles.nicheBtnSelected]}
                      >
                        <Text style={[styles.nicheName, isSelected && styles.nicheNameSelected]}>
                          {n.name}
                        </Text>
                        <Text style={[styles.nicheDesc, isSelected && styles.nicheDescSelected]}>
                          {n.desc}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Sticky save bar */}
      <View style={[styles.saveBar, { paddingBottom: insets.bottom + 12 }]}>
        {dirty && (
          <Pressable
            onPress={() => { setSelected([...initialSelectedRef.current]); setNiches([...initialNichesRef.current]); }}
            style={styles.discardBtn}
          >
            <Text style={styles.discardText}>{t('common_discard')}</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <PrimaryButton onPress={hydrated && dirty ? handleSave : undefined} disabled={!hydrated || !dirty}>
            {!hydrated ? t('common_loadingPreferences') : dirty ? t('profileEdit_saveButton') : t('common_noChanges')}
          </PrimaryButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: { ...type.h3, color: T.color.primary },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24, paddingTop: 8 },
  h1: { ...type.h1, color: T.color.primary },
  caption: { ...type.caption, marginTop: 12 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    marginBottom: 16,
  },
  stepNum: { ...type.ui, fontSize: 10 },
  stepLabel: { ...type.ui, fontSize: 10 },
  stepLine: { flex: 1, height: 0.5, backgroundColor: T.color.hairline },
  stepCount: { ...type.ui, fontSize: 9, color: T.color.tertiary },
  noneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
  },
  noneRowActive: {
    backgroundColor: T.color.primary,
    borderWidth: 0,
  },
  noneLabel: {
    fontFamily: T.font.serif,
    fontSize: 14,
    fontWeight: '400',
    color: T.color.primary,
  },
  noneLabelActive: { color: T.color.canvas },
  noneHint: { ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 4 },
  noneHintActive: { color: 'rgba(250,247,242,0.7)' },
  noneCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(250,247,242,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { overflow: 'hidden', position: 'relative' },
  cardGradient: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: '45%',
    backgroundColor: 'rgba(26,24,21,0.45)',
  },
  cardLabel: { position: 'absolute', left: 12, bottom: 12 },
  cardName: {
    fontFamily: T.font.serif,
    fontSize: 18,
    fontWeight: '400',
    color: T.color.canvas,
    lineHeight: 22,
  },
  cardDesc: { ...type.ui, fontSize: 9, color: 'rgba(242,237,228,0.75)', marginTop: 4 },
  selectedBorder: {
    position: 'absolute',
    inset: 0,
    borderWidth: 1.5,
    borderColor: T.color.canvas,
  } as any,
  checkCircle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: T.color.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refineEmpty: {
    padding: 32,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    borderStyle: 'dashed',
  },
  refineEmptyText: { ...type.caption, fontSize: 12, color: T.color.tertiary, textAlign: 'center' },
  nicheHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  nicheLabel: { ...type.ui, fontSize: 9, color: T.color.tertiary },
  nicheParent: {
    fontFamily: T.font.serif,
    fontSize: 22,
    fontWeight: '400',
    color: T.color.primary,
    marginTop: 4,
  },
  nicheGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nicheBtn: {
    width: '48%',
    padding: 14,
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    minHeight: 72,
    justifyContent: 'center',
  },
  nicheBtnSelected: { backgroundColor: T.color.primary, borderWidth: 0 },
  nicheName: {
    fontFamily: T.font.serif,
    fontSize: 14,
    fontWeight: '400',
    color: T.color.primary,
    lineHeight: 16,
  },
  nicheNameSelected: { color: T.color.canvas },
  nicheDesc: { ...type.caption, fontSize: 11, color: T.color.tertiary, marginTop: 4 },
  nicheDescSelected: { color: 'rgba(250,247,242,0.65)' },
  saveBar: {
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
    backgroundColor: T.color.canvas,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  discardBtn: { height: 56, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  discardText: { ...type.ui, fontSize: 10, color: T.color.tertiary },
});
