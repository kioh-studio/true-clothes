import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, TextLink, Field, Segmented } from '../../src/components/ui';
import { IconChevronLeft } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { useFitEngineStore } from '../../src/stores/fitEngineStore';

export default function MeasurementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setBodyMeasurements } = useFitEngineStore();
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [heightUnit, setHeightUnit] = useState('CM');
  const [weightUnit, setWeightUnit] = useState('KG');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [inseam, setInseam] = useState('');
  const [thigh, setThigh] = useState('');
  const [rise, setRise] = useState('');

  const handleContinue = async () => {
    const heightCm = height
      ? heightUnit === 'IN' ? parseFloat(height) * 2.54 : parseFloat(height)
      : undefined;
    const weightKg = weight
      ? weightUnit === 'LB' ? parseFloat(weight) * 0.453592 : parseFloat(weight)
      : undefined;

    await setBodyMeasurements({
      body_height: heightCm && !isNaN(heightCm) ? heightCm : undefined,
      body_weight: weightKg && !isNaN(weightKg) ? weightKg : undefined,
      body_bust:   chest  ? parseFloat(chest)  : undefined,
      body_waist:  waist  ? parseFloat(waist)  : undefined,
      body_hip:    hips   ? parseFloat(hips)   : undefined,
      body_inseam: inseam ? parseFloat(inseam) : undefined,
      body_thigh:  thigh  ? parseFloat(thigh)  : undefined,
      body_rise:   rise   ? parseFloat(rise)   : undefined,
    });
    router.push('/(onboarding)/styles');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <Pressable onPress={() => router.push('/(onboarding)/styles')} style={styles.skipBtn}>
          <Text style={styles.skipText}>SKIP</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={{ height: 32 }} />
        <Text style={styles.h1}>Your measurements.</Text>
        <Text style={styles.caption}>We use these to recommend items that fit your frame. Required fields are minimal.</Text>
        <View style={{ height: 40 }} />

        <Text style={styles.sectionLabel}>REQUIRED</Text>
        <View style={{ height: 16 }} />

        <View style={styles.fieldWithSegment}>
          <View style={{ flex: 1 }}>
            <Field label="HEIGHT" value={height} onChange={setHeight} placeholder="—" suffix={heightUnit.toLowerCase()} keyboardType="number-pad" />
          </View>
          <Segmented options={['CM', 'IN']} value={heightUnit} onChange={setHeightUnit} />
        </View>
        <View style={{ height: 16 }} />
        <View style={styles.fieldWithSegment}>
          <View style={{ flex: 1 }}>
            <Field label="WEIGHT" value={weight} onChange={setWeight} placeholder="—" suffix={weightUnit.toLowerCase()} keyboardType="number-pad" />
          </View>
          <Segmented options={['KG', 'LB']} value={weightUnit} onChange={setWeightUnit} />
        </View>

        <View style={{ height: 40 }} />
        <Text style={styles.sectionLabel}>OPTIONAL — IMPROVES ACCURACY</Text>
        <View style={{ height: 16 }} />

        <View style={styles.twoCol}>
          <View style={styles.colItem}>
            <Field label="CHEST / BUST" value={chest} onChange={setChest} placeholder="— cm" keyboardType="number-pad" />
          </View>
          <View style={styles.colItem}>
            <Field label="WAIST" value={waist} onChange={setWaist} placeholder="— cm" keyboardType="number-pad" />
          </View>
          <View style={styles.colItem}>
            <Field label="HIPS" value={hips} onChange={setHips} placeholder="— cm" keyboardType="number-pad" />
          </View>
          <View style={styles.colItem}>
            <Field label="INSEAM" value={inseam} onChange={setInseam} placeholder="— cm" keyboardType="number-pad" />
          </View>
          <View style={styles.colItem}>
            <Field label="THIGH" value={thigh} onChange={setThigh} placeholder="— cm" keyboardType="number-pad" />
          </View>
          <View style={styles.colItem}>
            <Field label="RISE" value={rise} onChange={setRise} placeholder="— cm" keyboardType="number-pad" />
          </View>
        </View>

        <View style={{ height: 32 }} />
        <View style={{ alignItems: 'center' }}>
          <TextLink color={T.color.primary} arrow>Estimate with AI photo capture</TextLink>
          <Text style={[type.caption, { fontSize: 11, color: T.color.tertiary, marginTop: 8, textAlign: 'center' }]}>
            Take a photo in fitted clothing. We'll estimate measurements with on-device AI.
          </Text>
        </View>

        <View style={{ height: 48 }} />
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
  content: { paddingHorizontal: 24 },
  h1: { ...type.h1, color: T.color.primary },
  caption: { ...type.caption, marginTop: 12 },
  sectionLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  fieldWithSegment: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  twoCol: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  colItem: { width: '47%' },
});
