import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, Field } from '../../src/components/ui';
import { IconChevronLeft } from '../../src/components/icons';
import { T, type } from '../../src/design/tokens';
import { useAuthStore } from '../../src/stores/authStore';

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canContinue = emailValid;
  const { sendOtp } = useAuthStore();

  const handleContinue = async () => {
    setSending(true); setError('');
    const res = await sendOtp('', email);
    setSending(false);
    if (!res.ok) { setError(res.message || 'Could not send code. Please try again.'); return; }
    router.push('/(onboarding)/otp');
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
        <View style={{ height: 32 }} />
        <Text style={styles.h1}>Let's begin.</Text>
        <Text style={styles.caption}>Enter your email to get started.</Text>
        <View style={{ height: 48 }} />

        <Field label="EMAIL" value={email} onChange={v => setEmail(v.toLowerCase().trim())} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} helper="We'll send a one-time code to this address." />

        {error ? (
          <>
            <View style={{ height: 16 }} />
            <Text style={styles.error}>{error}</Text>
          </>
        ) : null}

        <View style={{ height: 64 }} />
        <PrimaryButton onPress={handleContinue} disabled={!canContinue || sending}>
          {sending ? 'SENDING CODE…' : 'CONTINUE'}
        </PrimaryButton>

        <View style={{ height: 32 }} />
        <Text style={styles.terms}>
          By continuing, you agree to our Terms and Privacy Policy.
        </Text>
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
