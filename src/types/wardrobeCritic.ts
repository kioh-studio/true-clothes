// Wardrobe Critic (feature 010) — client-side types.
// camelCase domain shapes; the edge function (supabase/functions/wardrobe-critic)
// responds in snake_case per specs/010-wardrobe-critic/contracts/wardrobe-critic.md.
// This module owns the snake_case → camelCase mapping so services/stores/screens
// never see the raw wire shape (Constitution III/IV).

export interface Localized {
  en: string;
  vi: string;
}

export interface GapRecommendation {
  archetypeId: string;
  label: Localized;
  /** Number of NEW qualified outfits the archetype would unlock (≥ 3 threshold). */
  unlockCount: number;
  note: Localized;
  /** ≤ 3 sample outfits, each an array of REAL item ids (never a hypothetical `hypo_*` id). */
  sampleOutfits: string[][];
}

export interface StarterChecklistItem {
  archetypeId: string;
  label: Localized;
  owned: boolean;
}

export interface RedundancyInsight {
  typeName: string;
  colorFamily: string;
  count: number;
  note: Localized;
}

export interface CandidateResult {
  unlockCount: number;
  matchedArchetypeId: string | null;
}

export type WardrobeReportMode = 'gaps' | 'starter' | 'complete';

export interface WardrobeGapReport {
  mode: WardrobeReportMode;
  generatedAt: string;
  /** Number of outfits that already qualify on the daily feed's own quality bar. */
  baselineQualified: number;
  /** ≤ 3, sorted unlockCount desc. Empty when mode !== 'gaps'. */
  recommendations: GapRecommendation[];
  /** Only populated when mode === 'starter'. */
  starterChecklist: StarterChecklistItem[];
  /** Paid-tier redundancy insight (US3); null when nothing crosses the threshold. */
  redundancy: RedundancyInsight | null;
  /** Only present when the request included `candidate_item` (Try-On bridge extension). */
  candidate: CandidateResult | null;
  /** Total archetype catalog size — used client-side to render locked placeholder rows. */
  catalogSize: number;
}

// ─── Raw snake_case response shape (edge fn) ──────────────────────────────────

interface RawLocalized {
  en: string;
  vi: string;
}

interface RawGapRecommendation {
  archetype_id: string;
  label: RawLocalized;
  unlock_count: number;
  note: RawLocalized;
  sample_outfits: string[][];
}

interface RawStarterChecklistItem {
  archetype_id: string;
  label: RawLocalized;
  owned: boolean;
}

interface RawRedundancyInsight {
  type_name: string;
  color_family: string;
  count: number;
  note: RawLocalized;
}

interface RawCandidateResult {
  unlock_count: number;
  matched_archetype_id: string | null;
}

export interface RawWardrobeGapReportResponse {
  mode: WardrobeReportMode;
  generated_at: string;
  baseline_qualified: number;
  recommendations: RawGapRecommendation[];
  starter_checklist: RawStarterChecklistItem[];
  redundancy: RawRedundancyInsight | null;
  candidate: RawCandidateResult | null;
  catalog_size: number;
}

export function mapWardrobeGapReport(raw: RawWardrobeGapReportResponse): WardrobeGapReport {
  return {
    mode: raw.mode,
    generatedAt: raw.generated_at,
    baselineQualified: raw.baseline_qualified ?? 0,
    recommendations: (raw.recommendations ?? []).map((r) => ({
      archetypeId: r.archetype_id,
      label: r.label,
      unlockCount: r.unlock_count,
      note: r.note,
      sampleOutfits: r.sample_outfits ?? [],
    })),
    starterChecklist: (raw.starter_checklist ?? []).map((s) => ({
      archetypeId: s.archetype_id,
      label: s.label,
      owned: s.owned,
    })),
    redundancy: raw.redundancy
      ? {
          typeName: raw.redundancy.type_name,
          colorFamily: raw.redundancy.color_family,
          count: raw.redundancy.count,
          note: raw.redundancy.note,
        }
      : null,
    candidate: raw.candidate
      ? {
          unlockCount: raw.candidate.unlock_count,
          matchedArchetypeId: raw.candidate.matched_archetype_id,
        }
      : null,
    catalogSize: raw.catalog_size ?? 0,
  };
}
