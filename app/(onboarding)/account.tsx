import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, Field, Bounded } from '../../src/components/ui';
import { IconChevronLeft } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { useAuthStore } from '../../src/stores/authStore';
import { useTranslation } from '../../src/i18n';

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canContinue = emailValid;
  const { sendOtp } = useAuthStore();

  const handleContinue = async () => {
    if (sending) return;
    setSending(true); setError('');
    try {
      const res = await sendOtp('', email);
      if (!res.ok) { setError(res.message || t('onboarding_account_defaultError')); return; }
      router.push('/(onboarding)/otp');
    } catch {
      setError(t('onboarding_account_defaultError'));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <Bounded>
        <View style={{ height: 32 }} />
        <Text style={styles.h1}>{t('onboarding_account_title')}</Text>
        <Text style={styles.caption}>{t('onboardingAccount_subtitle')}</Text>
        <View style={{ height: 48 }} />

        <Field label={t('onboarding_account_emailLabel')} value={email} onChange={v => setEmail(v.toLowerCase().trim())} placeholder={t('onboarding_account_emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} helper={t('onboarding_account_emailHelper')} />

        {error ? (
          <>
            <View style={{ height: 16 }} />
            <Text style={styles.error}>{error}</Text>
          </>
        ) : null}

        <View style={{ height: 64 }} />
        <PrimaryButton onPress={handleContinue} disabled={!canContinue || sending}>
          {sending ? t('onboarding_account_continueSending') : t('onboarding_account_continueButton')}
        </PrimaryButton>

        <View style={{ height: 32 }} />
        <Text style={styles.terms}>
          {t('onboarding_account_terms')}
        </Text>
        </Bounded>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  topBar: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24 },
  h1: { ...type.h1, color: T.color.primary },
  caption: { ...type.caption, marginTop: 12 },
  terms: { ...type.caption, fontSize: 11, color: T.color.tertiary, textAlign: 'center' },
  error: { ...type.caption, color: '#A33', fontSize: 12 },
});
