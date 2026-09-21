// In-app feedback form — reached from Help ("Send feedback") and from the
// AI try-on result screen's "Report this result" link. Thin screen; all
// state/submit logic lives in useFeedbackForm.
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Linking, Alert,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type } from '../src/design/tokens';
import { IconChevronLeft } from '../src/components/icons';
import { Bounded, PrimaryButton, Segmented, TextLink } from '../src/components/ui';
import { useTranslation } from '../src/i18n';
import { useFeedbackForm, MESSAGE_MAX } from '../src/features/feedback/useFeedbackForm';
import type { FeedbackKind } from '../src/services/feedbackService';

const SELECTABLE_KINDS: FeedbackKind[] = ['bug', 'idea', 'other'];

export default function FeedbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ kind?: string; screen?: string }>();

  const kind: FeedbackKind = SELECTABLE_KINDS.includes(params.kind as FeedbackKind) || params.kind === 'report_ai'
    ? (params.kind as FeedbackKind)
    : 'bug';
  const isReportAi = kind === 'report_ai';

  const [selectedKind, setSelectedKind] = React.useState<'bug' | 'idea' | 'other'>(
    isReportAi ? 'bug' : (kind as 'bug' | 'idea' | 'other'),
  );
  // report_ai stays fixed regardless of the (hidden) pill selector; otherwise
  // the pill selector is the live source of truth.
  const activeKind: FeedbackKind = isReportAi ? 'report_ai' : selectedKind;

  const form = useFeedbackForm({ kind: activeKind, screen: params.screen });

  const KIND_LABELS: Record<'bug' | 'idea' | 'other', string> = {
    bug: t('feedback_kindBug'),
    idea: t('feedback_kindIdea'),
    other: t('feedback_kindOther'),
  };
  const LABEL_TO_KIND: Record<string, 'bug' | 'idea' | 'other'> = {
    [KIND_LABELS.bug]: 'bug',
    [KIND_LABELS.idea]: 'idea',
    [KIND_LABELS.other]: 'other',
  };

  const handleMailto = () => {
    Linking.openURL('mailto:contact@kioh.tech').catch((err: unknown) => {
      console.warn('[feedback] openURL failed:', err);
      Alert.alert(t('help_noMailAppTitle'), t('help_noMailAppMessage'));
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.navBtn}>
            <IconChevronLeft size={20} color={T.color.primary} strokeWidth={1.2} />
          </Pressable>
          <Text style={styles.navTitle}>{t('feedback_title')}</Text>
          <View style={styles.navBtn} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Bounded>
            {isReportAi ? (
              <Text style={styles.reportAiCaption}>{t('feedback_reportAiCaption')}</Text>
            ) : (
              <>
                <Text style={styles.sectionLabel}>{t('feedback_kindSection')}</Text>
                <Segmented
                  options={[KIND_LABELS.bug, KIND_LABELS.idea, KIND_LABELS.other]}
                  value={KIND_LABELS[selectedKind]}
                  onChange={(label) => setSelectedKind(LABEL_TO_KIND[label] ?? 'bug')}
                />
              </>
            )}

            <View style={{ height: 28 }} />
            <Text style={styles.sectionLabel}>{t('feedback_messageSection')}</Text>
            <TextInput
              value={form.message}
              onChangeText={form.setMessage}
              placeholder={t('feedback_placeholder')}
              placeholderTextColor={T.color.tertiary}
              multiline
              maxLength={MESSAGE_MAX}
              style={styles.textarea}
              textAlignVertical="top"
            />
            <Text style={styles.counter}>{form.message.length}/{MESSAGE_MAX}</Text>

            <View style={{ height: 24 }} />
            <PrimaryButton onPress={form.submit} disabled={!form.canSubmit}>
              {form.submitting ? t('feedback_submitting') : t('feedback_submit')}
            </PrimaryButton>

            <View style={{ height: 24, alignItems: 'center' }}>
              <TextLink onPress={handleMailto} color={T.color.tertiary}>
                {t('feedback_emailUs')}
              </TextLink>
            </View>
          </Bounded>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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
    marginBottom: 12,
  },
  reportAiCaption: {
    ...type.caption,
    color: T.color.secondary,
    lineHeight: 20,
  },
  textarea: {
    fontFamily: T.font.serif,
    fontSize: 17,
    color: T.color.primary,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    minHeight: 140,
    padding: 16,
  },
  counter: {
    ...type.caption,
    fontSize: 12,
    color: T.color.tertiary,
    textAlign: 'right',
    marginTop: 8,
  },
});
