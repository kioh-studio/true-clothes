import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { PrimaryButton } from '../src/components/ui';
import { IconChevronLeft } from '../src/components/icons';
import { COLORS, ColorOption } from '../src/data';
import { useFitEngineStore } from '../src/stores/fitEngineStore';

// Light colors that need a dark dot indicator
const LIGHT_HEXES = ['#F2EDE4', '#D9C9A8', '#C8C5BF'];

export default function ColorsEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorPreferences, setColorPreferences } = useFitEngineStore();

  const [selected, setSelected] = useState<string[]>(() => [...colorPreferences]);
  const initialColors = useRef([...selected]).current;

  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...initialColors].sort());

  const toggle = (name: string) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  // Group by tag
  const groups = COLORS.reduce<Record<string, ColorOption[]>>((acc, c) => {
    (acc[c.tag] ||= []).push(c);
    return acc;
  }, {});

  const handleSave = async () => {
    await setColorPreferences(selected);
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Color palette</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>Your palette.</Text>
        <Text style={styles.caption}>The tones we'll lean into for your outfits.</Text>

        {/* Selected palette strip */}
        <View style={{ height: 32 }} />
        <Text style={styles.sectionLabel}>CURRENT PALETTE · {selected.length}</Text>
        <View style={{ height: 12 }} />
        <View style={styles.strip}>
          {selected.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={styles.stripEmpty}>EMPTY · PICK FROM BELOW</Text>
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
          <Pressable onPress={() => setSelected([...initialColors])} style={styles.discardBtn}>
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
