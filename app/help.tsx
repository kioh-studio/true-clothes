// Help & Feedback screen — T025 (US8)
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Linking, LayoutAnimation, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { IconChevronLeft, IconChevronRight } from '../src/components/icons';
import { useTranslation } from '../src/i18n';

const FAQ_KEYS = [
  { q: 'help_faqQ1', a: 'help_faqA1' },
  { q: 'help_faqQ2', a: 'help_faqA2' },
  { q: 'help_faqQ3', a: 'help_faqA3' },
  { q: 'help_faqQ4', a: 'help_faqA4' },
  { q: 'help_faqQ5', a: 'help_faqA5' },
];

function FaqRow({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };

  return (
    <Pressable onPress={toggle} style={styles.faqRow}>
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{question}</Text>
        <IconChevronRight
          size={12}
          color={T.color.tertiary}
          strokeWidth={1.4}
          style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
        />
      </View>
      {open && <Text style={styles.faqAnswer}>{answer}</Text>}
    </Pressable>
  );
}

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const FAQS = FAQ_KEYS.map((k) => ({ question: t(k.q), answer: t(k.a) }));

  const handleFeedback = () => {
    Linking.openURL('mailto:support@mien.app').catch((err: unknown) => {
      console.warn('[help] openURL failed:', err);
      Alert.alert(t('help_noMailAppTitle'), t('help_noMailAppMessage'));
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <Text style={styles.navTitle}>{t('help_title')}</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>{t('help_faqSection')}</Text>
        <View style={styles.faqList}>
          {FAQS.map((faq, i) => (
            <FaqRow key={i} question={faq.question} answer={faq.answer} />
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 40 }]}>{t('help_contactSection')}</Text>
        <View style={styles.section}>
          <Pressable style={styles.row} onPress={handleFeedback}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{t('help_sendFeedback')}</Text>
              <Text style={styles.rowDesc}>support@mien.app</Text>
            </View>
            <IconChevronRight size={12} color={T.color.tertiary} strokeWidth={1.4} />
          </Pressable>
        </View>
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
  navTitle: {
    fontFamily: T.font.serif,
    fontSize: 17,
    fontWeight: '400',
    color: T.color.primary,
  },
  content: { paddingHorizontal: 24, paddingTop: 32 },
  sectionLabel: {
    ...type.ui,
    fontSize: 10,
    color: T.color.tertiary,
    marginBottom: 8,
  },
  faqList: {
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
  },
  faqRow: {
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqQuestion: {
    flex: 1,
    fontFamily: T.font.serif,
    fontSize: 17,
    fontWeight: '400',
    color: T.color.primary,
  },
  faqAnswer: {
    ...type.caption,
    marginTop: 12,
    color: T.color.secondary,
    lineHeight: 20,
  },
  section: {
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: T.color.hairline,
    gap: 12,
  },
  rowBody: { flex: 1 },
  rowTitle: {
    fontFamily: T.font.serif,
    fontSize: 17,
    fontWeight: '400',
    color: T.color.primary,
  },
  rowDesc: {
    ...type.caption,
    fontSize: 12,
    color: T.color.tertiary,
    marginTop: 2,
  },
});
