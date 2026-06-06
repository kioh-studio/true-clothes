import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { PrimaryButton, Photo } from '../src/components/ui';
import { IconChevronLeft, IconCheck } from '../src/components/icons';
import { STYLES, STYLE_NICHES } from '../src/data';
import { useFitEngineStore } from '../src/stores/fitEngineStore';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 24 * 2 - 12) / 2;

function StyleCard({ s, selected, onPress }: { s: typeof STYLES[number]; selected: boolean; onPress: () => void }) {
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
  const { styleProfile, setStyleProfile } = useFitEngineStore();

  const allStored = styleProfile.selectedStyles;
  const [selected, setSelected] = useState<string[]>(() => allStored.filter(id => !id.includes(':')));
  const [niches, setNiches] = useState<string[]>(() => allStored.filter(id => id.includes(':')));

  const initialSelected = useRef([...selected]).current;
  const initialNiches = useRef([...niches]).current;

  const dirty =
    JSON.stringify([...selected].sort()) !== JSON.stringify([...initialSelected].sort()) ||
    JSON.stringify([...niches].sort()) !== JSON.stringify([...initialNiches].sort());

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
    await setStyleProfile({ selectedStyles: [...selected, ...niches] });
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Style preferences</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>Your styles.</Text>
        <Text style={styles.caption}>
          Pick the aesthetics you lean into. We'll refine your feed within the hour.
        </Text>

        {/* Step 01 */}
        <View style={styles.stepRow}>
          <Text style={[styles.stepNum, { color: T.color.primary }]}>01</Text>
          <Text style={[styles.stepLabel, { color: T.color.primary }]}>AESTHETICS</Text>
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
          <Text style={[styles.stepLabel, { color: refinable.length ? T.color.primary : T.color.tertiary }]}>REFINE</Text>
          <View style={styles.stepLine} />
          <Text style={styles.stepCount}>{niches.length} PICKED</Text>
        </View>

        {refinable.length === 0 ? (
          <View style={styles.refineEmpty}>
            <Text style={styles.refineEmptyText}>
              Pick an aesthetic above to see niche directions tuned to it.
            </Text>
          </View>
        ) : (
          refinable.map((parentId) => {
            const parent = STYLES.find((s) => s.id === parentId)!;
            const list = STYLE_NICHES[parentId] || [];
            const parentNicheCount = niches.filter((n) => n.startsWith(parentId + ':')).length;
            return (
              <View key={parentId} style={{ marginBottom: 28 }}>
                <View style={styles.nicheHeader}>
                  <View>
                    <Text style={styles.nicheLabel}>BECAUSE YOU LIKE</Text>
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
            onPress={() => { setSelected([...initialSelected]); setNiches([...initialNiches]); }}
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
