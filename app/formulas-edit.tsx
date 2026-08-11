import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { PrimaryButton } from '../src/components/ui';
import { IconChevronLeft, IconCheck } from '../src/components/icons';
import { useFitEngineStore } from '../src/stores/fitEngineStore';
import { FormulaCatalogItem } from '../src/services/formulasCatalogService';
import { useTranslation } from '../src/i18n';

function FormulaCard({
  formula,
  selected,
  onPress,
}: {
  formula: FormulaCatalogItem;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.card, selected && styles.cardSelected]}>
      <View style={styles.cardContent}>
        <Text style={[styles.cardName, selected && styles.cardNameSelected]}>
          {formula.name}
        </Text>
        <Text style={[styles.cardDesc, selected && styles.cardDescSelected]}>
          {formula.description}
        </Text>
        <View style={[styles.tagPill, selected && styles.tagPillSelected]}>
          <Text style={[styles.tagText, selected && styles.tagTextSelected]}>
            {formula.slug.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
      </View>
      {selected && (
        <View style={styles.checkCircle}>
          <IconCheck size={14} color={T.color.canvas} strokeWidth={1.8} />
        </View>
      )}
    </Pressable>
  );
}

export default function FormulasEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { formulaPreferences, setFormulaPreferences, formulas, loadCatalogs, hydrated } = useFitEngineStore();
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(false);

  useEffect(() => {
    if (formulas.length === 0) {
      setCatalogLoading(true);
      setCatalogError(false);
      loadCatalogs().finally(() => {
        // loadCatalogs swallows errors; detect failure by checking store after resolve
        const stillEmpty = useFitEngineStore.getState().formulas.length === 0;
        setCatalogError(stillEmpty);
        setCatalogLoading(false);
      });
    }
  }, [formulas.length, loadCatalogs]);

  const [selected, setSelected] = useState<string[]>(() => [...formulaPreferences]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  // Mutable "clean" baseline for the dirty check — re-anchored whenever a
  // late store hydrate adopts fresh data below (see effect), so a genuine
  // edit is never mistaken for a no-op just because it happened before or
  // after hydrate landed.
  const initialSelectedRef = useRef<string[]>([...selected]);
  // Last store value we've reconciled against — lets the effect below tell
  // "the store just changed" apart from "this screen just re-rendered".
  const lastStoreRef = useRef<string[]>([...formulaPreferences]);

  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...initialSelectedRef.current].sort());

  // formulaPreferences hydrates asynchronously (fetched from Supabase, and
  // can re-run on the auth listener). If this screen mounted before that
  // finished, it arrives here later than useState's one-time snapshot above.
  // Re-sync when it changes — but only while the user hasn't started editing
  // yet (local selection still equals the previous store snapshot) so an
  // in-progress edit is never clobbered.
  useEffect(() => {
    const storeChanged = JSON.stringify(formulaPreferences) !== JSON.stringify(lastStoreRef.current);
    if (!storeChanged) return;
    lastStoreRef.current = [...formulaPreferences];
    const untouched = JSON.stringify([...selected].sort()) === JSON.stringify([...initialSelectedRef.current].sort());
    if (untouched) {
      setSelected([...formulaPreferences]);
      initialSelectedRef.current = [...formulaPreferences];
    }
  }, [formulaPreferences, selected]);

  const toggle = (slug: string) => {
    setSelected((s) =>
      s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]
    );
  };

  const handleSave = async () => {
    if (!hydrated || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await setFormulaPreferences(selected);
      router.back();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('fitEngineStore_syncFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('tabs_profile_formulaPreferences')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>{t('formulasEdit_title')}</Text>
        <Text style={styles.caption}>
          {t('formulasEdit_caption')}
        </Text>

        <View style={styles.stepRow}>
          <Text style={[styles.stepNum, { color: T.color.primary }]}>01</Text>
          <Text style={[styles.stepLabel, { color: T.color.primary }]}>{t('formulasEdit_formulasLabel')}</Text>
          <View style={styles.stepLine} />
          <Text style={styles.stepCount}>{selected.length} / {formulas.length}</Text>
        </View>

        {catalogLoading ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>{t('formulasEdit_loadingText')}</Text>
          </View>
        ) : catalogError || formulas.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>
              {catalogError
                ? t('formulasEdit_loadErrorText')
                : t('formulasEdit_noFormulasText')}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {formulas.map((f) => (
              <FormulaCard
                key={f.id}
                formula={f}
                selected={selected.includes(f.slug)}
                onPress={() => toggle(f.slug)}
              />
            ))}
          </View>
        )}

        {!catalogLoading && !catalogError && selected.length === 0 && (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              {t('formulasEdit_noneSelectedHint')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky save bar */}
      <View style={[styles.saveBar, { paddingBottom: insets.bottom + 12 }]}>
        {saveError ? (
          <Text style={[styles.saveError, { position: 'absolute', top: -28, left: 24, right: 24 }]}>{saveError}</Text>
        ) : null}
        {dirty && (
          <Pressable
            onPress={() => { setSelected([...initialSelectedRef.current]); setSaveError(''); }}
            style={styles.discardBtn}
          >
            <Text style={styles.discardText}>{t('common_discard')}</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <PrimaryButton onPress={hydrated && dirty && !saving ? handleSave : undefined} disabled={!hydrated || !dirty || saving}>
            {!hydrated ? t('common_loadingPreferences') : saving ? t('addItem_savingText') : dirty ? t('profileEdit_saveButton') : t('common_noChanges')}
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
  grid: { gap: 12 },
  card: {
    padding: 20,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  cardSelected: {
    backgroundColor: T.color.primary,
    borderWidth: 0,
  },
  cardContent: {},
  cardName: {
    fontFamily: T.font.serif,
    fontSize: 18,
    fontWeight: '400',
    color: T.color.primary,
    lineHeight: 22,
  },
  cardNameSelected: { color: T.color.canvas },
  cardDesc: {
    ...type.caption,
    fontSize: 12,
    color: T.color.secondary,
    marginTop: 6,
  },
  cardDescSelected: { color: 'rgba(250,247,242,0.7)' },
  tagPill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
  },
  tagPillSelected: {
    borderColor: 'rgba(250,247,242,0.3)',
  },
  tagText: { ...type.ui, fontSize: 9, color: T.color.tertiary },
  tagTextSelected: { color: 'rgba(250,247,242,0.6)' },
  checkCircle: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(250,247,242,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBox: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  stateText: { ...type.caption, fontSize: 13, color: T.color.tertiary, textAlign: 'center' },
  hintBox: {
    marginTop: 20,
    padding: 20,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  hintText: { ...type.caption, fontSize: 12, color: T.color.tertiary, textAlign: 'center' },
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
  saveError: { ...type.caption, fontSize: 12, color: '#A33', textAlign: 'center' },
});
