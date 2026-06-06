import { OutfitCandidate, ScoredOutfit, EngineContext, FitItem, OutfitSlots } from '../../types/fitEngine';
import { scoreOutfitFit } from './fitMatcher';
import { scoreColorHarmony } from './colorHarmony';
import { scoreStyleCoherence, computeUserAttributes } from './styleCoherence';
import { scoreProportionBalance } from './proportionBalance';
import { scoreFormalityConsistency } from './formalityConsistency';
import { scoreSeasonMatch } from './seasonMatch';
import { scoreTextureHarmony } from './textureHarmony';
import { scoreAnchorClarity } from './anchorClarity';

// ─── Weights (proposed two-phase scoring from review) ────────────────────────

const W_STYLE       = 0.25;
const W_COLOR       = 0.25;
const W_FIT         = 0.10;
const W_PROPORTION  = 0.10;
const W_FORMALITY   = 0.10;
const W_SEASON      = 0.10;
const W_TEXTURE     = 0.05;
// Remaining 0.05 reserved for future anchor clarity scorer

const TOP_N = 24;

function slotsToIds(slots: OutfitSlots): string[] {
  return [slots.top, slots.bottom, slots.shoes, slots.outwear, slots.accessory]
    .filter((id): id is string => id !== undefined);
}

// Two outfits are near-identical if they share the same core pieces.
function isDuplicate(a: OutfitSlots, b: OutfitSlots): boolean {
  return a.top === b.top && a.bottom === b.bottom && a.shoes === b.shoes;
}

// ─── Phase 1: Hard constraints — reject outfits that break styling rules ─────

function passesHardConstraints(fitItems: FitItem[], ctx: EngineContext): boolean {
  // Max distinct colors (intent can tighten this)
  const maxColors = ctx.intent?.maxColors ?? 4;
  const distinctColors = new Set(fitItems.map(i => i.colorProfile.primaryColor)).size;
  if (distinctColors > maxColors) return false;

  // Reject: 2+ bold patterns in the outfit
  const boldPatterns = fitItems.filter(
    i => i.fabric.pattern !== 'solid' && i.fabric.pattern !== 'checkered'
  ).length;
  if (boldPatterns > 1) return false;

  // Reject: season extreme mismatch (summer + winter items together)
  const seasons = fitItems.map(i => i.fabric.season).filter(s => s !== 'allSeason');
  const hasSummer = seasons.includes('summer');
  const hasWinter = seasons.includes('winter');
  if (hasSummer && hasWinter) return false;

  // Reject: both top AND bottom are oversized (proportion cardinal sin)
  const tops = fitItems.filter(i => i.category === 'top' || i.category === 'outwear');
  const bottoms = fitItems.filter(i => i.category === 'bottom');
  if (tops.some(i => i.fit === 'oversized') && bottoms.some(i => i.fit === 'oversized')) return false;

  // Reject: formality gap > 2.5 between any two items
  if (fitItems.length >= 2) {
    const formalities = fitItems.map(i => i.formality);
    const gap = Math.max(...formalities) - Math.min(...formalities);
    if (gap > 2.5) return false;
  }

  // Reject: intent formalityRange constraint
  if (ctx.intent?.formalityRange) {
    const [min, max] = ctx.intent.formalityRange;
    const avgFormality = fitItems.reduce((s, i) => s + i.formality, 0) / fitItems.length;
    if (avgFormality < min - 0.5 || avgFormality > max + 0.5) return false;
  }

  // Reject: intent requireOuterwear but no outwear slot
  if (ctx.intent?.requireOuterwear && !fitItems.some(i => i.category === 'outwear')) return false;
  if (ctx.intent?.requireAccessory && !fitItems.some(i => i.category === 'accessory')) return false;

  return true;
}

// ─── Tier classification ────────────────────────────────────────────────────
// Tier 1: outfit matches user's preferred styles (core items align).
// Tier 2: flex/discovery — doesn't match but still well-composed.
//
// An outfit is Tier 1 when both its top AND bottom have at least one style
// tag in the user's selected styles. Top + bottom define the outfit's visual
// identity — shoes/outwear/accessories are less decisive.

function classifyTier(
  slots: OutfitSlots,
  itemMap: Map<string, FitItem>,
  userStyles: Set<string>,
): 1 | 2 {
  if (userStyles.size === 0) return 1; // no preferences → everything is tier 1

  // Check ALL style tags, not just top-2. The styleTagsOf() reordering puts
  // "reinforced" tags (base ∩ color/material boost) first, which can push
  // user-selected styles to position 3+. For example, a White Polo gets
  // ['preppy', 'smartcasual', 'oldmoney', 'minimalist'] — oldmoney is at #3.
  // The BOTH top+bottom requirement already prevents false positives.
  const coreIds = [slots.top, slots.bottom];
  for (const id of coreIds) {
    const item = itemMap.get(id);
    if (!item) return 2;
    const hasMatch = item.styleTags.some(tag => userStyles.has(tag));
    if (!hasMatch) return 2;
  }
  return 1;
}

// ─── Phase 2: Soft scoring — rank surviving outfits ──────────────────────────

export function rankCandidates(
  candidates: OutfitCandidate[],
  itemMap: Map<string, FitItem>,
  ctx: EngineContext,
): ScoredOutfit[] {
  const userAttributes = computeUserAttributes(ctx.styleProfile.selectedStyles);
  const userStyleSet = new Set(ctx.styleProfile.selectedStyles);

  // Use intent-driven weights when available, otherwise defaults
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
    const fitItems = slotsToIds(c.slots)
      .map(id => itemMap.get(id))
      .filter((i): i is FitItem => i !== undefined);

    // Phase 1: hard constraint rejection
    if (!passesHardConstraints(fitItems, ctx)) continue;

    // Phase 2: soft scoring
    const styleCoherence = userAttributes
      ? scoreStyleCoherence(fitItems, userAttributes, ctx.styleProfile.selectedStyles)
      : 0.5;

    const colorHarmony          = scoreColorHarmony(fitItems, ctx.colorPreferences);
    const fitScore              = scoreOutfitFit(fitItems, ctx.bodyMeasurements);
    const proportionBalance     = scoreProportionBalance(fitItems);
    const formalityConsistency  = scoreFormalityConsistency(fitItems);
    const seasonMatch           = scoreSeasonMatch(fitItems);
    const textureInterest       = scoreTextureHarmony(fitItems);
    const anchorClarity         = scoreAnchorClarity(fitItems);

    const totalScore =
      wStyle      * styleCoherence +
      wColor      * colorHarmony +
      wFit        * fitScore +
      wProportion * proportionBalance +
      wFormality  * formalityConsistency +
      wSeason     * seasonMatch +
      wTexture    * textureInterest +
      0.05        * anchorClarity;

    const tier = classifyTier(c.slots, itemMap, userStyleSet);

    scored.push({
      slots: c.slots,
      formula: c.formula ?? 'one_two_three',
      tier,
      styleCoherence,
      colorHarmony,
      fitScore,
      proportionBalance,
      formalityConsistency,
      seasonMatch,
      textureInterest,
      totalScore,
    });
  }

  // Sort: tier 1 first, then by totalScore within each tier
  scored.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return b.totalScore - a.totalScore;
  });

  // Diversification: penalize outfits that share items with already-selected outfits.
  // This ensures the feed shows genuine variety, not 5 outfits with the same pants.
  const selected: ScoredOutfit[] = [];
  const selectedItemSets: Set<string>[] = [];

  for (const outfit of scored) {
    // Exact duplicate rejection (same top + bottom + shoes)
    if (selected.some(d => isDuplicate(d.slots, outfit.slots))) continue;

    // Graded overlap penalty: how many items does this outfit share with
    // already-selected outfits? More overlap = more penalty.
    const outfitIds = new Set(slotsToIds(outfit.slots));
    let maxOverlap = 0;
    for (const prevSet of selectedItemSets) {
      let overlap = 0;
      for (const id of outfitIds) {
        if (prevSet.has(id)) overlap++;
      }
      maxOverlap = Math.max(maxOverlap, overlap);
    }

    // Apply diversity penalty: sharing 2+ items with a selected outfit
    // gets penalized but not eliminated (unlike exact dedup).
    if (maxOverlap >= 2) {
      const penalty = 0.05 * (maxOverlap - 1);
      outfit.totalScore = Math.max(0, outfit.totalScore - penalty);
    }

    selected.push(outfit);
    selectedItemSets.push(outfitIds);

    if (selected.length >= TOP_N) break;
  }

  // Re-sort after diversity penalty (within tiers)
  selected.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return b.totalScore - a.totalScore;
  });

  return selected;
}
