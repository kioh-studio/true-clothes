import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { PrimaryButton } from '../src/components/ui';
import { IconChevronLeft, IconCheck } from '../src/components/icons';
import { COLORS, ColorOption } from '../src/data';
import { useFitEngineStore } from '../src/stores/fitEngineStore';
import { useTranslation } from '../src/i18n';

// Light colors that need a dark dot indicator
const LIGHT_HEXES = ['#F2EDE4', '#D9C9A8', '#C8C5BF'];

export default function ColorsEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colorPreferences, setColorPreferences, hydrated } = useFitEngineStore();

  const [selected, setSelected] = useState<string[]>(() => [...colorPreferences]);
  // Mutable "clean" baseline for the dirty check — re-anchored whenever a
  // late store hydrate adopts fresh data below (see effect), so a genuine
  // edit is never mistaken for a no-op just because it happened before or
  // after hydrate landed.
  const initialColorsRef = useRef<string[]>([...colorPreferences]);
  // Last store value we've reconciled against — lets the effect below tell
  // "the store just changed" apart from "this screen just re-rendered".
  const lastStoreRef = useRef<string[]>([...colorPreferences]);

  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...initialColorsRef.current].sort());

  // The store hydrates asynchronously (fetches colour preferences from
  // Supabase, and can re-run on the auth listener). If this screen mounted
  // before that finished, colorPreferences arrives here later than useState's
  // one-time snapshot above. Re-sync when it changes — but only while the
  // user hasn't started editing yet (local selection still equals the
  // previous store snapshot) so an in-progress edit is never clobbered.
  useEffect(() => {
    const storeChanged = JSON.stringify(colorPreferences) !== JSON.stringify(lastStoreRef.current);
    if (!storeChanged) return;
    lastStoreRef.current = [...colorPreferences];
    const untouched = JSON.stringify([...selected].sort()) === JSON.stringify([...initialColorsRef.current].sort());
    if (untouched) {
      setSelected([...colorPreferences]);
      initialColorsRef.current = [...colorPreferences];
    }
  }, [colorPreferences, selected]);

  const toggle = (name: string) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  // Group by tag
  const groups = COLORS.reduce<Record<string, ColorOption[]>>((acc, c) => {
    (acc[c.tag] ||= []).push(c);
    return acc;
  }, {});

  const handleSave = async () => {
    if (!hydrated) return;
    await setColorPreferences(selected);
    router.back();
  };

  const isNoneActive = selected.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('tabs_menu_colorPalette')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>{t('colorsEdit_title')}</Text>
        <Text style={styles.caption}>{t('colorsEdit_caption')}</Text>

        {/* Selected palette strip */}
        <View style={{ height: 32 }} />
        <Text style={styles.sectionLabel}>{t('colorsEdit_currentPaletteLabel', { count: selected.length })}</Text>
        <View style={{ height: 12 }} />
        <View style={styles.strip}>
          {selected.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={styles.stripEmpty}>{t('colorsEdit_emptyLabel')}</Text>
            </View>
          ) : (
            selected.map((name) => {
              const c = COLORS.find((x) => x.name === name);
              return c ? (
                <View key={name} style={[styles.stripSwatch, { backgroundColor: c.hex }]} />
              ) : null;
            })
          )}
        </View>

        {/* None / no colour preference — explicit control so clearing every
            selection reads as a deliberate choice, not an empty/broken screen */}
        <View style={{ height: 16 }} />
        <Pressable
          onPress={() => setSelected([])}
          style={[styles.noneRow, isNoneActive && styles.noneRowActive]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.noneLabel, isNoneActive && styles.noneLabelActive]}>
              {t('colorsEdit_noneOption')}
            </Text>
            <Text style={[styles.noneHint, isNoneActive && styles.noneHintActive]}>
              {t('colorsEdit_noneHint')}
            </Text>
          </View>
          {isNoneActive && (
            <View style={styles.noneCheckCircle}>
              <IconCheck size={12} color={T.color.canvas} strokeWidth={1.8} />
            </View>
          )}
        </Pressable>

        {/* Grouped swatches */}
        {Object.entries(groups).map(([tag, list]) => (
          <View key={tag} style={{ marginTop: 32 }}>
            <Text style={styles.sectionLabel}>{tag}</Text>
            <View style={{ height: 12 }} />
            <View style={styles.swatchGrid}>
              {list.map((c) => {
                const isLight = LIGHT_HEXES.includes(c.hex);
                const isSelected = selected.includes(c.name);
                return (
                  <Pressable key={c.name} onPress={() => toggle(c.name)} style={styles.swatchItem}>
                    <View
                      style={[
                        styles.swatchColor,
                        { backgroundColor: c.hex },
                        isSelected && styles.swatchSelected,
                      ]}
                    >
                      {isSelected && (
                        <View
                          style={[
                            styles.swatchDot,
                            { backgroundColor: isLight ? T.color.primary : T.color.canvas },
                          ]}
                        />
                      )}
                    </View>
                    <Text style={styles.swatchName}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Sticky save bar */}
      <View style={[styles.saveBar, { paddingBottom: insets.bottom + 12 }]}>
        {dirty && (
          <Pressable onPress={() => setSelected([...initialColorsRef.current])} style={styles.discardBtn}>
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
  sectionLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  strip: {
    height: 56,
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    backgroundColor: T.color.elevated,
    overflow: 'hidden',
  },
  stripSwatch: { flex: 1 },
  stripEmpty: { ...type.micro, color: T.color.tertiary },
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
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatchItem: {
    width: '22%',
    alignItems: 'center',
  },
  swatchColor: {
    aspectRatio: 1,
    width: '100%',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 6,
  },
  swatchSelected: {
    borderWidth: 1,
    borderColor: T.color.primary,
  },
  swatchDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  swatchName: {
    fontFamily: T.font.serif,
    fontSize: 12,
    fontWeight: '400',
    color: T.color.primary,
    textAlign: 'center',
    marginTop: 6,
  },
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
