import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { Field, PrimaryButton, Tag, Segmented, TextLink } from '../src/components/ui';
import { IconChevronLeft } from '../src/components/icons';
import { useFitEngineStore } from '../src/stores/fitEngineStore';

import type { PreferredFit } from '../src/types/fitEngine';

const FIT_OPTIONS: PreferredFit[] = ['SLIM', 'REGULAR', 'RELAXED', 'OVERSIZED'];

function cmStr(val?: number) { return val ? String(Math.round(val)) : ''; }

export default function MeasurementsEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bodyMeasurements, setBodyMeasurements } = useFitEngineStore();
  const bm = bodyMeasurements;

  const [v, setV] = useState({
    height:     cmStr(bm.body_height),
    heightUnit: 'CM',
    weight:     cmStr(bm.body_weight),
    weightUnit: 'KG',
    chest:      cmStr(bm.body_bust),
    waist:      cmStr(bm.body_waist),
    hips:       cmStr(bm.body_hip),
    inseam:     cmStr(bm.body_inseam),
    thigh:      cmStr(bm.body_thigh),
    rise:       cmStr(bm.body_rise),
    fit:        (bm.preferredFit ?? 'REGULAR') as PreferredFit,
  });

  const initial = useRef({ ...v }).current;
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  const handleSave = async () => {
    const heightCm = v.height
      ? v.heightUnit === 'IN' ? parseFloat(v.height) * 2.54 : parseFloat(v.height)
      : undefined;
    const weightKg = v.weight
      ? v.weightUnit === 'LB' ? parseFloat(v.weight) * 0.453592 : parseFloat(v.weight)
      : undefined;

    await setBodyMeasurements({
      body_height: heightCm && !isNaN(heightCm) ? heightCm : undefined,
      body_weight: weightKg && !isNaN(weightKg) ? weightKg : undefined,
      body_bust:   v.chest  ? parseFloat(v.chest)  : undefined,
      body_waist:  v.waist  ? parseFloat(v.waist)  : undefined,
      body_hip:    v.hips   ? parseFloat(v.hips)   : undefined,
      body_inseam: v.inseam ? parseFloat(v.inseam) : undefined,
      body_thigh:  v.thigh  ? parseFloat(v.thigh)  : undefined,
      body_rise:   v.rise   ? parseFloat(v.rise)   : undefined,
      preferredFit: v.fit as PreferredFit,
    });
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Size & measurements</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>Measurements.</Text>
        <Text style={styles.caption}>We use these for fit recommendations and the AI try-on.</Text>

        <View style={{ height: 32 }} />
        <Text style={styles.sectionLabel}>BASICS</Text>

        <View style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Field
              label="HEIGHT"
              value={v.height}
              onChange={(val) => set('height', val)}
              placeholder="—"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.unitToggle}>
            <Segmented
              options={['CM', 'IN']}
              value={v.heightUnit}
              onChange={(u) => set('heightUnit', u)}
            />
          </View>
        </View>

        <View style={{ height: 16 }} />
        <View style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Field
              label="WEIGHT"
              value={v.weight}
              onChange={(val) => set('weight', val)}
              placeholder="—"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.unitToggle}>
            <Segmented
              options={['KG', 'LB']}
              value={v.weightUnit}
              onChange={(u) => set('weightUnit', u)}
            />
          </View>
        </View>

        <View style={{ height: 40 }} />
        <Text style={styles.sectionLabel}>BODY · IMPROVES ACCURACY</Text>
        <View style={{ height: 16 }} />
        <View style={styles.grid2}>
          <Field label="CHEST / BUST" value={v.chest}  onChange={(val) => set('chest', val)}  placeholder="— cm" keyboardType="numeric" />
          <Field label="WAIST"        value={v.waist}  onChange={(val) => set('waist', val)}  placeholder="— cm" keyboardType="numeric" />
          <Field label="HIPS"         value={v.hips}   onChange={(val) => set('hips', val)}   placeholder="— cm" keyboardType="numeric" />
          <Field label="INSEAM"       value={v.inseam} onChange={(val) => set('inseam', val)} placeholder="— cm" keyboardType="numeric" />
          <Field label="THIGH"        value={v.thigh}  onChange={(val) => set('thigh', val)}  placeholder="— cm" keyboardType="numeric" />
          <Field label="RISE"         value={v.rise}   onChange={(val) => set('rise', val)}   placeholder="— cm" keyboardType="numeric" />
        </View>

        <View style={{ height: 40 }} />
        <Text style={styles.sectionLabel}>PREFERRED FIT</Text>
        <View style={{ height: 12 }} />
        <View style={styles.fitRow}>
          {FIT_OPTIONS.map((f) => (
            <Tag key={f} selected={v.fit === f} onPress={() => set('fit', f)}>{f}</Tag>
          ))}
        </View>

        <View style={{ height: 32 }} />
        <View style={{ alignItems: 'center' }}>
          <TextLink color={T.color.primary} arrow>Re-estimate with AI photo capture</TextLink>
          <Text style={[styles.caption, { textAlign: 'center', marginTop: 8, fontSize: 11 }]}>
            Take a photo in fitted clothing — we'll re-estimate on device.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky save bar */}
      <View style={[styles.saveBar, { paddingBottom: insets.bottom + 12 }]}>
        {dirty && (
          <Pressable onPress={() => setV({ ...initial })} style={styles.discardBtn}>
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
  caption: { ...type.caption },
  sectionLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  unitToggle: { marginTop: 24 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  fitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
