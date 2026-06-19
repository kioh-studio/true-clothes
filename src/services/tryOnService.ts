// Try On (feature 008) — service abstraction over the `evaluate-item` Edge Function.
// All Supabase access goes through this module (Constitution III); screens and
// stores never touch the client directly.

import { sb } from './supabase';
import { ScannedItem, Verdict, CriterionScore, CriterionKey, Recommendation } from '../types/tryOn';

// ─── snake_case response shape from the edge function ─────────────────────────

interface RawCriterionScore {
  key: string;
  available: boolean;
  score: number | null;
  weight: number;
  explanation: string;
}

interface RawVerdictResponse {
  overall_score: number | null;
  recommendation: string | null;
  criteria: RawCriterionScore[];
}

// ─── Fixed order the spec mandates (contract: evaluate-item.md) ──────────────
const CRITERION_ORDER: CriterionKey[] = ['color', 'style', 'fit', 'measurement', 'fabric'];

function mapCriteria(raw: RawCriterionScore[]): CriterionScore[] {
  return CRITERION_ORDER.map((key) => {
    const found = raw.find((c) => c.key === key);
    if (found) {
      return {
        key,
        available: found.available,
        score: found.available ? found.score : null,
        weight: found.weight,
        explanation: found.explanation ?? '',
      };
    }
    // If the edge function omitted a criterion (defensive), mark unavailable
    return {
      key,
      available: false,
      score: null,
      weight: 0,
      explanation: '',
    };
  });
}

function mapRecommendation(raw: string | null): Recommendation | null {
  if (raw === 'great' || raw === 'worth_it' || raw === 'maybe' || raw === 'skip') {
    return raw;
  }
  return null;
}

/**
 * Score a single prospective item against the current user's profile.
 * Calls the `evaluate-item` Edge Function (server-side JWT auth; user profile
 * loaded server-side). Returns the domain Verdict (overall + 5 criteria).
 *
 * Throws on network/auth/unexpected errors — the store catches and sets error.
 */
export async function evaluateItem(item: ScannedItem, locale = 'en'): Promise<Verdict> {
  const m = item.metadata;

  // Build snake_case request body as per the contract
  const requestBody = {
    item: {
      type: m.type,
      color: m.color,
      material: m.material ?? null,
      fit: m.fit ?? null,
      pattern: m.pattern ?? null,
      warmth_season: m.warmthSeason ?? null,
      measurements: m.measurements ?? {},
    },
    locale,
  };

  const { data, error } = await sb.functions.invoke('evaluate-item', {
    body: requestBody,
  });

  if (error) throw error;

  const raw = data as RawVerdictResponse;

  if (!raw || !Array.isArray(raw.criteria)) {
    throw new Error('evaluate-item: unexpected response shape');
  }

  return {
    overallScore: typeof raw.overall_score === 'number' ? raw.overall_score : null,
    recommendation: mapRecommendation(raw.recommendation),
    criteria: mapCriteria(raw.criteria),
  };
}
