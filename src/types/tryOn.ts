// Try On (feature 008) shared domain types.
// Transient: a scanned item is NOT a wardrobe item until the user taps Add.
// camelCase domain shapes; snake_case stays inside services / edge functions.

import { GarmentMetadata } from '../services/imageGenerationService';

/** Which extraction path produced the item; becomes `source` on Add. */
export type ExtractMethod = 'ai' | 'item';

/** The prospective garment under evaluation. Exists only for the Try On session. */
export interface ScannedItem {
  /** Synthetic session id (e.g. "scanned"); used as the pinned slot id in Mix & Match. */
  id: string;
  /** Background-removed cut-out file URI; null only if image generation failed. */
  localImageUri: string | null;
  metadata: GarmentMetadata;
  method: ExtractMethod;
  /** On-device couldn't isolate the background cleanly (UI hint). */
  usedFallback: boolean;
}

export type CriterionKey = 'color' | 'style' | 'fit' | 'measurement' | 'fabric';

/** Overall recommendation label, derived from the composite score. */
export type Recommendation = 'great' | 'worth_it' | 'maybe' | 'skip';

/** One Verdict criterion. `available:false` ⇒ excluded from the composite. */
export interface CriterionScore {
  key: CriterionKey;
  available: boolean;
  /** 0–100 when available; null otherwise (never fabricated — FR-005/FR-009b). */
  score: number | null;
  /** Plain-language reason (FR-009); when unavailable, what's missing + how to fix. */
  explanation: string;
  /** Contribution weight (Fit/Measurement higher); informational for UI. */
  weight: number;
}

/** Suitability assessment of a ScannedItem for the current user. */
export interface Verdict {
  /** 0–100 weighted composite over evaluable criteria; null if none are evaluable. */
  overallScore: number | null;
  recommendation: Recommendation | null;
  /** Always exactly five entries, fixed order: color, style, fit, measurement, fabric. */
  criteria: CriterionScore[];
}
