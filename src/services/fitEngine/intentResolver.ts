import {
  IntentContext,
  EngineContext,
  ScoringWeights,
  ColorScheme,
  BodyGoal,
  OccasionTag,
  Season,
} from '../../types/fitEngine';
import { FormulaId } from './formulaCatalog';

// ─── Default scoring weights (must match outfitRanker.ts) ───────────────────

const DEFAULT_WEIGHTS: ScoringWeights = {
  style:      0.25,
  color:      0.25,
  fit:        0.10,
  proportion: 0.10,
  formality:  0.10,
  season:     0.10,
  texture:    0.05,
};

// ─── Resolved intent — concrete parameters the engine can consume ───────────

export interface ResolvedIntent {
  /** Formula IDs to prefer (passed to generateCandidates) */
  formulaPreferences: FormulaId[];
  /** Adjusted scoring weights */
  weights: ScoringWeights;
  /** Style overrides to merge into EngineContext.styleProfile */
  styleOverrides?: string[];
  /** Max distinct colors (stricter than default if set) */
  maxColors?: number;
  /** Formality range for hard constraint filtering */
  formalityRange?: [number, number];
  /** Season to enforce */
  seasonOverride?: Season;
  /** Require outerwear slot to be filled */
  requireOuterwear: boolean;
  /** Require accessory slot to be filled */
  requireAccessory: boolean;
}

// ─── Color scheme → formula mapping ─────────────────────────────────────────

const COLOR_SCHEME_FORMULAS: Record<ColorScheme, FormulaId[]> = {
  monochrome:     ['monochrome'],
  tonal:          ['tonal_gradient'],
  analogous:      ['tonal_gradient', 'monochrome'],
  complementary:  ['contrast_pairing', 'neutral_pop'],
  neutral_accent: ['neutral_pop', 'one_two_three'],
};

// ─── Body goal → formula + weight adjustments ───────────────────────────────

const BODY_GOAL_FORMULAS: Record<BodyGoal, FormulaId[]> = {
  elongation:        ['monochrome', 'tonal_gradient', 'rule_of_thirds'],
  broaden_shoulders: ['contrast_pairing', 'one_two_three'],
  define_waist:      ['rule_of_thirds', 'contrast_pairing'],
  balanced:          [],
};

const BODY_GOAL_WEIGHT_BOOSTS: Record<BodyGoal, Partial<ScoringWeights>> = {
  elongation:        { proportion: 0.20, color: 0.30 },
  broaden_shoulders: { proportion: 0.20 },
  define_waist:      { proportion: 0.20 },
  balanced:          {},
};

// ─── Occasion → formality range + formula hints ─────────────────────────────

const OCCASION_DEFAULTS: Record<OccasionTag, {
  formalityRange: [number, number];
  formulas: FormulaId[];
  seasonHint?: Season;
}> = {
  daily:      { formalityRange: [1.5, 3.0], formulas: [] },
  date_night: { formalityRange: [2.5, 4.0], formulas: ['tonal_gradient', 'neutral_pop'] },
  business:   { formalityRange: [3.5, 5.0], formulas: ['one_two_three', 'tonal_gradient'] },
  weekend:    { formalityRange: [1.0, 2.5], formulas: [] },
  event:      { formalityRange: [3.5, 5.0], formulas: ['neutral_pop', 'one_two_three', 'contrast_pairing'] },
  travel:     { formalityRange: [1.5, 3.0], formulas: ['layering_stack', 'texture_stack'] },
};

// ─── Main resolver ──────────────────────────────────────────────────────────

export function resolveIntent(intent: IntentContext): ResolvedIntent {
  const formulaSet = new Set<FormulaId>();
  const weights = { ...DEFAULT_WEIGHTS };

  // 1. Color scheme → formulas + weight boost
  if (intent.colorScheme) {
    for (const f of COLOR_SCHEME_FORMULAS[intent.colorScheme]) {
      formulaSet.add(f);
    }
    // Monochrome/tonal requests → boost color weight
    if (intent.colorScheme === 'monochrome' || intent.colorScheme === 'tonal') {
      weights.color = 0.30;
    }
  }

  // 2. Body goal → formulas + weight adjustments
  if (intent.bodyGoal) {
    for (const f of BODY_GOAL_FORMULAS[intent.bodyGoal]) {
      formulaSet.add(f);
    }
    const boosts = BODY_GOAL_WEIGHT_BOOSTS[intent.bodyGoal];
    for (const [key, value] of Object.entries(boosts)) {
      weights[key as keyof ScoringWeights] = value as number;
    }
  }

  // 3. Proportion rule → formula + weight boost
  if (intent.proportionRule) {
    if (intent.proportionRule === 'rule_of_thirds') {
      formulaSet.add('rule_of_thirds');
    }
    weights.proportion = Math.max(weights.proportion, 0.15);
  }

  // 4. Occasion → formality range + formula hints
  let formalityRange = intent.formalityRange;
  if (intent.occasion) {
    const occ = OCCASION_DEFAULTS[intent.occasion];
    if (!formalityRange) {
      formalityRange = occ.formalityRange;
    }
    for (const f of occ.formulas) {
      formulaSet.add(f);
    }
  }

  // 5. Layering / accessory requirements → formula hints
  if (intent.requireOuterwear) {
    formulaSet.add('layering_stack');
  }

  // 6. Apply explicit weight overrides last (user/AI has final say)
  if (intent.weightOverrides) {
    for (const [key, value] of Object.entries(intent.weightOverrides)) {
      if (value !== undefined) {
        weights[key as keyof ScoringWeights] = value;
      }
    }
  }

  // 7. Normalize weights to sum to ~0.95 (0.05 reserved for anchor placeholder)
  const RESERVED = 0.05;
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum > 0) {
    const scale = (1.0 - RESERVED) / sum;
    for (const key of Object.keys(weights) as (keyof ScoringWeights)[]) {
      weights[key] = Math.round(weights[key] * scale * 1000) / 1000;
    }
  }

  return {
    formulaPreferences: formulaSet.size > 0 ? [...formulaSet] : [],
    weights,
    styleOverrides: intent.styles,
    maxColors: intent.maxColors,
    formalityRange,
    seasonOverride: intent.seasonOverride,
    requireOuterwear: intent.requireOuterwear ?? false,
    requireAccessory: intent.requireAccessory ?? false,
  };
}

// ─── Apply resolved intent to an EngineContext ──────────────────────────────
// Returns a new context with intent-driven overrides merged in.
// The original context is not mutated.

export function applyIntent(
  ctx: EngineContext,
  resolved: ResolvedIntent,
): EngineContext {
  const next = { ...ctx };

  // Override styles if intent specifies them
  if (resolved.styleOverrides && resolved.styleOverrides.length > 0) {
    next.styleProfile = {
      ...ctx.styleProfile,
      selectedStyles: resolved.styleOverrides,
      // Clear computed attributes so they're recomputed from the override
      computedAttributes: undefined,
    };
  }

  return next;
}
