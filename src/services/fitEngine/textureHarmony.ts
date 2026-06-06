import { FitItem, FabricWeight } from '../../types/fitEngine';

const WEIGHT_LEVEL: Record<FabricWeight, number> = { light: 0, medium: 1, heavy: 2 };

// Score texture/material interest in an outfit.
//
// Stylist Rule of Three Textures: monochrome outfits need variety in
// matte/shine/texture. In general, outfits benefit from material variety
// while maintaining seasonal weight consistency.
//
// Scoring dimensions:
// 1. Weight consistency: items shouldn't wildly differ in fabric weight
//    (wool coat + linen shorts = bad). Light penalty for extremes.
// 2. Material variety: 2–3 distinct fabric weights = interesting.
//    All-same = boring. 3 extremes = chaotic.
export function scoreTextureHarmony(items: FitItem[]): number {
  const weights = items
    .filter(i => i.category !== 'accessory') // accessories don't affect texture balance
    .map(i => WEIGHT_LEVEL[i.fabric.fabricWeight]);

  if (weights.length <= 1) return 0.7;

  // Weight consistency: penalize extreme spread (light + heavy in same outfit)
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const spread = max - min;

  let consistencyScore: number;
  if (spread === 0) consistencyScore = 0.6;       // all same weight = boring but safe
  else if (spread === 1) consistencyScore = 1.0;   // adjacent weights = ideal variety
  else consistencyScore = 0.4;                      // light + heavy = seasonal clash likely

  // Material variety: count distinct fabric weights
  const distinct = new Set(weights).size;
  let varietyScore: number;
  if (distinct === 1) varietyScore = 0.5;     // monotone texture
  else if (distinct === 2) varietyScore = 1.0; // good variety
  else varietyScore = 0.7;                     // 3 weights = complex but can work

  // Breathability consistency: all high breathability or all low = seasonal coherence
  const breathabilities = items
    .filter(i => i.category !== 'accessory')
    .map(i => i.fabric.breathability);
  const breathSet = new Set(breathabilities);
  const breathScore = breathSet.size <= 2 ? 1.0 : 0.7;

  return 0.40 * consistencyScore + 0.35 * varietyScore + 0.25 * breathScore;
}
