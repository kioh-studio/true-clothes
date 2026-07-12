import { sb } from './supabase';
import i18n from '../i18n';

export class InsufficientCreditsError extends Error {
  constructor(public readonly creditType: string) {
    super(`No credits remaining for ${creditType}`);
    this.name = 'InsufficientCreditsError';
  }
}

type CreditType = 'ai_extraction' | 'try_on';

const FREE_LIMITS: Record<CreditType, number> = {
  ai_extraction: 2,
  try_on: 2,
};

// Local YYYY-MM-DD (no cross-file import — mirrors the local-date helper used
// elsewhere in the app). `toISOString()` converts through UTC, which in
// UTC+7 rolls the 1st-of-month back to the previous day for the first ~7h of
// the month, effectively giving free users an extra day's credit each month.
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getPeriodStart(): string {
  const now = new Date();
  return localDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
}

export interface CreditStatus {
  used: number;
  limit: number;
  remaining: number;
  periodStart: string;
}

export async function checkCredit(type: CreditType): Promise<CreditStatus> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error(i18n.t('authStore_notSignedIn'));

  const periodStart = getPeriodStart();
  const limit = FREE_LIMITS[type];

  const { data, error } = await sb
    .from('usage_credits')
    .select('credits_used')
    .match({ user_id: user.id, credit_type: type, period_start: periodStart })
    .maybeSingle();

  if (error) {
    // Fail-closed: a transient DB/RLS error must not read as "full credit
    // remaining" — report the period as exhausted so the client blocks the
    // gated action instead of risking an unmetered cost sink.
    console.warn('[usageCreditService] checkCredit query failed, failing closed:', error.message);
    return { used: limit, limit, remaining: 0, periodStart };
  }

  const used = (data as { credits_used: number } | null)?.credits_used ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used), periodStart };
}

/**
 * Detects whether an error thrown by `sb.functions.invoke` is a 402
 * credit_exhausted response from the server-side gate. Returns false on any
 * parse failure so callers always get a boolean (never throws).
 */
export async function isCreditExhausted(error: unknown): Promise<boolean> {
  try {
    const ctx = (error as { context?: { json(): Promise<{ error?: string }> } }).context;
    if (!ctx) return false;
    const body = await ctx.json();
    return body?.error === 'credit_exhausted';
  } catch {
    return false;
  }
}
