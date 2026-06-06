import { ClothingItem } from '../../data';
import { EngineContext, FitItem, ScoredOutfit, OutfitSlots } from '../../types/fitEngine';
import { toFitItem } from './itemClassifier';
import { generateCandidates } from './outfitCompositor';
import { rankCandidates } from './outfitRanker';
import { dailyShuffle } from './shuffler';
import { FormulaId, formulaById } from './formulaCatalog';
import { resolveIntent, applyIntent } from './intentResolver';
import { styleConfigById } from './styleConfigs';
import { filterByStyle } from './styleFilter';

export { toFitItem, categoryOf, colorProfileOf, styleTagsOf } from './itemClassifier';
export { computeUserAttributes, attributeSimilarity, scoreStyleCoherence } from './styleCoherence';
export { scoreItemFit, scoreOutfitFit } from './fitMatcher';
export { scoreColorHarmony } from './colorHarmony';
export { scoreProportionBalance } from './proportionBalance';
export { scoreFormalityConsistency } from './formalityConsistency';
export { scoreSeasonMatch } from './seasonMatch';
export { scoreTextureHarmony } from './textureHarmony';
export { STYLE_CATALOG, styleById } from './styleCatalog';
export { STYLE_CONFIGS, styleConfigById } from './styleConfigs';
export { FORMULA_CATALOG, formulaById } from './formulaCatalog';
export type { FormulaId } from './formulaCatalog';
export { dailyShuffle } from './shuffler';
export { filterByStyle } from './styleFilter';
export { resolveIntent, applyIntent } from './intentResolver';
export type { ResolvedIntent } from './intentResolver';
export type { FitItem, ScoredOutfit, EngineContext, IntentContext, ScoringWeights, StyleConfig } from '../../types/fitEngine';

// ─── Main entry point ────────────────────────────────────────────────────────

export function generateOutfits(
  wardrobe: ClothingItem[],
  ctx: EngineContext,
  userId = 'default',
  formulaPreferences?: FormulaId[],
): ScoredOutfit[] {
  let effectiveCtx = ctx;
  let effectiveFormulas = formulaPreferences;

  // 1. Resolve intent if present
  if (ctx.intent) {
    const resolved = resolveIntent(ctx.intent);
    effectiveCtx = applyIntent(ctx, resolved);

    if (resolved.formulaPreferences.length > 0) {
      effectiveFormulas = effectiveFormulas
        ? [...new Set([...resolved.formulaPreferences, ...effectiveFormulas])]
        : resolved.formulaPreferences;
    }

    effectiveCtx = { ...effectiveCtx, scoringWeights: resolved.weights };
  }

  // 2. Classify all items
  const fitItems = wardrobe.map(toFitItem);

  // 3. Apply style hard constraints — DELETE items that don't match the active style
  //    Override cascade: style config > user preferences > defaults
  //    The primary style (first in selectedStyles) drives hard constraints.
  let filteredItems = fitItems;
  const primaryStyleId = effectiveCtx.styleProfile.selectedStyles[0];
  const styleConfig = primaryStyleId ? styleConfigById(primaryStyleId) : undefined;

  if (styleConfig) {
    const { passed } = filterByStyle(fitItems, styleConfig);
    filteredItems = passed;

    // Apply per-style weights (intent weights override style weights)
    if (!effectiveCtx.scoringWeights) {
      effectiveCtx = { ...effectiveCtx, scoringWeights: styleConfig.weights };
    }
  }

  // 4. Generate candidates from surviving items
  const itemMap = new Map<string, FitItem>(filteredItems.map(i => [i.id, i]));
  const candidates = generateCandidates(filteredItems, effectiveFormulas);

  // 5. Score, rank, and shuffle
  const ranked = rankCandidates(candidates, itemMap, effectiveCtx);
  return dailyShuffle(ranked, userId);
}

// ─── Convert ScoredOutfit → Outfit (for home feed) ───────────────────────────

import { Outfit } from '../../data';

function slotsToIds(slots: OutfitSlots): string[] {
  return [slots.top, slots.bottom, slots.shoes, slots.outwear, slots.accessory]
    .filter((id): id is string => id !== undefined);
}

const OUTFIT_TITLES = [
  'The Quiet Edit', 'A Clean Composition', 'Considered Dressing',
  'Understated Authority', 'Edited Simplicity', 'The Right Balance',
  'Restrained Elegance', 'Deliberate Choices', 'Tonal Harmony', 'The Daily Standard',
];

const SUBTITLES: Record<string, string> = {
  oldmoney:   'old money · refined',
  minimalist: 'minimalist · deliberate',
  streetwear: 'streetwear · urban',
  smartcasual:'smart casual · polished',
  preppy:     'preppy · clean',
  athleisure: 'athleisure · active',
  y2k:        'y2k · playful',
  bohemian:   'bohemian · flowing',
};

const WEATHER_BY_SEASON: Record<string, string> = {
  summer: '26°C', spring: '20°C', fall: '17°C', winter: '10°C', allSeason: '22°C',
};

export function scoredToOutfit(
  scored: ScoredOutfit,
  wardrobe: ClothingItem[],
  fitItems: FitItem[],
  userStyles: string[],
  index: number,
): Outfit {
  const itemMap = new Map(wardrobe.map(i => [i.id, i]));
  const fitMap  = new Map(fitItems.map(i => [i.id, i]));
  const ids     = slotsToIds(scored.slots);
  const items   = ids.map(id => itemMap.get(id)).filter((i): i is ClothingItem => i !== undefined);

  // Dominant style: most common styleTags from items
  const styleCount: Record<string, number> = {};
  ids.forEach(id => {
    fitMap.get(id)?.styleTags.forEach(tag => {
      styleCount[tag] = (styleCount[tag] ?? 0) + 1;
    });
  });

  console.log('[FitEngine] Building outfit from items:');
  ids.forEach(id => {
    const fit = fitMap.get(id);
    const raw = wardrobe.find(i => i.id === id);
    if (fit && raw) {
      console.log(`  item=${raw.name} (${raw.type}) | color=${raw.color} | material=${raw.material ?? 'unknown'} | styleTags=[${fit.styleTags.join(', ')}]`);
    }
  });
  console.log('[FitEngine] Style tag vote tally:', styleCount);
  console.log('[FitEngine] User style preferences:', userStyles);

  const dominantStyle = userStyles.find(s => styleCount[s]) ??
    Object.entries(styleCount).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    'minimalist';

  const winReason = userStyles.includes(dominantStyle) && styleCount[dominantStyle]
    ? `user preference match (score: ${styleCount[dominantStyle]})`
    : `highest vote count (${styleCount[dominantStyle] ?? 0})`;
  console.log(`[FitEngine] → dominant style labeled: "${dominantStyle}" — reason: ${winReason}`);

  // Dominant season from fabric
  const seasons = ids.map(id => fitMap.get(id)?.fabric.season ?? 'allSeason');
  const seasonCount: Record<string, number> = {};
  seasons.forEach(s => { seasonCount[s] = (seasonCount[s] ?? 0) + 1; });
  const dominantSeason = Object.entries(seasonCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'allSeason';

  // Tone: average item tone
  const tone = Math.round(
    items.reduce((sum, i) => sum + (i.tone ?? 1), 0) / Math.max(items.length, 1),
  );

  const title = OUTFIT_TITLES[index % OUTFIT_TITLES.length];
  const subtitle = SUBTITLES[dominantStyle] ?? dominantStyle;
  const description = items.map(i => i.name).join(', ');

  const formulaDef = formulaById(scored.formula as FormulaId);
  const formulaTag = formulaDef?.shortDesc ?? scored.formula.toUpperCase();

  return {
    id: `gen_${ids.join('_')}`,
    title,
    subtitle,
    style: dominantStyle.toUpperCase().replace('_', ' '),
    context: 'DAILY',
    weather: WEATHER_BY_SEASON[dominantSeason],
    description,
    longDescription: '',
    tags: [WEATHER_BY_SEASON[dominantSeason], 'DAILY', formulaTag],
    tone,
    itemIds: ids,
    formula: scored.formula,
    tier: scored.tier,
    scores: {
      totalScore: scored.totalScore,
      styleCoherence: scored.styleCoherence,
      colorHarmony: scored.colorHarmony,
      fitScore: scored.fitScore,
      proportionBalance: scored.proportionBalance,
      formalityConsistency: scored.formalityConsistency,
      seasonMatch: scored.seasonMatch,
      textureInterest: scored.textureInterest,
    },
  };
}
