import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { IconChevronLeft } from '../src/components/icons';
import { useAuthStore } from '../src/stores/authStore';
import { useProfileEdit } from '../src/features/profile/useProfileEdit';
import { useAvatarUri } from '../src/features/profile/useAvatarUri';
import { useTranslation } from '../src/i18n';

const GENDER_OPTIONS = ['WOMAN', 'MAN', 'NON-BINARY', 'PREFER NOT TO SAY'];
const GENDER_LABEL_KEYS: Record<typeof GENDER_OPTIONS[number], string> = {
  'WOMAN': 'onboarding_basics_genderWoman',
  'MAN': 'onboarding_basics_genderMan',
  'NON-BINARY': 'onboarding_basics_genderNonBinary',
  'PREFER NOT TO SAY': 'onboarding_basics_genderPreferNotToSay',
};

export default function ProfileEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { avatarPath } = useAuthStore();
  const avatarUri = useAvatarUri(avatarPath);
  const { displayName, setDisplayName, gender, setGender, isDirty, saving, error, save, pickAvatar } = useProfileEdit();

  const handleSave = async () => {
    const ok = await save();
    if (ok) router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Nav */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <Text style={styles.navTitle}>{t('profileEdit_title')}</Text>
        <Pressable
          onPress={handleSave}
          style={[styles.navBtn, styles.saveBtn]}
          disabled={!isDirty || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={T.color.primary} />
          ) : (
            <Text style={[styles.saveBtnText, (!isDirty || saving) && styles.saveBtnDisabled]}>
              {t('common_save')}
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <Pressable onPress={pickAvatar} style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {(displayName?.[0] ?? '—').toUpperCase()}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={pickAvatar}>
            <Text style={styles.changePhotoText}>{t('profileEdit_avatarChangeButton')}</Text>
          </Pressable>
        </View>

        {/* Display name */}
        <Text style={styles.fieldLabel}>{t('profileEdit_displayNameLabel')}</Text>
        <TextInput
          style={styles.textInput}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('profileEdit_displayNamePlaceholder')}
          placeholderTextColor={T.color.tertiary}
          autoCorrect={false}
        />

        {/* Gender */}
        <Text style={[styles.fieldLabel, { marginTop: 32 }]}>{t('profileEdit_genderLabel')}</Text>
        <View style={styles.genderGrid}>
          {GENDER_OPTIONS.map(opt => (
            <Pressable
              key={opt}
              style={[styles.genderChip, gender === opt && styles.genderChipActive]}
              onPress={() => setGender(opt === gender ? '' : opt)}
            >
              <Text style={[styles.genderChipText, gender === opt && styles.genderChipTextActive]}>
                {t(GENDER_LABEL_KEYS[opt])}
              </Text>
            </Pressable>
          ))}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
  },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { width: 'auto' as any, paddingHorizontal: 4 },
  navTitle: { fontFamily: T.font.serif, fontSize: 17, fontWeight: '400', color: T.color.primary },
  saveBtnText: { ...type.ui, fontSize: 12, color: T.color.primary },
  saveBtnDisabled: { color: T.color.tertiary },
  content: { paddingHorizontal: 24, paddingTop: 32 },
  avatarSection: { alignItems: 'center', marginBottom: 40 },
  avatarWrap: { marginBottom: 12 },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: T.color.elevated, borderWidth: 0.5, borderColor: T.color.hairline,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontFamily: T.font.serif, fontSize: 32, fontWeight: '400', color: T.color.primary },
  changePhotoText: { ...type.ui, fontSize: 10, color: T.color.secondary, letterSpacing: 1 },
  fieldLabel: { ...type.ui, fontSize: 10, color: T.color.tertiary, marginBottom: 12 },
  textInput: {
    fontFamily: T.font.serif,
    fontSize: 20,
    fontWeight: '300',
    color: T.color.primary,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
    paddingVertical: 8,
  },
  genderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genderChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
  },
  genderChipActive: { borderColor: T.color.primary, backgroundColor: T.color.primary },
  genderChipText: { ...type.ui, fontSize: 11, color: T.color.secondary },
  genderChipTextActive: { color: T.color.canvas },
  errorText: { ...type.caption, color: T.color.error, marginTop: 16 },
});
