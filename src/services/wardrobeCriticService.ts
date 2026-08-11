// Wardrobe Critic (feature 010) — service abstraction over the `wardrobe-critic`
// Edge Function. All Supabase access goes through this module (Constitution III);
// stores/screens never touch the client directly.

import { sb } from './supabase';
import {
  WardrobeGapReport,
  RawWardrobeGapReportResponse,
  mapWardrobeGapReport,
} from '../types/wardrobeCritic';
import { useAppStore } from '../stores/appStore';

/** Server returned 429 — the 10/hour analysis budget is used up (contract §Errors). */
export class WardrobeCriticRateLimitedError extends Error {
  constructor() {
    super('rate_limited');
    this.name = 'WardrobeCriticRateLimitedError';
  }
}

/** Any other invoke failure (network, 401, 500, malformed body). */
export class WardrobeCriticNetworkError extends Error {
  constructor(message = 'wardrobe-critic request failed') {
    super(message);
    this.name = 'WardrobeCriticNetworkError';
  }
}

/**
 * Detects a 429 `{ error: 'rate_limited' }` body from `sb.functions.invoke`
 * (same shape as usageCreditService.isCreditExhausted). Never throws — callers
 * always get a boolean.
 */
async function isRateLimited(error: unknown): Promise<boolean> {
  try {
    const ctx = (error as { context?: { status?: number; json(): Promise<{ error?: string }> } }).context;
    if (!ctx) return false;
    if (ctx.status === 429) return true;
    const body = await ctx.json();
    return body?.error === 'rate_limited';
  } catch {
    return false;
  }
}

/**
 * Candidate item for the contract's optional `candidate_item` bridge
 * extension (Try-On → Wardrobe Critic, feature 010) — 1:1 with
 * GarmentMetadata's type/color/material/fit (see useCandidateUnlock.ts).
 * When present, the response gains `candidate: { unlockCount,
 * matchedArchetypeId }` scored against this specific item; everything else
 * in the response is unaffected.
 */
export interface CandidateItemInput {
  type: string;
  color?: string;
  material?: string | null;
  fit?: string | null;
}

/**
 * Fetch a fresh gap-analysis report for the current user. Body is empty
 * unless `candidateItem` is passed (the contract's `candidate_item` bridge
 * extension — see useCandidateUnlock.ts for the Try-On call site; the
 * wardrobeCriticStore's own no-argument Wardrobe Report fetch never passes
 * this). Throws WardrobeCriticRateLimitedError on 429,
 * WardrobeCriticNetworkError otherwise. The store catches and maps these to
 * UI state; useCandidateUnlock instead fails silently (see its own header).
 */
export async function fetchGapReport(candidateItem?: CandidateItemInput): Promise<WardrobeGapReport> {
  const body: Record<string, unknown> = useAppStore.getState().bodyNeutralMode ? { body_neutral: true } : {};
  if (candidateItem) body.candidate_item = candidateItem;
  const { data, error } = await sb.functions.invoke('wardrobe-critic', { body });

  if (error) {
    if (await isRateLimited(error)) throw new WardrobeCriticRateLimitedError();
    throw new WardrobeCriticNetworkError(error.message ?? undefined);
  }

  const raw = data as RawWardrobeGapReportResponse;
  if (!raw || typeof raw.mode !== 'string') {
    throw new WardrobeCriticNetworkError('wardrobe-critic: unexpected response shape');
  }

  return mapWardrobeGapReport(raw);
}
