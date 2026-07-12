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
 * Fetch a fresh gap-analysis report for the current user. Body is empty —
 * the contract's `candidate_item` bridge extension is not used here.
 * Throws WardrobeCriticRateLimitedError on 429, WardrobeCriticNetworkError
 * otherwise. The store catches and maps these to UI state.
 */
export async function fetchGapReport(): Promise<WardrobeGapReport> {
  const body = useAppStore.getState().bodyNeutralMode ? { body_neutral: true } : {};
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
