// Deno tests for rankCandidates' final ordering (010-wardrobe-critic
// follow-up, 2026-08-11 — OWNER-APPROVED).
//
// Coverage that was previously MISSING (established by investigation): no
// test anywhere asserted the array rankCandidates returns is actually sorted
// by the totalScore attached to each entry. Before this change, the greedy
// diversification loop in ranking.ts pushed outfits in PRE-penalty walk
// order and never re-sorted, so an outfit that took a bigger overlap penalty
// could sit ABOVE one that took a smaller (or no) penalty despite having a
// lower final score — e.g. an outfit displaying 0.789 ranked above one
// displaying 0.823, verified against the live engine on both the resort and
// (untouched-control) streetwear eval-feed profiles. rankCandidates now
// re-sorts by (tier, totalScore desc) after the penalty is applied, with a
// deterministic tie-break. These tests pin that behaviour down.
//
// Run: deno test supabase/functions/generate-outfits/engine/

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { rankCandidates } from './ranking.ts';
import { FitItem, ItemCategory, EngineContext, OutfitCandidate } from './types.ts';

// Attribute-uniform item builder: every item built with the same `opts` is
// scoring-IDENTICAL to every other one (colorHarmony/styleCoherence/fitScore/
// proportionBalance/formalityConsistency/seasonMatch/textureInterest/
// anchorClarity/taste all read attribute VALUES, never `.id`) — only the id
// differs, so two outfits assembled from attribute-identical templates score
// EXACTLY the same before any diversity penalty. That lets the tests below
// force a real score tie deterministically, instead of hoping hand-picked
// numbers land close enough.
function fi(id: string, category: ItemCategory, typeName: string): FitItem {
  return {
    id,
    category,
    typeName,
    colorProfile: {
      primaryColor: 'navy',
      colorLightness: 'dark',
      colorSaturation: 'muted',
      sat: 20,
      lum: 40,
      undertone: 'cool',
    },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: {
      pattern: 'solid',
      fabricWeight: 'medium',
      breathability: 'medium',
      season: 'allSeason',
      layerRole: 'base',
    },
    styleTags: [],
    fit: 'regular',
    warmth: 2,
    formality: 2.5,
    statementStrength: 1.0,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

function baseCtx(selectedStyles: string[] = [], colorPreferences: string[] = []): EngineContext {
  return {
    bodyMeasurements: {},
    styleProfile: { selectedStyles },
    colorPreferences,
  };
}

// Sorted-id signature — the same key rankCandidates' own tie-break uses —
// so tests can identify "which outfit is which" in the output without
// depending on object identity.
function sig(o: { slots: { top: string; bottom: string; shoes: string; outwear?: string; accessory?: string } }): string {
  return [o.slots.top, o.slots.bottom, o.slots.shoes, o.slots.outwear, o.slots.accessory]
    .filter((x): x is string => x !== undefined)
    .sort()
    .join('|');
}

Deno.test('rankCandidates: unequal overlap penalties — final order follows post-penalty totalScore, not pre-penalty walk order', () => {
  const itemMap = new Map<string, FitItem>([
    ['top-1', fi('top-1', 'top', 'TEE')],
    ['bottom-1', fi('bottom-1', 'bottom', 'JEANS')],
    ['bottom-2', fi('bottom-2', 'bottom', 'JEANS')],
    ['shoes-1', fi('shoes-1', 'shoes', 'SNEAKERS')],
    ['shoes-2', fi('shoes-2', 'shoes', 'SNEAKERS')],
    ['acc-1', fi('acc-1', 'accessory', 'BAG')],
    ['acc-2', fi('acc-2', 'accessory', 'BAG')],
  ]);

  // Anchor: whichever of these three is walked first (all three tie exactly
  // pre-penalty, per the fi() contract above) takes zero penalty and anchors
  // the other two's overlap counts.
  const anchor: OutfitCandidate = {
    slots: { top: 'top-1', bottom: 'bottom-1', shoes: 'shoes-1', accessory: 'acc-1' },
    formula: 'one_two_three',
  };
  // Shares top/bottom/accessory with the anchor (3 ids) -> maxOverlap=3 ->
  // penalty 0.05*(3-1) = 0.10.
  const highOverlap: OutfitCandidate = {
    slots: { top: 'top-1', bottom: 'bottom-1', shoes: 'shoes-2', accessory: 'acc-1' },
    formula: 'neutral_pop',
  };
  // Shares only top/shoes with the anchor (2 ids) -> maxOverlap=2 -> penalty
  // 0.05*(2-1) = 0.05 — HALF of highOverlap's penalty, despite an IDENTICAL
  // pre-penalty score.
  const lowOverlap: OutfitCandidate = {
    slots: { top: 'top-1', bottom: 'bottom-2', shoes: 'shoes-1', accessory: 'acc-2' },
    formula: 'texture_stack',
  };

  const result = rankCandidates([anchor, highOverlap, lowOverlap], itemMap, baseCtx());

  assertEquals(result.length, 3, 'all three outfits should pass hard constraints and be selected');

  const bySig = new Map(result.map(o => [sig(o), o]));
  const highOut = bySig.get(sig(highOverlap))!;
  const lowOut = bySig.get(sig(lowOverlap))!;
  assert(highOut && lowOut, 'both highOverlap and lowOverlap must be present in the result');

  // The core regression: lowOverlap (smaller penalty) must score strictly
  // higher than highOverlap (bigger penalty) despite an identical starting
  // point, and — this is the actual bug that was found — must be RANKED
  // (positioned) ahead of it too, not just scored higher with the old
  // position preserved.
  assert(lowOut.totalScore > highOut.totalScore,
    `lowOverlap (${lowOut.totalScore}) should score higher than highOverlap (${highOut.totalScore}) — smaller penalty`);
  const lowIdx = result.indexOf(lowOut);
  const highIdx = result.indexOf(highOut);
  assert(lowIdx < highIdx,
    `lowOverlap (score ${lowOut.totalScore}, index ${lowIdx}) must be positioned before highOverlap (score ${highOut.totalScore}, index ${highIdx})`);

  // General invariant the fix establishes: within a tier, the returned array
  // is non-increasing in totalScore. (All three outfits share tier 1 here —
  // ctx has no selectedStyles, and classifyTier defaults everyone to tier 1
  // in that case — so this reduces to a single global check.)
  for (let i = 1; i < result.length; i++) {
    if (result[i - 1].tier === result[i].tier) {
      assert(result[i - 1].totalScore >= result[i].totalScore,
        `result[${i - 1}] (tier ${result[i - 1].tier}, score ${result[i - 1].totalScore}) must be >= result[${i}] (tier ${result[i].tier}, score ${result[i].totalScore})`);
    }
  }
});

Deno.test('rankCandidates: tier stays the primary sort key even after the post-penalty re-sort', () => {
  // tier-1 outfit: matches the user's selected style (so classifyTier keeps
  // it tier 1), but deliberately built to score POORLY otherwise — clashing
  // colors (orange/purple/green: poor hue relationships, no palette-preference
  // match) and a formality gap right at the hard-constraint ceiling (2.5,
  // still passes but scores badly per scoreFormalityConsistency).
  const tier1Top = fi('t1-top', 'top', 'TEE');
  tier1Top.styleTags = ['streetwear'];
  tier1Top.colorProfile = { ...tier1Top.colorProfile, primaryColor: 'orange' };
  tier1Top.formality = 1.0;
  const tier1Bottom = fi('t1-bottom', 'bottom', 'JEANS');
  tier1Bottom.styleTags = ['streetwear'];
  tier1Bottom.colorProfile = { ...tier1Bottom.colorProfile, primaryColor: 'purple' };
  tier1Bottom.formality = 3.5; // gap vs top = 2.5, right at the hard-constraint ceiling
  const tier1Shoes = fi('t1-shoes', 'shoes', 'SNEAKERS');
  tier1Shoes.colorProfile = { ...tier1Shoes.colorProfile, primaryColor: 'green' };
  tier1Shoes.formality = 2.5;

  // tier-2 outfit: does NOT match the user's selected style (classifyTier
  // demotes it), but built to score much HIGHER on raw merit — a single
  // consistent color that also matches the user's stated colorPreferences
  // (maximal paletteAlignment), zero formality gap, a strong hero
  // statementStrength (anchorClarity boost), and the largest classic-triple
  // bonus in taste-data.ts (SHIRT+TROUSERS+LOAFERS, 0.08). If tier were NOT
  // kept as the primary sort key, this outfit would rank first.
  const tier2Top = fi('t2-top', 'top', 'SHIRT');
  tier2Top.colorProfile = { ...tier2Top.colorProfile, primaryColor: 'burgundy' };
  tier2Top.statementStrength = 2.0;
  const tier2Bottom = fi('t2-bottom', 'bottom', 'TROUSERS');
  tier2Bottom.colorProfile = { ...tier2Bottom.colorProfile, primaryColor: 'burgundy' };
  const tier2Shoes = fi('t2-shoes', 'shoes', 'LOAFERS');
  tier2Shoes.colorProfile = { ...tier2Shoes.colorProfile, primaryColor: 'burgundy' };

  const itemMap = new Map<string, FitItem>([
    ['t1-top', tier1Top], ['t1-bottom', tier1Bottom], ['t1-shoes', tier1Shoes],
    ['t2-top', tier2Top], ['t2-bottom', tier2Bottom], ['t2-shoes', tier2Shoes],
  ]);

  const tier1Candidate: OutfitCandidate = { slots: { top: 't1-top', bottom: 't1-bottom', shoes: 't1-shoes' }, formula: 'one_two_three' };
  const tier2Candidate: OutfitCandidate = { slots: { top: 't2-top', bottom: 't2-bottom', shoes: 't2-shoes' }, formula: 'one_two_three' };

  const result = rankCandidates([tier1Candidate, tier2Candidate], itemMap, baseCtx(['streetwear'], ['burgundy']));
  assertEquals(result.length, 2);

  const tier1Out = result.find(o => sig(o) === sig(tier1Candidate))!;
  const tier2Out = result.find(o => sig(o) === sig(tier2Candidate))!;
  assertEquals(tier1Out.tier, 1);
  assertEquals(tier2Out.tier, 2);
  // Sanity: the tier-2 outfit really does out-SCORE the tier-1 one on raw
  // totalScore (otherwise this test wouldn't be exercising tier-over-score
  // precedence at all).
  assert(tier2Out.totalScore > tier1Out.totalScore,
    `test setup invariant broken: tier2 (${tier2Out.totalScore}) should outscore tier1 (${tier1Out.totalScore})`);
  // But tier 1 must still lead the feed.
  assert(result.indexOf(tier1Out) < result.indexOf(tier2Out),
    'tier 1 must be positioned before tier 2 regardless of totalScore');
});

Deno.test('rankCandidates: deterministic — identical input yields identical order across repeated calls', () => {
  const itemMap = new Map<string, FitItem>([
    ['top-1', fi('top-1', 'top', 'TEE')],
    ['top-2', fi('top-2', 'top', 'TEE')],
    ['bottom-1', fi('bottom-1', 'bottom', 'JEANS')],
    ['bottom-2', fi('bottom-2', 'bottom', 'JEANS')],
    ['shoes-1', fi('shoes-1', 'shoes', 'SNEAKERS')],
    ['shoes-2', fi('shoes-2', 'shoes', 'SNEAKERS')],
    ['acc-1', fi('acc-1', 'accessory', 'BAG')],
    ['acc-2', fi('acc-2', 'accessory', 'BAG')],
  ]);

  // A handful of overlapping candidates — deliberately including several
  // exact score ties (all built from attribute-identical templates) so the
  // tie-break path is actually exercised, not just the score-difference path.
  const candidates: OutfitCandidate[] = [
    { slots: { top: 'top-1', bottom: 'bottom-1', shoes: 'shoes-1', accessory: 'acc-1' }, formula: 'one_two_three' },
    { slots: { top: 'top-1', bottom: 'bottom-1', shoes: 'shoes-2', accessory: 'acc-1' }, formula: 'neutral_pop' },
    { slots: { top: 'top-1', bottom: 'bottom-2', shoes: 'shoes-1', accessory: 'acc-2' }, formula: 'texture_stack' },
    { slots: { top: 'top-2', bottom: 'bottom-1', shoes: 'shoes-1', accessory: 'acc-2' }, formula: 'monochrome' },
    { slots: { top: 'top-2', bottom: 'bottom-2', shoes: 'shoes-2', accessory: 'acc-1' }, formula: 'rule_of_thirds' },
  ];

  const run = () => rankCandidates(candidates, itemMap, baseCtx()).map(o => `${sig(o)}::${o.totalScore.toFixed(6)}`);

  const first = run();
  const second = run();
  const third = run();

  assertEquals(first, second, 'first and second run must return identical order');
  assertEquals(second, third, 'second and third run must return identical order');
});
