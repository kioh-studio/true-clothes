import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { PrimaryButton } from '../src/components/ui';
import { IconChevronLeft } from '../src/components/icons';
import { useFitEngineStore } from '../src/stores/fitEngineStore';
import { ShapeGoal } from '../src/services/styleProfileService';
import { useTranslation } from '../src/i18n';

// Options in display order — 'auto' (default) and 'natural' first (the two
// non-shape-specific choices), then the 5 specific geometric shapes reusing
// the SAME i18n vocabulary the feed card chip already uses (outfitShape_*),
// so "hourglass" reads identically everywhere in the app.
const OPTIONS: Array<{ id: ShapeGoal; labelKey: string; descKey: string }> = [
  { id: 'auto', labelKey: 'shapeGoal_auto_label', descKey: 'shapeGoal_auto_desc' },
  { id: 'natural', labelKey: 'shapeGoal_natural_label', descKey: 'shapeGoal_natural_desc' },
  { id: 'hourglass', labelKey: 'outfitShape_hourglass', descKey: 'shapeGoal_hourglass_desc' },
  { id: 'rectangle', labelKey: 'outfitShape_rectangle', descKey: 'shapeGoal_rectangle_desc' },
  { id: 'oval', labelKey: 'outfitShape_oval', descKey: 'shapeGoal_oval_desc' },
  { id: 'inverted-triangle', labelKey: 'outfitShape_invertedTriangle', descKey: 'shapeGoal_invertedTriangle_desc' },
  { id: 'triangle', labelKey: 'outfitShape_triangle', descKey: 'shapeGoal_triangle_desc' },
];

export default function ShapeGoalEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { shapeGoal, setShapeGoal, hydrated } = useFitEngineStore();

  const [selected, setSelected] = useState<ShapeGoal>(shapeGoal);
  // Mutable "clean" baseline for the dirty check, re-anchored whenever a late
  // store hydrate adopts fresh data below (mirrors formulas-edit.tsx's ref
  // pattern, adapted for a single value instead of an array).
  const initialRef = useRef<ShapeGoal>(shapeGoal);
  const lastStoreRef = useRef<ShapeGoal>(shapeGoal);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (shapeGoal === lastStoreRef.current) return;
    lastStoreRef.current = shapeGoal;
    if (selected === initialRef.current) {
      setSelected(shapeGoal);
      initialRef.current = shapeGoal;
    }
  }, [shapeGoal, selected]);

  const dirty = selected !== initialRef.current;

  const handleSave = async () => {
    if (!hydrated || saving) return;
    setSaving(true);
    try {
      await setShapeGoal(selected);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('tabs_profile_shapeGoal')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>{t('shapeGoalEdit_title')}</Text>
        <Text style={styles.caption}>{t('shapeGoalEdit_caption')}</Text>

        <View style={{ height: 32 }} />

        {OPTIONS.map(opt => (
          <Pressable
            key={opt.id}
            onPress={() => setSelected(opt.id)}
            style={[styles.optionRow, selected === opt.id && styles.optionRowSelected]}
          >
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>{t(opt.labelKey).toUpperCase()}</Text>
              <Text style={styles.optionDesc}>{t(opt.descKey)}</Text>
            </View>
            {selected === opt.id && <View style={styles.checkDot} />}
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.saveBar, { paddingBottom: insets.bottom + 12 }]}>
        <PrimaryButton onPress={hydrated && dirty && !saving ? handleSave : undefined} disabled={!hydrated || !dirty || saving}>
          {!hydrated ? t('common_loadingPreferences') : dirty ? t('profileEdit_saveButton') : t('common_noChanges')}
        </PrimaryButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
  },
  headerTitle: { ...type.h3, color: T.color.primary },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24, paddingTop: 8 },
  h1: { ...type.h1, color: T.color.primary },
  caption: { ...type.caption, marginTop: 12 },

  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18,
    borderBottomWidth: 0.5, borderBottomColor: T.color.hairline,
  },
  optionRowSelected: { borderBottomColor: T.color.primary },
  optionText: { flex: 1 },
  optionLabel: { ...type.ui, color: T.color.primary, letterSpacing: 0.8 },
  optionDesc: { ...type.caption, color: T.color.secondary, marginTop: 4 },
  checkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.color.primary, flexShrink: 0 },

  saveBar: {
    borderTopWidth: 0.5, borderTopColor: T.color.hairline, backgroundColor: T.color.canvas,
    paddingHorizontal: 24, paddingTop: 12,
  },
});
