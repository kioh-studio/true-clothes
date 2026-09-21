// useFeedbackForm — state + submit logic for app/feedback.tsx. Screen stays
// thin per CLAUDE.md; all logic lives here.
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { submitFeedback, type FeedbackKind } from '../../services/feedbackService';
import { track } from '../../services/analytics';
import { useTranslation } from '../../i18n';

export const MESSAGE_MAX = 2000;

export interface UseFeedbackFormArgs {
  kind: FeedbackKind;
  screen?: string;
}

export function useFeedbackForm({ kind, screen }: UseFeedbackFormArgs) {
  const router = useRouter();
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = message.trim().length > 0 && message.length <= MESSAGE_MAX && !submitting;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await submitFeedback({ kind, message, screen });
      track('feedback_submitted', { kind });
      Alert.alert(t('feedback_thanksTitle'), t('feedback_thanksMessage'), [
        { text: t('common_ok'), onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert(t('feedback_errorTitle'), t('feedback_errorMessage'));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, kind, message, screen, router, t]);

  return { message, setMessage, submitting, canSubmit, submit };
}
