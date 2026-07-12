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
  /**
   * The image is owned elsewhere and must NEVER be deleted on cleanup
   * (e.g. a durable wardrobe photo reused when building outfits around an
   * existing item). Default/undefined = transient temp cut-out (safe to delete).
   */
  keepImage?: boolean;
  /**
   * REAL wardrobe item id when the pin wraps an item the user already owns
   * (pinWardrobeItem). Lets downstream flows (e.g. AI wear-on-you) reference
   * the item by id — with its real cloud photo — instead of a text description.
   * Undefined for transient scans (item not in the wardrobe yet).
   */
  sourceItemId?: string;
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
  /** AI-written grounded note shown under the bars (where it fits / doesn't), to aid
   *  the buy decision. null when the LLM is unavailable/rate-limited/errored. */
  fitNote: string | null;
}

// ─── Wear-on-you (feature 009 — AI try-on rendering the outfit on the user) ────

/** One garment passed to the try-on generator. `imageUrl` is a short-lived signed URL. */
export interface WearGarment {
  type: string;
  name?: string;
  color?: string;
  material?: string | null;
  fit?: string | null;
  imageUrl?: string;
}

/** The user's frame, shown on the intro card (display strings). */
export interface WearFrame {
  height?: string;   // display string, e.g. "178 cm"
  weight?: string;   // e.g. "70 kg"
  size?: string;     // e.g. "M"
}

/**
 * Detailed user info sent to the generator to render correct body proportions
 * and garment fit. NOT used to alter the face/skin/hair (those come from the photo).
 * measurementsCm is a flat label→cm map (e.g. { chest: 96, waist: 80, hips: 95 }).
 */
export interface WearProfile {
  gender?: string;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  bodyShape?: string;
  preferredFit?: string;
  measurementsCm?: Record<string, number>;
}

/** Result of a successful generation: a local file of the user wearing the outfit. */
export interface WearOnResult {
  localImageUri: string;
}

/** Verdict from the cheap photo gate (tryon-validate). */
export interface PhotoValidation {
  valid: boolean;
  reason: string;
}
