import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, Tag, Bounded } from '../../src/components/ui';
import { IconChevronLeft } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { useAuthStore } from '../../src/stores/authStore';
import { useTranslation } from '../../src/i18n';

const GENDERS = ['WOMAN', 'MAN', 'NON-BINARY', 'PREFER NOT TO SAY'] as const;
const GENDER_KEYS: Record<typeof GENDERS[number], string> = {
  'WOMAN': 'onboarding_basics_genderWoman',
  'MAN': 'onboarding_basics_genderMan',
  'NON-BINARY': 'onboarding_basics_genderNonBinary',
  'PREFER NOT TO SAY': 'onboarding_basics_genderPreferNotToSay',
};

/** Zero-pad DD/MM and validate the date is real (rejects e.g. 31/02) before it
 * reaches dobAppToIso (which requires exactly 2/2/4 digits) and Postgres. */
function buildDob(dd: string, mm: string, yyyy: string, invalidError: string): { dob: string } | { error: string } {
  const d = dd.padStart(2, '0');
  const m = mm.padStart(2, '0');
  const y = yyyy.padStart(4, '0');
  const day = Number(d), month = Number(m), year = Number(y);
  const date = new Date(year, month - 1, day);
  const valid =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day &&
    year >= 1900 && year <= new Date().getFullYear();
  if (!valid) return { error: invalidError };
  return { dob: `${d}/${m}/${y}` };
}

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
  const { t } = useTranslation();
  const { setProfile } = useAuthStore();
  const [dd, setDd] = useState('');
  const [mm, setMm] = useState('');
  const [yyyy, setYyyy] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (saving) return;
    setError('');

    let dob = '';
    if (dd && mm && yyyy) {
      const built = buildDob(dd, mm, yyyy, t('onboardingBasics_invalidDobError'));
      if ('error' in built) {
        setError(built.error);
        Alert.alert(t('onboardingCommon_couldNotSaveAlertTitle'), built.error);
        return;
      }
      dob = built.dob;
    }

    setSaving(true);
    try {
      const result = await setProfile({ dob, gender: gender ?? '' });
      if (!result.ok) {
        const msg = result.message || t('addItem_errorMessage');
        setError(msg);
        Alert.alert(t('onboardingCommon_couldNotSaveAlertTitle'), msg);
        return;
      }
      router.push('/(onboarding)/location');
    } catch {
      const msg = t('addItem_errorMessage');
      setError(msg);
      Alert.alert(t('onboardingCommon_couldNotSaveAlertTitle'), msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <Pressable onPress={() => router.push('/(onboarding)/location')} style={styles.skipBtn}>
          <Text style={styles.skipText}>{t('onboarding_basics_skip')}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <Bounded>
        <View style={{ height: 32 }} />
        <Text style={styles.h1}>{t('onboarding_basics_title')}</Text>
        <Text style={styles.caption}>{t('onboarding_basics_subtitle')}</Text>
        <View style={{ height: 48 }} />

        <Text style={styles.sectionLabel}>{t('onboarding_basics_dateOfBirth')}</Text>
        <View style={styles.dateRow}>
          <DateField value={dd} onChange={setDd} placeholder={t('onboarding_basics_dobPlaceholderDD')} maxLength={2} />
          <Text style={styles.dateSep}>/</Text>
          <DateField value={mm} onChange={setMm} placeholder={t('onboarding_basics_dobPlaceholderMM')} maxLength={2} />
          <Text style={styles.dateSep}>/</Text>
          <DateField value={yyyy} onChange={setYyyy} placeholder={t('onboarding_basics_dobPlaceholderYYYY')} maxLength={4} />
        </View>
        <Text style={styles.hint}>{t('onboarding_basics_dobHint')}</Text>

        <View style={{ height: 40 }} />
        <Text style={styles.sectionLabel}>{t('onboarding_basics_gender')}</Text>
        <View style={{ height: 12 }} />
        <View style={styles.tagRow}>
          {GENDERS.map(g => (
            <Tag key={g} selected={gender === g} onPress={() => setGender(g)}>{t(GENDER_KEYS[g])}</Tag>
          ))}
        </View>
        <Text style={styles.hint}>{t('onboarding_basics_genderHint')}</Text>

        <View style={{ height: 48 }} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {error ? <View style={{ height: 12 }} /> : null}
        <PrimaryButton onPress={handleContinue} disabled={saving}>{t('onboarding_basics_continue')}</PrimaryButton>
        </Bounded>
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
  error: { ...type.caption, fontSize: 12, color: '#A33' },
});
