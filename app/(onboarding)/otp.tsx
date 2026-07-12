import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../src/components/ui';
import { IconChevronLeft } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { useAuthStore } from '../../src/stores/authStore';
import { sanitizeDigit, digitAction } from '../../src/utils/otpInput';
import { useTranslation } from '../../src/i18n';

export default function OTPScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(45);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const inputsRef = useRef<TextInput[]>([]);

  const { pendingPhone, pendingEmail, pendingAuthMethod, verifyOtp, sendOtp } = useAuthStore();

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (!pendingPhone && !pendingEmail) router.replace('/(onboarding)/account');
  }, [pendingPhone, pendingEmail, router]);

  const onDigit = (i: number, v: string) => {
    const clean = sanitizeDigit(v);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    const action = digitAction(next, i, clean);
    if (action === 'advance') {
      inputsRef.current[i + 1]?.focus();
    } else if (action === 'dismiss') {
      // Full code entered. number-pad has no Done key, so drop the keyboard here.
      Keyboard.dismiss();
    }
    if (error) setError('');
  };

  const onKey = (i: number, e: any) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  };

  const filled = digits.every(d => d !== '');

  const handleVerify = async () => {
    if (verifying || !filled) return;
    setVerifying(true); setError('');
    try {
      const res = await verifyOtp(digits.join(''));
      if (!res.ok) {
        setError(res.message || t('onboardingOtp_invalidCodeError'));
        return;
      }
      // Demo account has onboarding pre-seeded — go straight to the app.
      const { onboardingComplete } = useAuthStore.getState();
      router.replace(onboardingComplete ? '/(tabs)' : '/(onboarding)/basics');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || (!pendingPhone && !pendingEmail)) return;
    setError('');
    const res = await sendOtp(pendingPhone, pendingEmail);
    if (res.ok) {
      setCountdown(45);
      setDigits(['', '', '', '', '', '']);
    } else {
      setError(res.message || t('onboardingOtp_resendError'));
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 32 }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <View style={{ height: 32 }} />
        <Text style={styles.h2}>{t('onboardingOtp_title')}</Text>
        <Text style={styles.caption}>
          {pendingAuthMethod === 'email'
            ? t('onboardingOtp_sentTo', { contact: pendingEmail })
            : pendingPhone
              ? t('onboardingOtp_sentTo', { contact: pendingPhone })
              : t('onboardingOtp_sentToGeneric')}
        </Text>
        <View style={{ height: 48 }} />

        <View style={styles.digitRow}>
          {digits.map((d, i) => (
            <View key={i} style={styles.digitWrap}>
              <TextInput
                ref={el => { if (el) inputsRef.current[i] = el; }}
                value={d}
                onChangeText={v => onDigit(i, v)}
                onKeyPress={e => onKey(i, e)}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={1}
                style={styles.digitInput}
              />
              <View style={[styles.digitLine, d && styles.digitLineFilled]} />
            </View>
          ))}
        </View>

        {error ? (
          <>
            <View style={{ height: 16 }} />
            <Text style={styles.error}>{error}</Text>
          </>
        ) : null}

        <View style={{ height: 48 }} />
        <Pressable onPress={handleResend} disabled={countdown > 0}>
          <Text style={[styles.resend, countdown > 0 && styles.resendDisabled]}>
            {countdown > 0
              ? t('onboardingOtp_resendCountdown', { seconds: String(countdown).padStart(2, '0') })
              : t('onboardingOtp_resendCode')}
          </Text>
        </Pressable>

        <View style={{ flex: 1, minHeight: 32 }} />
        <PrimaryButton onPress={handleVerify} disabled={verifying || !filled}>
          {verifying ? t('onboardingOtp_verifying') : t('onboardingOtp_verifyButton')}
        </PrimaryButton>
      </View>
    </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.canvas },
  topBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, paddingHorizontal: 24 },
  h2: { ...type.h2, color: T.color.primary },
  caption: { ...type.caption, marginTop: 8 },
  digitRow: { flexDirection: 'row', gap: 12 },
  digitWrap: { flex: 1, position: 'relative' },
  digitInput: {
    height: 56, textAlign: 'center',
    fontFamily: T.font.sans, fontSize: 24,
    color: T.color.primary, backgroundColor: 'transparent',
  },
  digitLine: { height: 0.5, backgroundColor: T.color.hairline },
  digitLineFilled: { height: 1, backgroundColor: T.color.primary },
  resend: { ...type.ui, fontSize: 11, color: T.color.primary, textAlign: 'center' },
  resendDisabled: { color: T.color.tertiary },
  error: { ...type.caption, color: '#A33', fontSize: 12 },
});
