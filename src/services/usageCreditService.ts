import { sb } from './supabase';
import i18n from '../i18n';
import { fetchMyAccountType, type AccountType } from './profileService';

export class InsufficientCreditsError extends Error {
  constructor(public readonly creditType: string) {
    super(`No credits remaining for ${creditType}`);
    this.name = 'InsufficientCreditsError';
  }
}

export type CreditType = 'ai_extraction' | 'try_on';

const FREE_LIMITS: Record<CreditType, number> = {
  ai_extraction: 2,
  try_on: 2,
};

// Premium monthly quota (2026-08-05): premium previously had NO server-side cap
// on these two actions (both call gemini-3-pro-image-preview at ~$0.13/image,
// so marginal cost was unbounded). This is the client-side source of truth for
// display; the edge functions (generate-item-image/index.ts, tryon-generate/
// index.ts) enforce the real gate server-side and MUST be kept numerically in
// sync with this map by hand — they cannot import from src/.
export const PREMIUM_LIMITS: Record<CreditType, number> = {
  ai_extraction: 10,
  try_on: 15,
};

/**
 * Resolves the applicable monthly limit for a credit type given an account
 * type. `admin` is treated as quota'd premium (matches the server-side gate)
 * even though it's a distinct value from `premium` — see hasPremiumAccountType().
 * `demo` resolves to the free limit here for display purposes only; demo's
 * real bypass is unlimited server-side and client call sites never invoke
 * checkCredit() for a demo account (they gate on hasPremiumAccountType()).
 */
export function resolveCreditLimit(type: CreditType, accountType: AccountType): number {
  return accountType === 'premium' || accountType === 'admin' ? PREMIUM_LIMITS[type] : FREE_LIMITS[type];
}

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
  /**
   * The account type the `limit` was resolved against. Display call sites need
   * it because `demo` resolves to the FREE limit here purely as a placeholder —
   * a demo account is actually unmetered server-side, so showing it a quota
   * would be a lie. Gates ignore this field.
   */
  accountType: AccountType;
  /**
   * True when the usage query failed and this status is the fail-closed
   * fallback (used = limit, remaining = 0) rather than a real reading. Gates
   * MUST keep ignoring this and keep treating it as exhausted; display call
   * sites MUST hide the counter instead of telling the user they have 0 left
   * on what may be a transient network error.
   */
  degraded?: boolean;
}

export async function checkCredit(type: CreditType): Promise<CreditStatus> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error(i18n.t('authStore_notSignedIn'));

  const periodStart = getPeriodStart();
  // Resolve the limit by account type so a premium user's status reflects
  // their real (higher) monthly cap instead of the free-tier number. Any
  // failure inside fetchMyAccountType() already resolves to 'free' (the
  // conservative/lower limit) — this never over-reports remaining credits.
  const accountType = await fetchMyAccountType();
  const limit = resolveCreditLimit(type, accountType);

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
    return { used: limit, limit, remaining: 0, periodStart, accountType, degraded: true };
  }

  const used = (data as { credits_used: number } | null)?.credits_used ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used), periodStart, accountType };
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
