import { StyleAttributes, Mood, ColorPalette, Silhouette, FitItem } from '../../types/fitEngine';
import { styleById } from './styleCatalog';

// ─── Similarity formulas (fit-engine.md §4.4) ────────────────────────────────

function numericSim(a: number, b: number): number {
  return 1 - Math.abs(a - b) / 4;
}

function jaccardSim<T>(a: T[], b: T[]): number {
  if (a.length === 0 && b.length === 0) return 1.0;
  const setA = new Set(a);
  const intersection = b.filter(x => setA.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1.0 : intersection / union;
}

export function attributeSimilarity(a: StyleAttributes, b: StyleAttributes): number {
  return (
    0.25 * numericSim(a.formality, b.formality) +
    0.25 * jaccardSim<Mood>(a.mood, b.mood) +
    0.20 * jaccardSim<Silhouette>(a.silhouette, b.silhouette) +
    0.15 * jaccardSim<ColorPalette>(a.colorPalette, b.colorPalette) +
    0.10 * numericSim(a.textureRichness, b.textureRichness) +
    0.05 * numericSim(a.patternLevel, b.patternLevel)
  );
}

// ─── Recency-weighted user style profile (§4.3) ──────────────────────────────

export function computeUserAttributes(selectedStyles: string[]): StyleAttributes | undefined {
  if (selectedStyles.length === 0) return undefined;

  const defs = selectedStyles
    .map(id => styleById(id))
    .filter((d): d is NonNullable<typeof d> => d !== undefined);

  if (defs.length === 0) return undefined;

  // weight(i) = 0.8^(n-1-i); most recent = 1.0
  const n = defs.length;
  const weights = defs.map((_, i) => Math.pow(0.8, n - 1 - i));
  const total = weights.reduce((s, w) => s + w, 0);

  const formality      = defs.reduce((s, d, i) => s + d.attributes.formality * weights[i], 0) / total;
  const patternLevel   = defs.reduce((s, d, i) => s + d.attributes.patternLevel * weights[i], 0) / total;
  const textureRichness= defs.reduce((s, d, i) => s + d.attributes.textureRichness * weights[i], 0) / total;

  const paletteScores: Record<string, number> = {};
  const silhouetteScores: Record<string, number> = {};
  const moodScores: Record<string, number> = {};

  defs.forEach((d, i) => {
    const w = weights[i] / total;
    d.attributes.colorPalette.forEach(v => { paletteScores[v] = (paletteScores[v] ?? 0) + w; });
    d.attributes.silhouette.forEach(v => { silhouetteScores[v] = (silhouetteScores[v] ?? 0) + w; });
    d.attributes.mood.forEach(v => { moodScores[v] = (moodScores[v] ?? 0) + w; });
  });

  return {
    formality,
    patternLevel,
    textureRichness,
    colorPalette: (Object.entries(paletteScores).filter(([, s]) => s > 0.15).map(([v]) => v)) as ColorPalette[],
    silhouette:   (Object.entries(silhouetteScores).filter(([, s]) => s > 0.15).map(([v]) => v)) as Silhouette[],
    mood:         (Object.entries(moodScores).filter(([, s]) => s > 0.15).map(([v]) => v)) as Mood[],
  };
}

// ─── Item → attribute proxy ───────────────────────────────────────────────────

function itemAttributes(item: FitItem): StyleAttributes | null {
  // Only use the top 2 style tags so items stay style-distinctive.
  // Using all 4-5 tags bloats attribute sets and makes every item match
  // every user preference via Jaccard, clustering scores in a narrow range.
  const defs = item.styleTags
    .slice(0, 2)
    .map(id => styleById(id))
    .filter((d): d is NonNullable<typeof d> => d !== undefined);

  if (defs.length === 0) return null;

  // Primary tag gets 3× weight for clear style identity
  const weights = defs.map((_, i) => (i === 0 ? 3 : 1));
  const total = weights.reduce((s, w) => s + w, 0);

  const formality       = defs.reduce((s, d, i) => s + d.attributes.formality * weights[i], 0) / total;
  const patternLevel    = defs.reduce((s, d, i) => s + d.attributes.patternLevel * weights[i], 0) / total;
  const textureRichness = defs.reduce((s, d, i) => s + d.attributes.textureRichness * weights[i], 0) / total;

  // Only include primary tag's set attributes + shared attributes from secondary
  const primaryPalettes    = defs[0]?.attributes.colorPalette ?? [];
  const primarySilhouettes = defs[0]?.attributes.silhouette ?? [];
  const primaryMoods       = defs[0]?.attributes.mood ?? [];

  // From secondary tag, only keep values that overlap with primary (reinforced signal)
  const primaryPaletteSet    = new Set(primaryPalettes);
  const primarySilhouetteSet = new Set(primarySilhouettes);
  const primaryMoodSet       = new Set(primaryMoods);

  const secondaryPalettes    = defs[1]?.attributes.colorPalette.filter(v => primaryPaletteSet.has(v)) ?? [];
  const secondarySilhouettes = defs[1]?.attributes.silhouette.filter(v => primarySilhouetteSet.has(v)) ?? [];
  const secondaryMoods       = defs[1]?.attributes.mood.filter(v => primaryMoodSet.has(v)) ?? [];

  return {
    formality,
    patternLevel,
    textureRichness,
    colorPalette: [...new Set([...primaryPalettes, ...secondaryPalettes])] as ColorPalette[],
    silhouette:   [...new Set([...primarySilhouettes, ...secondarySilhouettes])] as Silhouette[],
    mood:         [...new Set([...primaryMoods, ...secondaryMoods])] as Mood[],
  };
}

export function scoreStyleCoherence(
  items: FitItem[],
  userProfile: StyleAttributes,
  userSelectedStyles?: string[],
): number {
  const attrs = items.map(itemAttributes).filter((a): a is StyleAttributes => a !== null);
  if (attrs.length === 0) return 0.5;

  // Base: attribute vector similarity
  const baseSim = attrs.reduce((s, a) => s + attributeSimilarity(userProfile, a), 0) / attrs.length;

  // Bonus: reward items whose style tags directly match a user-selected style.
  // Check ALL tags because styleTagsOf() reordering can push user-selected
  // styles to position 2+ when "reinforced" tags take the lead. The bonus is
  // soft (30% blend) and the proportion of matching items provides differentiation.
  if (userSelectedStyles && userSelectedStyles.length > 0) {
    const userSet = new Set(userSelectedStyles);
    let directMatches = 0;
    for (const item of items) {
      const hasMatch = item.styleTags.some(tag => userSet.has(tag));
      if (hasMatch) directMatches++;
    }
    const directMatchRatio = directMatches / items.length;
    // Blend: 70% attribute similarity + 30% direct tag match
    return 0.70 * baseSim + 0.30 * directMatchRatio;
  }

  return baseSim;
}
