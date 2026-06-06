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
} from './scoring.ts';
import { FormulaId } from './generation.ts';

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
  return [slots.top, slots.bottom, slots.shoes, slots.outwear, slots.accessory]
    .filter((id): id is string => id !== undefined);
}

function isDuplicate(a: OutfitSlots, b: OutfitSlots): boolean {
  return a.top === b.top && a.bottom === b.bottom && a.shoes === b.shoes;
}

function passesHardConstraints(fitItems: FitItem[], ctx: EngineContext): boolean {
  const maxColors = ctx.intent?.maxColors ?? 4;
  if (new Set(fitItems.map(i => i.colorProfile.primaryColor)).size > maxColors) return false;

  const boldPatterns = fitItems.filter(i => i.fabric.pattern !== 'solid' && i.fabric.pattern !== 'checkered').length;
  if (boldPatterns > 1) return false;

  const seasons = fitItems.map(i => i.fabric.season).filter(s => s !== 'allSeason');
  if (seasons.includes('summer') && seasons.includes('winter')) return false;

  const tops = fitItems.filter(i => i.category === 'top' || i.category === 'outwear');
  const bottoms = fitItems.filter(i => i.category === 'bottom');
  if (tops.some(i => i.fit === 'oversized') && bottoms.some(i => i.fit === 'oversized')) return false;

  if (fitItems.length >= 2) {
    const formalities = fitItems.map(i => i.formality);
    if (Math.max(...formalities) - Math.min(...formalities) > 2.5) return false;
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

  const w = ctx.scoringWeights;
  const wStyle      = w?.style      ?? W_STYLE;
  const wColor      = w?.color      ?? W_COLOR;
  const wFit        = w?.fit        ?? W_FIT;
  const wProportion = w?.proportion ?? W_PROPORTION;
  const wFormality  = w?.formality  ?? W_FORMALITY;
  const wSeason     = w?.season     ?? W_SEASON;
  const wTexture    = w?.texture    ?? W_TEXTURE;

  const scored: ScoredOutfit[] = [];

  for (const c of candidates) {
    const fitItems = slotsToIds(c.slots).map(id => itemMap.get(id)).filter((i): i is FitItem => i !== undefined);
    if (!passesHardConstraints(fitItems, ctx)) continue;

    const styleCoherence = userAttributes
      ? scoreStyleCoherence(fitItems, userAttributes, ctx.styleProfile.selectedStyles)
      : 0.5;

    const colorHarmony         = scoreColorHarmony(fitItems, ctx.colorPreferences);
    const fitScore             = scoreOutfitFit(fitItems, ctx.bodyMeasurements);
    const proportionBalance    = scoreProportionBalance(fitItems);
    const formalityConsistency = scoreFormalityConsistency(fitItems);
    const seasonMatch          = scoreSeasonMatch(fitItems);
    const textureInterest      = scoreTextureHarmony(fitItems);
    const anchorClarity        = scoreAnchorClarity(fitItems);

    const totalScore =
      wStyle      * styleCoherence +
      wColor      * colorHarmony +
      wFit        * fitScore +
      wProportion * proportionBalance +
      wFormality  * formalityConsistency +
      wSeason     * seasonMatch +
      wTexture    * textureInterest +
      0.05        * anchorClarity;

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

  // Diversification
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

  selected.sort((a, b) => a.tier !== b.tier ? a.tier - b.tier : b.totalScore - a.totalScore);
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
