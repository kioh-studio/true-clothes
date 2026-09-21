// feedbackService — sole point of contact with the feedback table. Screens
// and hooks MUST NOT import `sb` directly.
//
// Users can only INSERT (see supabase/migrations/20260922000001_feedback.sql —
// no SELECT/UPDATE/DELETE grant), so submitFeedback never selects the row back.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { sb } from './supabase';

// ─── Error type ──────────────────────────────────────────────────────────────

export class FeedbackDbError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'FeedbackDbError';
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type FeedbackKind = 'bug' | 'idea' | 'other' | 'report_ai';

export interface SubmitFeedbackInput {
  kind: FeedbackKind;
  message: string;
  screen?: string;
}

/** Submit user feedback. Trims the message; throws FeedbackDbError on an
 * empty/too-long message or a failed insert. user_id is filled server-side
 * (column default auth.uid()) — never sent from the client. */
export async function submitFeedback({ kind, message, screen }: SubmitFeedbackInput): Promise<void> {
  const trimmed = message.trim();
  if (trimmed.length === 0 || trimmed.length > 2000) {
    throw new FeedbackDbError('Feedback message must be between 1 and 2000 characters');
  }

  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;

  const { error } = await sb.from('feedback').insert({
    kind,
    message: trimmed,
    screen: screen ?? null,
    app_version: Constants.expoConfig?.version ?? null,
    platform,
  });
  // No .select() — users have no SELECT grant on this table; requesting the
  // inserted row back would fail even though the insert itself succeeded.

  if (error) throw new FeedbackDbError('Failed to submit feedback', error);
}
