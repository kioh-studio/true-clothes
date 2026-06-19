// Help & Feedback screen — T025 (US8)
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Linking, LayoutAnimation,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { IconChevronLeft, IconChevronRight } from '../src/components/icons';

const FAQS = [
  {
    question: 'How does the outfit engine work?',
    answer:
      'The engine scores every combination of your wardrobe items against your style profile, body measurements, and current weather. It ranks outfits by colour harmony, proportions, formality, and season — then surfaces the top results in your feed.',
  },
  {
    question: 'Why are my outfits not personalised?',
    answer:
      'Personalisation requires at least one item in your wardrobe. Add items via the Wardrobe tab and the feed will switch from demo outfits to ones built from your actual clothes.',
  },
  {
    question: 'Can I use the app offline?',
    answer:
      'Saved outfits, schedules, and outfit history are available offline. Adding new wardrobe items requires an internet connection to sync photos and data to the cloud.',
  },
  {
    question: 'How do I delete my account?',
    answer:
      'Go to Settings → Danger Zone → Delete Account. This permanently removes your profile, wardrobe, and all associated data. The action cannot be undone.',
  },
  {
    question: 'How do I change my body measurements?',
    answer:
      'Go to Menu → Size & Measurements. You can update height, weight, and optional measurements at any time. Changes take effect on the next outfit generation.',
  },
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

  const handleFeedback = () => {
    Linking.openURL('mailto:support@mien.app');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
        </Pressable>
        <Text style={styles.navTitle}>Help & Feedback</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>FAQ</Text>
        <View style={styles.faqList}>
          {FAQS.map((faq, i) => (
            <FaqRow key={i} question={faq.question} answer={faq.answer} />
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 40 }]}>CONTACT</Text>
        <View style={styles.section}>
          <Pressable style={styles.row} onPress={handleFeedback}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Send feedback</Text>
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
