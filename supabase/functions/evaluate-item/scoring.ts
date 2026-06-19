// Verdict scoring for a single prospective item against the current user's profile.
// Each of the five criteria scores 0–100. Unavailable criteria (missing item attr
// OR missing profile datum) are excluded and weights are renormalized over the rest.
// Deterministic — no LLM. Reuses engine helpers from generate-outfits/engine/.

import {
  FitItem, BodyMeasurements, BodyShape,
} from '../generate-outfits/engine/types.ts';
import {
  scoreColorHarmony,
  computeUserAttributes,
  scoreStyleCoherence,
  scoreItemFit,
  bodyShapeMultiplier,
  scoreSeasonMatch,
} from '../generate-outfits/engine/scoring.ts';
import { styleConfigById } from '../generate-outfits/engine/filtering.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CriterionKey = 'color' | 'style' | 'fit' | 'measurement' | 'fabric';
export type Recommendation = 'great' | 'worth_it' | 'maybe' | 'skip';

export interface CriterionScore {
  key: CriterionKey;
  available: boolean;
  score: number | null;
  weight: number;
  explanation: string;
}

export interface VerdictResult {
  overall_score: number | null;
  recommendation: Recommendation | null;
  criteria: CriterionScore[];
}

// ─── Default criterion weights (tunable) ─────────────────────────────────────

const DEFAULT_WEIGHTS: Record<CriterionKey, number> = {
  fit:         0.25,
  measurement: 0.25,
  color:       0.20,
  style:       0.20,
  fabric:      0.10,
};

// ─── Recommendation bands ─────────────────────────────────────────────────────

function toRecommendation(score: number): Recommendation {
  if (score >= 85) return 'great';
  if (score >= 70) return 'worth_it';
  if (score >= 50) return 'maybe';
  return 'skip';
}

// ─── Preferred fit comparison ─────────────────────────────────────────────────
// Compares item fit (lowercase) vs user preferredFit (UPPERCASE enum).
// Returns 0–1 raw score.

type PreferredFit = 'SLIM' | 'REGULAR' | 'RELAXED' | 'OVERSIZED';
type ItemFitStr = 'slim' | 'regular' | 'relaxed' | 'wide' | 'oversized';

// Adjacent-fit table: how well each item fit satisfies a preferred fit.
// 1.0 = exact match or functionally identical, lower = less suitable.
const FIT_COMPAT: Record<PreferredFit, Partial<Record<ItemFitStr, number>>> = {
  SLIM:     { slim: 1.0, regular: 0.6, relaxed: 0.3, wide: 0.1, oversized: 0.1 },
  REGULAR:  { slim: 0.6, regular: 1.0, relaxed: 0.7, wide: 0.4, oversized: 0.3 },
  RELAXED:  { slim: 0.2, regular: 0.7, relaxed: 1.0, wide: 0.8, oversized: 0.6 },
  OVERSIZED:{ slim: 0.1, regular: 0.4, relaxed: 0.7, wide: 0.8, oversized: 1.0 },
};

function scoreFitPreference(itemFit: ItemFitStr, preferredFit: PreferredFit): number {
  return FIT_COMPAT[preferredFit][itemFit] ?? 0.5;
}

// ─── Criterion-level explanations ────────────────────────────────────────────

function colorExplanation(score: number, item: FitItem, colorSeason?: string): string {
  if (score >= 85) return `${item.colorProfile.primaryColor} harmonizes well with your color season${colorSeason ? ` (${colorSeason})` : ''} and palette.`;
  if (score >= 70) return `${item.colorProfile.primaryColor} is compatible with your palette, though not a perfect match.`;
  if (score >= 50) return `${item.colorProfile.primaryColor} has limited alignment with your color preferences.`;
  return `${item.colorProfile.primaryColor} conflicts with your color palette${colorSeason ? ` for ${colorSeason} season` : ''}.`;
}

function styleExplanation(score: number, item: FitItem, selectedStyles: string[]): string {
  const styleNames = selectedStyles.slice(0, 2).join(', ');
  if (score >= 85) return `${item.typeName} fits naturally with your ${styleNames} aesthetic.`;
  if (score >= 70) return `${item.typeName} is broadly compatible with your ${styleNames} style.`;
  if (score >= 50) return `${item.typeName} partially overlaps with your ${styleNames} style.`;
  return `${item.typeName} has limited style coherence with your ${styleNames} preferences.`;
}

function fitExplanation(score: number, itemFit: ItemFitStr, preferredFit?: PreferredFit, bodyShape?: BodyShape): string {
  const shapePart = bodyShape ? ` for a ${bodyShape} body shape` : '';
  if (score >= 85) return `${itemFit} fit matches your preferred ${preferredFit?.toLowerCase() ?? 'fit'}${shapePart}.`;
  if (score >= 70) return `${itemFit} fit is mostly compatible with your style${shapePart}.`;
  if (score >= 50) return `${itemFit} fit may feel different from your usual ${preferredFit?.toLowerCase() ?? 'preference'}${shapePart}.`;
  return `${itemFit} fit doesn't align well with your ${preferredFit?.toLowerCase() ?? 'preferred'} fit${shapePart}.`;
}

function measurementExplanation(score: number, warnings: string[]): string {
  if (warnings.length === 0 && score >= 85) return 'Garment measurements align well with your body measurements.';
  if (warnings.length === 0 && score >= 70) return 'Garment measurements are a good fit for your body.';
  if (warnings.length > 0) return `Potential fit concerns: ${warnings.slice(0, 2).join('; ')}.`;
  return 'Garment measurements do not align well with your body measurements.';
}

function fabricExplanation(score: number, item: FitItem, selectedStyles: string[]): string {
  const fabricName = item.fabricName ?? item.fabric.fabricWeight + '-weight fabric';
  const season = item.fabric.season;
  if (score >= 85) return `${fabricName} is season-appropriate (${season}) and suits your style.`;
  if (score >= 70) return `${fabricName} works for ${season} and is style-compatible.`;
  if (score >= 50) return `${fabricName} is usable but not ideal for your typical style or season.`;
  return `${fabricName} may not suit your preferred styles or the current season.`;
}

// ─── Unavailability explanation helpers ──────────────────────────────────────

function unavailableExplanation(key: CriterionKey, missingItem: boolean, missingProfile: boolean): string {
  if (missingItem && missingProfile) {
    return unavailableItemExplanation(key) + ' Also, ' + unavailableProfileExplanation(key).toLowerCase();
  }
  if (missingItem) return unavailableItemExplanation(key);
  return unavailableProfileExplanation(key);
}

function unavailableItemExplanation(key: CriterionKey): string {
  switch (key) {
    case 'color':       return 'Item color is missing — scan or enter the color to score this.';
    case 'style':       return 'Item type is missing — provide the garment type to score this.';
    case 'fit':         return 'Item fit is missing — add a fit label (slim/regular/relaxed/oversized) to score this.';
    case 'measurement': return 'Item has no numeric measurements — add garment measurements to score this.';
    case 'fabric':      return 'Item material is missing — add a fabric/material name to score this.';
  }
}

function unavailableProfileExplanation(key: CriterionKey): string {
  switch (key) {
    case 'color':       return 'Complete your color profile (color season or personal palette) for color scoring.';
    case 'style':       return 'Set at least one style preference in your profile to score style compatibility.';
    case 'fit':         return 'Add your preferred fit or body shape in your profile to score fit.';
    case 'measurement': return 'Add your body measurements in your profile to score garment fit.';
    case 'fabric':      return 'Style preferences help contextualise fabric scoring — consider adding them.';
  }
}

// ─── Per-criterion scorers ────────────────────────────────────────────────────

interface ProfileInputs {
  colorPreferences: string[];
  colorSeason: string | undefined;
  selectedStyles: string[];
  bodyMeasurements: BodyMeasurements;
}

function scoreColor(item: FitItem, profile: ProfileInputs): CriterionScore {
  const key: CriterionKey = 'color';
  const weight = DEFAULT_WEIGHTS[key];

  const missingItem    = !item.colorProfile || item.colorProfile.primaryColor === 'natural' && !item.colorProfile.hue;
  const missingProfile = profile.colorPreferences.length === 0 && !profile.colorSeason;

  if (missingItem || missingProfile) {
    return {
      key, available: false, score: null, weight,
      explanation: unavailableExplanation(key, missingItem, missingProfile),
    };
  }

  // Reuse outfit-level scorer with single-item array — same math, no duplication.
  const raw = scoreColorHarmony([item], profile.colorPreferences, profile.colorSeason);
  const score = Math.round(Math.min(100, Math.max(0, raw * 100)));
  return { key, available: true, score, weight, explanation: colorExplanation(score, item, profile.colorSeason) };
}

function scoreStyle(item: FitItem, profile: ProfileInputs): CriterionScore {
  const key: CriterionKey = 'style';
  const weight = DEFAULT_WEIGHTS[key];

  const missingItem    = !item.typeName;
  const missingProfile = profile.selectedStyles.length === 0;

  if (missingItem || missingProfile) {
    return {
      key, available: false, score: null, weight,
      explanation: unavailableExplanation(key, missingItem, missingProfile),
    };
  }

  const userAttributes = computeUserAttributes(profile.selectedStyles);
  if (!userAttributes) {
    return {
      key, available: false, score: null, weight,
      explanation: unavailableProfileExplanation(key),
    };
  }

  const raw = scoreStyleCoherence([item], userAttributes, profile.selectedStyles);
  const score = Math.round(Math.min(100, Math.max(0, raw * 100)));
  return { key, available: true, score, weight, explanation: styleExplanation(score, item, profile.selectedStyles) };
}

function scoreFit(item: FitItem, profile: ProfileInputs): CriterionScore {
  const key: CriterionKey = 'fit';
  const weight = DEFAULT_WEIGHTS[key];

  const preferredFit = profile.bodyMeasurements.preferredFit;
  const bodyShape    = profile.bodyMeasurements.body_shape;

  // item.fit is always derived (never null) by toFitItem — so no missing item attr.
  // But the FitItem might come from a minimal item object; treat missing typeName as indicator.
  const missingItem    = !item.typeName;
  // Fit criterion requires at least preferredFit OR body_shape in the profile.
  const missingProfile = !preferredFit && !bodyShape;

  if (missingItem || missingProfile) {
    return {
      key, available: false, score: null, weight,
      explanation: unavailableExplanation(key, missingItem, missingProfile),
    };
  }

  let raw = 0.5;

  // Fit-preference sub-score (0–1)
  if (preferredFit) {
    raw = scoreFitPreference(item.fit, preferredFit);
  }

  // Body-shape multiplier sub-score: reuse engine's per-shape logic.
  // bodyShapeMultiplier returns [0.85, 1.15]; we apply it to the preference score.
  if (bodyShape) {
    const mult = bodyShapeMultiplier([item], bodyShape);
    // Clamp to [0, 1] — multiplier can push above 1 on good matches.
    raw = Math.min(1.0, raw * mult);
    // If we had no preferredFit, use the multiplier as a stand-alone centered score.
    if (!preferredFit) raw = Math.min(1.0, 0.5 * mult);
  }

  const score = Math.round(Math.min(100, Math.max(0, raw * 100)));
  return {
    key, available: true, score, weight,
    explanation: fitExplanation(score, item.fit, preferredFit, bodyShape),
  };
}

function scoreMeasurement(item: FitItem, profile: ProfileInputs): CriterionScore {
  const key: CriterionKey = 'measurement';
  const weight = DEFAULT_WEIGHTS[key];

  const missingItem    = !item.garmentMeasurements || Object.keys(item.garmentMeasurements).length === 0;

  // Check if the user has any relevant numeric body measurements (not just preferredFit/bodyShape).
  const BODY_NUM_KEYS: Array<keyof BodyMeasurements> = [
    'body_bust', 'body_waist', 'body_hip', 'body_shoulder_width',
    'body_sleeve_length', 'body_upper_body_length', 'body_upper_arm',
    'body_inseam', 'body_thigh', 'body_rise',
  ];
  const hasBodyMeasurements = BODY_NUM_KEYS.some(k => typeof profile.bodyMeasurements[k] === 'number');
  const missingProfile = !hasBodyMeasurements;

  if (missingItem || missingProfile) {
    return {
      key, available: false, score: null, weight,
      explanation: unavailableExplanation(key, missingItem, missingProfile),
    };
  }

  // Reuse the per-item fit result from the engine.
  const result = scoreItemFit(item, profile.bodyMeasurements);

  // If scoreItemFit returned no points (no overlap between garment/body keys),
  // it returns score=0.5 and no points — treat as unavailable rather than a neutral score.
  if (result.points.length === 0) {
    return {
      key, available: false, score: null, weight,
      explanation: 'No matching measurement pairs could be compared — add relevant body measurements.',
    };
  }

  const score = Math.round(Math.min(100, Math.max(0, result.score * 100)));
  return {
    key, available: true, score, weight,
    explanation: measurementExplanation(score, result.warnings),
  };
}

function scoreFabric(item: FitItem, profile: ProfileInputs): CriterionScore {
  const key: CriterionKey = 'fabric';
  const weight = DEFAULT_WEIGHTS[key];

  const missingItem    = !item.fabricName;
  // Fabric benefits from style context, but is evaluable without a profile if material is present.
  // Per R3: fabric criterion requires item material — profile is optional for this criterion.
  const missingProfile = false; // fabric is always evaluable if item.material present

  if (missingItem || missingProfile) {
    return {
      key, available: false, score: null, weight,
      explanation: unavailableExplanation(key, missingItem, missingProfile),
    };
  }

  // Season/fabric sub-score via engine's season matcher.
  const seasonRaw = scoreSeasonMatch([item]);

  // Style-config fabric bonus: if item's fabric is in the allowed list for any selected style,
  // give a compatibility boost; if it's explicitly banned, give a penalty.
  let styleBonus = 0;
  if (profile.selectedStyles.length > 0 && item.fabricName) {
    const fn = item.fabricName;
    for (const styleId of profile.selectedStyles) {
      const cfg = styleConfigById(styleId);
      if (!cfg) continue;
      if (cfg.fabricsBanned.includes(fn)) { styleBonus -= 0.20; break; }
      if (cfg.fabricsAllowed.length > 0 && cfg.fabricsAllowed.includes(fn)) { styleBonus += 0.10; break; }
    }
  }

  const raw = Math.min(1.0, Math.max(0, seasonRaw + styleBonus));
  const score = Math.round(Math.min(100, Math.max(0, raw * 100)));
  return {
    key, available: true, score, weight,
    explanation: fabricExplanation(score, item, profile.selectedStyles),
  };
}

// ─── Composite score with weight renormalization ──────────────────────────────

export function computeVerdict(item: FitItem, profile: ProfileInputs): VerdictResult {
  const criteria: CriterionScore[] = [
    scoreColor(item, profile),
    scoreStyle(item, profile),
    scoreFit(item, profile),
    scoreMeasurement(item, profile),
    scoreFabric(item, profile),
  ];

  // Filter to available criteria and renormalize weights.
  const available = criteria.filter(c => c.available && c.score !== null);

  if (available.length === 0) {
    return { overall_score: null, recommendation: null, criteria };
  }

  const weightSum = available.reduce((s, c) => s + c.weight, 0);
  let weightedScore = 0;
  for (const c of available) {
    weightedScore += (c.score! * c.weight) / weightSum;
  }

  const overall_score = Math.round(Math.min(100, Math.max(0, weightedScore)));
  const recommendation = toRecommendation(overall_score);

  return { overall_score, recommendation, criteria };
}
