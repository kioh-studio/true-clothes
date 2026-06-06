import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { PrimaryButton } from '../src/components/ui';
import { IconChevronLeft, IconCheck } from '../src/components/icons';
import { useFitEngineStore } from '../src/stores/fitEngineStore';
import { FORMULA_CATALOG, FormulaId } from '../src/services/fitEngine/formulaCatalog';

function FormulaCard({
  formula,
  selected,
  onPress,
}: {
  formula: typeof FORMULA_CATALOG[number];
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
          {formula.desc}
        </Text>
        <View style={[styles.tagPill, selected && styles.tagPillSelected]}>
          <Text style={[styles.tagText, selected && styles.tagTextSelected]}>
            {formula.shortDesc}
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
  const { formulaPreferences, setFormulaPreferences } = useFitEngineStore();

  const [selected, setSelected] = useState<FormulaId[]>(() => [...formulaPreferences]);
  const initialSelected = useRef([...selected]).current;

  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...initialSelected].sort());

  const toggle = (id: FormulaId) => {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    );
  };

  const handleSave = async () => {
    await setFormulaPreferences(selected);
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Formula preferences</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>Your formulas.</Text>
        <Text style={styles.caption}>
          Choose the outfit-building formulas you prefer. We'll generate outfits using these rules. Leave empty to use all.
        </Text>

        <View style={styles.stepRow}>
          <Text style={[styles.stepNum, { color: T.color.primary }]}>01</Text>
          <Text style={[styles.stepLabel, { color: T.color.primary }]}>FORMULAS</Text>
          <View style={styles.stepLine} />
          <Text style={styles.stepCount}>{selected.length} / {FORMULA_CATALOG.length}</Text>
        </View>

        <View style={styles.grid}>
          {FORMULA_CATALOG.map((f) => (
            <FormulaCard
              key={f.id}
              formula={f}
              selected={selected.includes(f.id)}
              onPress={() => toggle(f.id)}
            />
          ))}
        </View>

        {selected.length === 0 && (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              No formulas selected — your feed will use all 10 formulas for maximum variety.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky save bar */}
      <View style={[styles.saveBar, { paddingBottom: insets.bottom + 12 }]}>
        {dirty && (
          <Pressable
            onPress={() => setSelected([...initialSelected])}
            style={styles.discardBtn}
          >
            <Text style={styles.discardText}>DISCARD</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <PrimaryButton onPress={dirty ? handleSave : undefined} disabled={!dirty}>
            {dirty ? 'SAVE CHANGES' : 'NO CHANGES'}
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
});
