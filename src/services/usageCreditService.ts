import { sb } from './supabase';

export class InsufficientCreditsError extends Error {
  constructor(public readonly creditType: string) {
    super(`No credits remaining for ${creditType}`);
    this.name = 'InsufficientCreditsError';
  }
}

type CreditType = 'ai_extraction';

const FREE_LIMITS: Record<CreditType, number> = {
  ai_extraction: 2,
};

function getPeriodStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

export interface CreditStatus {
  used: number;
  limit: number;
  remaining: number;
  periodStart: string;
}

export async function checkCredit(type: CreditType): Promise<CreditStatus> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const periodStart = getPeriodStart();
  const limit = FREE_LIMITS[type];

  const { data } = await sb
    .from('usage_credits')
    .select('credits_used')
    .match({ user_id: user.id, credit_type: type, period_start: periodStart })
    .maybeSingle();

  const used = (data as { credits_used: number } | null)?.credits_used ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used), periodStart };
}

export async function incrementCredit(type: CreditType): Promise<void> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const periodStart = getPeriodStart();

  const { error } = await sb.from('usage_credits').upsert(
    { user_id: user.id, credit_type: type, period_start: periodStart, credits_used: 1 },
    { onConflict: 'user_id,credit_type,period_start', ignoreDuplicates: false },
  );

  // If upsert inserted, we're done. If conflict, increment:
  if (error) {
    await sb.rpc('increment_usage_credit', { p_user_id: user.id, p_type: type, p_period: periodStart });
  }
}
