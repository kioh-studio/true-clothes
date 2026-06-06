import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, TextLink, Field } from '../../src/components/ui';
import { IconChevronLeft, IconPin } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { useAuthStore } from '../../src/stores/authStore';

const DETECTED = 'Ho Chi Minh City, Vietnam';

export default function LocationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setProfile } = useAuthStore();
  const [manual, setManual] = useState('');

  const handleContinue = async () => {
    await setProfile({ location: manual.trim() || DETECTED });
    router.push('/(onboarding)/measurements');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <Pressable onPress={handleContinue} style={styles.skipBtn}>
          <Text style={styles.skipText}>SKIP</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={{ height: 32 }} />
        <Text style={styles.h1}>Where are you?</Text>
        <Text style={styles.caption}>We'll use this for weather-aware suggestions.</Text>
        <View style={{ height: 48 }} />

        <View style={styles.card}>
          <IconPin size={20} color={T.color.primary} strokeWidth={1.2} />
          <View style={{ height: 12 }} />
          <Text style={styles.detectedLabel}>DETECTED LOCATION</Text>
          <View style={{ height: 4 }} />
          <Text style={styles.city}>{DETECTED}</Text>
          <View style={{ height: 8 }} />
          <Text style={styles.weather}>27°C, partly cloudy</Text>
          <View style={{ height: 20 }} />
          <TextLink color={T.color.primary}>Edit location</TextLink>
        </View>

        <View style={{ height: 32 }} />
        <Text style={[type.caption, { color: T.color.secondary, textAlign: 'center' }]}>Or set manually:</Text>
        <View style={{ height: 16 }} />
        <Field label="" value={manual} onChange={setManual} placeholder="Search city or region…" />

        <View style={{ height: 48 }} />
        <PrimaryButton onPress={handleContinue}>USE THIS LOCATION</PrimaryButton>
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
  card: {
    borderWidth: 0.5, borderColor: T.color.hairlineStrong,
    borderRadius: 2, padding: 24,
  },
  detectedLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary },
  city: { ...type.h3, color: T.color.primary },
  weather: { ...type.caption, color: T.color.secondary },
});
