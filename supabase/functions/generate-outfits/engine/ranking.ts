// Ranking + shuffling + intent resolution.
// Merges: outfitRanker.ts + shuffler.ts + intentResolver.ts.

import {
  OutfitCandidate, ScoredOutfit, EngineContext, FitItem, OutfitSlots,
  IntentContext, ScoringWeights, ColorScheme, BodyGoal, OccasionTag, Season,
} from './types.ts';
import {
  scoreColorHarmony, scoreStyleCoherence, computeUserAttributes,
  scoreOutfitFit, scoreProportionBalance, scoreFormalityConsistency,
  scoreSeasonMatch, scoreTextureHarmony, scoreAnchorClarity,
  scoreTasteAdjustment, genderStylingDelta, housePOVDelta,
  scoreTargetSilhouette,
} from './scoring.ts';
import { tasteAffinityDelta, tasteDismissPenalty } from './taste.ts';
import { FormulaId } from './generation.ts';
import { resultingBodySilhouette } from './silhouette.ts';

// ═══════════════════════════════════════════════════════════════════════════
// INTENT RESOLVER
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_WEIGHTS: ScoringWeights = {
  style: 0.25, color: 0.25, fit: 0.10,
  proportion: 0.10, formality: 0.10, season: 0.10, texture: 0.05,
};

export interface ResolvedIntent {
  formulaPreferences: FormulaId[];
  weights: ScoringWeights;
  styleOverrides?: string[];
  maxColors?: number;
  formalityRange?: [number, number];
  seasonOverride?: Season;
  requireOuterwear: boolean;
  requireAccessory: boolean;
}

const COLOR_SCHEME_FORMULAS: Record<ColorScheme, FormulaId[]> = {
  monochrome:     ['monochrome'],
  tonal:          ['tonal_gradient'],
  analogous:      ['tonal_gradient', 'monochrome'],
  complementary:  ['contrast_pairing', 'neutral_pop'],
  neutral_accent: ['neutral_pop', 'one_two_three'],
};

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

const OCCASION_DEFAULTS: Record<OccasionTag, { formalityRange: [number, number]; formulas: FormulaId[] }> = {
  daily:      { formalityRange: [1.5, 3.0], formulas: [] },
  date_night: { formalityRange: [2.5, 4.0], formulas: ['tonal_gradient', 'neutral_pop'] },
  business:   { formalityRange: [3.5, 5.0], formulas: ['one_two_three', 'tonal_gradient'] },
  weekend:    { formalityRange: [1.0, 2.5], formulas: [] },
  event:      { formalityRange: [3.5, 5.0], formulas: ['neutral_pop', 'one_two_three', 'contrast_pairing'] },
  travel:     { formalityRange: [1.5, 3.0], formulas: ['layering_stack', 'texture_stack'] },
};

export function resolveIntent(intent: IntentContext): ResolvedIntent {
  const formulaSet = new Set<FormulaId>();
  const weights = { ...DEFAULT_WEIGHTS };

  if (intent.colorScheme) {
    for (const f of COLOR_SCHEME_FORMULAS[intent.colorScheme]) formulaSet.add(f);
    if (intent.colorScheme === 'monochrome' || intent.colorScheme === 'tonal') weights.color = 0.30;
  }

  if (intent.bodyGoal) {
    for (const f of BODY_GOAL_FORMULAS[intent.bodyGoal]) formulaSet.add(f);
    const boosts = BODY_GOAL_WEIGHT_BOOSTS[intent.bodyGoal];
    for (const [key, value] of Object.entries(boosts)) {
      weights[key as keyof ScoringWeights] = value as number;
    }
  }

  if (intent.proportionRule) {
    if (intent.proportionRule === 'rule_of_thirds') formulaSet.add('rule_of_thirds');
    weights.proportion = Math.max(weights.proportion, 0.15);
  }

  let formalityRange = intent.formalityRange;
  if (intent.occasion) {
    const occ = OCCASION_DEFAULTS[intent.occasion];
    if (!formalityRange) formalityRange = occ.formalityRange;
    for (const f of occ.formulas) formulaSet.add(f);
  }

  if (intent.requireOuterwear) formulaSet.add('layering_stack');

  if (intent.weightOverrides) {
    for (const [key, value] of Object.entries(intent.weightOverrides)) {
      if (value !== undefined) weights[key as keyof ScoringWeights] = value;
    }
  }

  // Normalize weights
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

export function applyIntent(ctx: EngineContext, resolved: ResolvedIntent): EngineContext {
  const next = { ...ctx };
  if (resolved.styleOverrides && resolved.styleOverrides.length > 0) {
    next.styleProfile = {
      ...ctx.styleProfile,
      selectedStyles: resolved.styleOverrides,
      computedAttributes: undefined,
    };
  }
  return next;
}

// ═══════════════════════════════════════════════════════════════════════════
// RANKER
// ═══════════════════════════════════════════════════════════════════════════

const W_STYLE = 0.25, W_COLOR = 0.25, W_FIT = 0.10;
const W_PROPORTION = 0.10, W_FORMALITY = 0.10, W_SEASON = 0.10, W_TEXTURE = 0.05;
const TOP_N = 24;

function slotsToIds(slots: OutfitSlots): string[] {
  // Dedupe: a one-piece occupies both top and bottom with the same id. `mid`
  // is appended LAST (2026-08-10) — several downstream consumers (scoring.ts,
  // index.ts) resolve "the top item" / "the outwear item" via `.find(i =>
  // i.category === …)` over this same flattened order, and a mid item can
  // itself carry category 'top' or 'outwear' (see enrichment.ts CATEGORY_MAP).
  // Keeping it last preserves first-match semantics: the real top/outwear
  // slot item is always found before the mid one.
  return [...new Set(
    [slots.top, slots.bottom, slots.shoes, slots.outwear, slots.accessory, slots.mid]
      .filter((id): id is string => id !== undefined),
  )];
}

function isDuplicate(a: OutfitSlots, b: OutfitSlots): boolean {
  return a.top === b.top && a.bottom === b.bottom && a.shoes === b.shoes;
}

// Styles whose visual language embraces pattern-on-pattern. For these users two
// bold patterns are a deliberate move, not a mistake — the hard ban relaxes to 2
// and scoreTasteAdjustment applies a mild multiplier instead (risky ≠ invalid).
const PATTERN_FRIENDLY_STYLES = new Set(['streetwear', 'y2k', 'bohemian']);

function passesHardConstraints(fitItems: FitItem[], ctx: EngineContext, formula?: string): boolean {
  const maxColors = ctx.intent?.maxColors ?? 4;
  if (new Set(fitItems.map(i => i.colorProfile.primaryColor)).size > maxColors) return false;

  const boldPatterns = fitItems.filter(i => i.fabric.pattern !== 'solid' && i.fabric.pattern !== 'checkered').length;
  const patternFriendly = ctx.styleProfile.selectedStyles.some(s => PATTERN_FRIENDLY_STYLES.has(s));
  if (boldPatterns > (patternFriendly ? 2 : 1)) return false;

  const seasons = fitItems.map(i => i.fabric.season).filter(s => s !== 'allSeason');
  if (seasons.includes('summer') && seasons.includes('winter')) return false;

  const tops = fitItems.filter(i => i.category === 'top' || i.category === 'outwear');
  const bottoms = fitItems.filter(i => i.category === 'bottom');
  if (tops.some(i => i.fit === 'oversized') && bottoms.some(i => i.fit === 'oversized')) return false;

  if (fitItems.length >= 2) {
    const formalities = fitItems.map(i => i.formality);
    // high_low candidates exist to mix registers — the generic gap cap of 2.5
    // rejected exactly the contrast that formula was built to produce. Give them
    // headroom (3.5) while still vetoing true costume-level gaps.
    const gapLimit = formula === 'high_low' ? 3.5 : 2.5;
    if (Math.max(...formalities) - Math.min(...formalities) > gapLimit) return false;
  }

  if (ctx.intent?.formalityRange) {
    const [min, max] = ctx.intent.formalityRange;
    const avg = fitItems.reduce((s, i) => s + i.formality, 0) / fitItems.length;
    if (avg < min - 0.5 || avg > max + 0.5) return false;
  }

  if (ctx.intent?.requireOuterwear && !fitItems.some(i => i.category === 'outwear')) return false;
  if (ctx.intent?.requireAccessory && !fitItems.some(i => i.category === 'accessory')) return false;

  return true;
}

// Shape-goal scoring delta (010-wardrobe-critic follow-up, 2026-08-10): a
// small additive nudge — same band as genderDelta/houseDelta — rewarding
// outfits whose ACTUAL resultingBodySilhouette matches the user's standing
// shapeGoal, and lightly penalizing a miss. This is what lets a 'hourglass'
// goal actually bite: targetsForDesiredShape (silhouette.ts) only nudges
// generation toward balanced VOLUME for that goal (hourglass is mostly a
// waist-DEFINITION outcome, not a volume one — see its own comment), so this
// delta is the layer that rewards the specific outfits that actually create
// the waist (outfitWaistDefinition, via resultingBodySilhouette). 'auto' /
// 'natural' / undefined → 0, no-op (matches resolveTargetSilhouette's own
// OFF condition for this feature). CALIBRATION-PENDING magnitudes.
const SHAPE_GOAL_MATCH_BONUS = 0.08;
const SHAPE_GOAL_MISS_PENALTY = 0.05;

function shapeGoalDelta(items: FitItem[], ctx: EngineContext): number {
  const goal = ctx.shapeGoal;
  if (!goal || goal === 'auto' || goal === 'natural') return 0;
  const resulting = resultingBodySilhouette(items, ctx.bodyMeasurements.body_shape);
  return resulting === goal ? SHAPE_GOAL_MATCH_BONUS : -SHAPE_GOAL_MISS_PENALTY;
}

function classifyTier(slots: OutfitSlots, itemMap: Map<string, FitItem>, userStyles: Set<string>): 1 | 2 {
  if (userStyles.size === 0) return 1;
  const coreIds = [slots.top, slots.bottom];
  for (const id of coreIds) {
    const item = itemMap.get(id);
    if (!item) return 2;
    if (!item.styleTags.some(tag => userStyles.has(tag))) return 2;
  }
  return 1;
}

export function rankCandidates(
  candidates: OutfitCandidate[],
  itemMap: Map<string, FitItem>,
  ctx: EngineContext,
): ScoredOutfit[] {
  const userAttributes = computeUserAttributes(ctx.styleProfile.selectedStyles);
  const userStyleSet = new Set(ctx.styleProfile.selectedStyles);

  // 4 suggestion toggles (2026-08-10): undefined/true = on (default, unchanged
  // behavior). false forces the matching dim(s) out of the weighted average
  // below — same "drops out, weight redistributes" mechanism the provenance
  // gates (fitHasData/proportionHasData/…) already use, not a new one.
  const suggestByStyle = ctx.suggestByStyle !== false;
  const suggestByMeasurements = ctx.suggestByMeasurements !== false;

  const w = ctx.scoringWeights;
  const wStyle      = w?.style      ?? W_STYLE;
  const wColor      = w?.color      ?? W_COLOR;
  const wProportion = w?.proportion ?? W_PROPORTION;
  const wFormality  = w?.formality  ?? W_FORMALITY;
  const wSeason     = w?.season     ?? W_SEASON;
  const wTexture    = w?.texture    ?? W_TEXTURE;

  // Fit deserves real weight when there is real data behind it — the user
  // entered measurements, so honor them.
  const bodyHasMeasurements = Object.values(ctx.bodyMeasurements)
    .some(v => typeof v === 'number');
  const wFit = bodyHasMeasurements ? Math.max(w?.fit ?? W_FIT, 0.18) : (w?.fit ?? W_FIT);

  const scored: ScoredOutfit[] = [];

  for (const c of candidates) {
    const fitItems = slotsToIds(c.slots).map(id => itemMap.get(id)).filter((i): i is FitItem => i !== undefined);
    if (!passesHardConstraints(fitItems, ctx, c.formula)) continue;

    // Defense-in-depth for the mid/outer physical rule (2026-08-10):
    // generation.ts already never EMITS a heavy mid under a true outer, but
    // this is the single choke point every candidate — from any generator —
    // passes through before scoring, so it re-asserts the rule rather than
    // trusting every producer to have applied it. CALIBRATION-PENDING (same
    // rule as generation.ts's midFitsUnderOuter).
    if (c.slots.mid && c.slots.outwear) {
      const midItem = itemMap.get(c.slots.mid);
      if (midItem && midItem.fabric.fabricWeight === 'heavy') continue;
    }

    // Formula-aware contracts (2026-07-02): each look is judged against the
    // concept that generated it — monochrome may trade lightness contrast for
    // texture, texture_stack may stack weights, high_low may split registers.
    const colorHarmony         = scoreColorHarmony(fitItems, ctx.colorPreferences, ctx.colorSeason, ctx.weatherSeason, c.formula, ctx.colorTone12);
    const fitScore             = scoreOutfitFit(fitItems, ctx.bodyMeasurements);
    // Silhouette-first resolution (2026-07-12): blend the generic proportion
    // score with how well the outfit realizes ctx.targetSilhouette, weighted
    // by the target's confidence (0 for a fully-guessed wardrobe = no-op —
    // proportionHasData below already excludes this dimension in that case).
    const proportionGeneric    = scoreProportionBalance(fitItems);
    const silhouetteConf       = ctx.targetSilhouette?.confidence ?? 0;
    const proportionBalance    = (ctx.targetSilhouette && silhouetteConf > 0)
      ? (1 - silhouetteConf) * proportionGeneric + silhouetteConf * scoreTargetSilhouette(fitItems, ctx.targetSilhouette)
      : proportionGeneric;
    const formalityConsistency = scoreFormalityConsistency(fitItems, c.formula);
    const seasonMatch          = scoreSeasonMatch(fitItems, ctx.intent?.seasonOverride ?? ctx.weatherSeason);
    const textureInterest      = scoreTextureHarmony(fitItems, c.formula);
    const anchorClarity        = scoreAnchorClarity(fitItems);
    const styleCoherence = userAttributes
      ? scoreStyleCoherence(fitItems, userAttributes, ctx.styleProfile.selectedStyles)
      : 0.5;

    // Confidence weighting: a dimension with no real data behind it drops out of
    // the average instead of pulling every outfit toward a near-constant default.
    // Provenance flags (enrichment.ts) tell real stored attributes from defaulted
    // ones, so sparse wardrobes shed the guessed dimensions while well-populated
    // ones keep full weight — fixing the old "defaults add noise" flattening
    // without penalising users who DID label their items.
    const fitHasData = bodyHasMeasurements && fitItems.some(i => i.garmentMeasurements);
    // Proportion reads each item's `fit` (volume); meaningful only when some item
    // has a real fit, not a type-default guess.
    const proportionHasData = fitItems.some(i => i.provenance.fit);
    // Season reads fabric weight/season, derived from material or warmth_season.
    const seasonHasData = fitItems.some(i => i.provenance.material || i.provenance.warmthSeason);
    // Texture reads fabric weight + pattern, derived from material or pattern.
    const textureHasData = fitItems.some(i => i.provenance.material || i.provenance.pattern);
    // Anchor/style/color/formality stay valid: they ride on type+color, which are
    // always real. Anchor gets a slightly louder voice so a clear hero piece (the
    // hallmark of an intentional look) separates from flat all-quiet combos.
    const dims: Array<[weight: number, score: number, valid: boolean]> = [
      [wStyle,      styleCoherence,       userAttributes !== undefined && suggestByStyle],
      [wColor,      colorHarmony,         true],
      [wFit,        fitScore,             fitHasData && suggestByMeasurements],
      [wProportion, proportionBalance,    proportionHasData && suggestByMeasurements],
      [wFormality,  formalityConsistency, true],
      [wSeason,     seasonMatch,          seasonHasData],
      [wTexture,    textureInterest,      textureHasData],
      [0.10,        anchorClarity,        true],
    ];
    const valid = dims.filter(([, , v]) => v);
    const weightSum = valid.reduce((s, [wd]) => s + wd, 0);
    const base = valid.reduce((s, [wd, sc]) => s + wd * sc, 0) / (weightSum || 1);

    // Taste layer: classic-combo bonus, multiplicative veto for fatal flaws.
    const taste = scoreTasteAdjustment(fitItems);
    // Opt-in gender-aware styling: a small additive nudge, off unless ctx.gender set.
    const genderDelta = ctx.gender ? genderStylingDelta(fitItems, ctx.gender) : 0;
    // Behaviour-learned taste (lever L2): a small positive nudge toward looks like
    // the ones the user has saved/worn. Off (0) until they have positive history;
    // confidence-scaled and capped so it refines order, never overrides styling.
    const tasteDelta = ctx.tasteVector ? tasteAffinityDelta(fitItems, ctx.tasteVector) : 0;
    // Dismiss penalty (feed-signals, 2026-08-07): swipe-left negative signal,
    // a SEPARATE aggregate from tasteVector — see taste.ts's dismiss section
    // header for why it isn't folded into the positive vector. Magnitude in
    // [0, TASTE_MAX_PENALTY]; subtracted here, never added.
    const dismissPenalty = ctx.dismissVector ? tasteDismissPenalty(fitItems, ctx.dismissVector) : 0;
    // House POV (S4): MIEN's own voice as a small tie-breaker, halved when the
    // user's styles pull the opposite way. Applied last, additive, capped ±0.05.
    const houseDelta = housePOVDelta(fitItems, ctx.styleProfile.selectedStyles);
    // Shape-goal nudge (2026-08-10): 0 when the user hasn't set a specific
    // shapeGoal (or set 'auto'/'natural') — see shapeGoalDelta above.
    const shapeGoalBonus = shapeGoalDelta(fitItems, ctx);
    const totalScore = Math.max(0, Math.min(1, (base + taste.bonus) * taste.multiplier + genderDelta + tasteDelta - dismissPenalty + houseDelta + shapeGoalBonus));

    scored.push({
      slots: c.slots,
      formula: c.formula ?? 'one_two_three',
      tier: classifyTier(c.slots, itemMap, userStyleSet),
      styleCoherence, colorHarmony, fitScore, proportionBalance,
      formalityConsistency, seasonMatch, textureInterest, totalScore,
    });
  }

  // Sort: tier 1 first, then by score
  scored.sort((a, b) => a.tier !== b.tier ? a.tier - b.tier : b.totalScore - a.totalScore);

  // Diversification — greedy selection with an in-place overlap penalty.
  // The pre-sort above already orders outfits by (tier, totalScore), so we
  // iterate best-first. A penalty is applied immediately when an outfit shares
  // ≥2 items with any already-selected outfit; the penalized score is visible
  // to no one — we're done selecting, we just keep the greedy order.
  // IMPORTANT: do NOT re-sort after this loop. Re-sorting would reorder
  // penalized outfits below ones that were intentionally passed over during
  // greedy selection, making the result order-dependent on insertion sequence
  // and defeating the purpose of the diversity penalty. The greedy pick order
  // IS the intended "diverse but high-scoring" ranked sequence.
  const selected: ScoredOutfit[] = [];
  const selectedItemSets: Set<string>[] = [];

  for (const outfit of scored) {
    if (selected.some(d => isDuplicate(d.slots, outfit.slots))) continue;

    const outfitIds = new Set(slotsToIds(outfit.slots));
    let maxOverlap = 0;
    for (const prevSet of selectedItemSets) {
      let overlap = 0;
      for (const id of outfitIds) { if (prevSet.has(id)) overlap++; }
      maxOverlap = Math.max(maxOverlap, overlap);
    }
    if (maxOverlap >= 2) {
      outfit.totalScore = Math.max(0, outfit.totalScore - 0.05 * (maxOverlap - 1));
    }

    selected.push(outfit);
    selectedItemSets.push(outfitIds);
    if (selected.length >= TOP_N) break;
  }

  // No re-sort here — the greedy pick order is deterministic and already encodes
  // the diversity-aware ranking. Sorting afterward would be order-dependent.
  return selected;
}

// ═══════════════════════════════════════════════════════════════════════════
// DAILY SHUFFLER
// ═══════════════════════════════════════════════════════════════════════════

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleByThirds<T>(items: T[], rand: () => number): T[] {
  if (items.length <= 3) return items;
  const t1End = Math.ceil(items.length / 3);
  const t2End = Math.ceil((items.length * 2) / 3);
  return [
    ...seededShuffle(items.slice(0, t1End), rand),
    ...seededShuffle(items.slice(t1End, t2End), rand),
    ...seededShuffle(items.slice(t2End), rand),
  ];
}

export function dailyShuffle(items: ScoredOutfit[], userId: string): ScoredOutfit[] {
  if (items.length <= 1) return items;
  const d = new Date();
  const key = `${userId}:${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const rand = mulberry32(hashStr(key));

  const styleTier1 = items.filter(i => i.tier === 1);
  const styleTier2 = items.filter(i => i.tier === 2);

  return [...shuffleByThirds(styleTier1, rand), ...shuffleByThirds(styleTier2, rand)];
}
