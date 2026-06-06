import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, Tag } from '../../src/components/ui';
import { IconChevronLeft } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { useAuthStore } from '../../src/stores/authStore';

const GENDERS = ['WOMAN', 'MAN', 'NON-BINARY', 'PREFER NOT TO SAY'];

function DateField({ value, onChange, placeholder, maxLength }: { value: string; onChange: (v: string) => void; placeholder: string; maxLength: number }) {
  return (
    <TextInput
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      placeholderTextColor={T.color.tertiary}
      onChangeText={v => onChange(v.replace(/\D/g, ''))}
      keyboardType="number-pad"
      style={styles.dateInput}
    />
  );
}

export default function BasicsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setProfile } = useAuthStore();
  const [dd, setDd] = useState('');
  const [mm, setMm] = useState('');
  const [yyyy, setYyyy] = useState('');
  const [gender, setGender] = useState<string | null>(null);

  const handleContinue = async () => {
    const dob = dd && mm && yyyy ? `${dd}/${mm}/${yyyy}` : '';
    await setProfile({ dob, gender: gender ?? '' });
    router.push('/(onboarding)/location');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <Pressable onPress={() => router.push('/(onboarding)/location')} style={styles.skipBtn}>
          <Text style={styles.skipText}>SKIP</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={{ height: 32 }} />
        <Text style={styles.h1}>About you.</Text>
        <Text style={styles.caption}>This helps us tailor suggestions. You can change it anytime.</Text>
        <View style={{ height: 48 }} />

        <Text style={styles.sectionLabel}>DATE OF BIRTH</Text>
        <View style={styles.dateRow}>
          <DateField value={dd} onChange={setDd} placeholder="DD" maxLength={2} />
          <Text style={styles.dateSep}>/</Text>
          <DateField value={mm} onChange={setMm} placeholder="MM" maxLength={2} />
          <Text style={styles.dateSep}>/</Text>
          <DateField value={yyyy} onChange={setYyyy} placeholder="YYYY" maxLength={4} />
        </View>
        <Text style={styles.hint}>We use this for age-appropriate suggestions only.</Text>

        <View style={{ height: 40 }} />
        <Text style={styles.sectionLabel}>GENDER</Text>
        <View style={{ height: 12 }} />
        <View style={styles.tagRow}>
          {GENDERS.map(g => (
            <Tag key={g} selected={gender === g} onPress={() => setGender(g)}>{g}</Tag>
          ))}
        </View>
        <Text style={styles.hint}>Affects body type silhouette options. Doesn't restrict style choices.</Text>

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
  sectionLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateInput: {
    flex: 1, height: 40, textAlign: 'center',
    borderBottomWidth: 0.5, borderBottomColor: T.color.hairline,
    fontFamily: T.font.sans, fontSize: 17, color: T.color.primary,
  },
  dateSep: { color: T.color.hairlineStrong, fontSize: 17 },
  hint: { ...type.caption, fontSize: 12, color: T.color.tertiary, marginTop: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
