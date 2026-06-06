import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, TextLink } from '../../src/components/ui';
import { IconChevronLeft } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { COLORS } from '../../src/data';
import { useFitEngineStore } from '../../src/stores/fitEngineStore';
import { Dimensions } from 'react-native';

const { width: W } = Dimensions.get('window');
const PAD = 24;
const GAP = 12;
const COLS = 3;
const SWATCH = (W - PAD * 2 - GAP * (COLS - 1)) / COLS;

const LIGHT_COLORS = ['#F2EDE4', '#D9C9A8', '#C8C5BF'];

export default function ColorsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setColorPreferences } = useFitEngineStore();
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (name: string) => setSelected(s => s.includes(name) ? s.filter(x => x !== name) : [...s, name]);

  const handleContinue = async () => {
    await setColorPreferences(selected);
    router.push('/(onboarding)/complete');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <Pressable
          onPress={selected.length > 0 ? undefined : handleContinue}
          style={styles.skipBtn}
        >
          <Text style={[styles.skipText, selected.length > 0 && { color: T.color.primary }]}>
            {selected.length > 0 ? `${selected.length} SELECTED` : 'SKIP'}
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={{ height: 24 }} />
        <Text style={styles.h1}>Your palette.</Text>
        <Text style={styles.caption}>Which tones do you reach for?</Text>
        <View style={{ height: 32 }} />

        <View style={styles.grid}>
          {COLORS.map(c => {
            const isLight = LIGHT_COLORS.includes(c.hex);
            const isSelected = selected.includes(c.name);
            return (
              <Pressable key={c.name} onPress={() => toggle(c.name)} style={styles.colorItem}>
                <View style={[styles.swatch, { backgroundColor: c.hex, borderWidth: isSelected ? 1 : 0, borderColor: T.color.primary }]}>
                  {isSelected && (
                    <View style={[styles.dot, { backgroundColor: isLight ? T.color.primary : T.color.canvas }]} />
                  )}
                </View>
                <Text style={styles.colorName}>{c.name}</Text>
                <Text style={styles.colorTag}>{c.tag}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: 24 }} />
        <View style={{ alignItems: 'center' }}>
          <TextLink onPress={handleContinue} color={T.color.primary}>
            I'm open to anything — surprise me.
          </TextLink>
        </View>
        <View style={{ height: 24 }} />
        <PrimaryButton onPress={handleContinue}>CONTINUE</PrimaryButton>
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
  content: { paddingHorizontal: PAD },
  h1: { ...type.h1, color: T.color.primary },
  caption: { ...type.caption, marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  colorItem: { width: SWATCH, alignItems: 'center' },
  swatch: { width: SWATCH, height: SWATCH, position: 'relative', alignItems: 'flex-end', justifyContent: 'flex-start', padding: 8 },
  dot: { width: 12, height: 12, borderRadius: 999 },
  colorName: { fontFamily: T.font.serif, fontSize: 14, fontWeight: '400', color: T.color.primary, textAlign: 'center', marginTop: 8 },
  colorTag: { ...type.ui, fontSize: 9, color: T.color.tertiary, textAlign: 'center', marginTop: 4 },
});
