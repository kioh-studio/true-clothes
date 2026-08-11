// Deno tests for the 2026-07-02 engine-contradiction fixes:
//   (a) high_low candidates get formality-gap headroom (3.5 vs 2.5) and their
//       formalityConsistency treats a healthy gap as the POINT, not a flaw
//   (b) softened register vetoes (hoodie/parka+trousers, loafers+shorts)
//   (c) pattern-on-pattern allowed (max 2) for pattern-friendly styles only,
//       with a mild taste multiplier instead of a hard ban
// Run: deno test supabase/functions/generate-outfits/engine/

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { scoreFormalityConsistency, scoreTasteAdjustment } from './scoring.ts';
import { rankCandidates } from './ranking.ts';
import { FitItem, ItemCategory, EngineContext, OutfitCandidate, Pattern } from './types.ts';

function fi(
  id: string,
  category: ItemCategory,
  opts: {
    formality?: number; typeName?: string; pattern?: Pattern;
    primaryColor?: string; statement?: number;
  } = {},
): FitItem {
  return {
    id,
    category,
    typeName: opts.typeName ?? 'TEE',
    colorProfile: {
      primaryColor: (opts.primaryColor ?? 'navy') as FitItem['colorProfile']['primaryColor'],
      colorLightness: 'dark',
      colorSaturation: 'muted',
      sat: 20,
      lum: 40,
      undertone: 'cool',
    },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: {
      pattern: opts.pattern ?? 'solid',
      fabricWeight: 'medium',
      breathability: 'medium',
      season: 'allSeason',
      layerRole: 'base',
    },
    styleTags: [],
    fit: 'regular',
    formality: opts.formality ?? 2.5,
    statementStrength: opts.statement ?? 0.5,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

function ctxWith(styles: string[]): EngineContext {
  return {
    bodyMeasurements: {},
    styleProfile: { selectedStyles: styles },
    colorPreferences: [],
  };
}

// ─── (a) high_low formality-gap headroom ─────────────────────────────────────

Deno.test('high_low candidate with gap 3.0 survives; same combo without the formula is rejected', () => {
  const items = [
    fi('top', 'top', { formality: 4.6, typeName: 'SHIRT', primaryColor: 'white' }),
    fi('bot', 'bottom', { formality: 1.6, typeName: 'JEANS', primaryColor: 'blue' }),
    fi('shoe', 'shoes', { formality: 3.0, typeName: 'SNEAKERS', primaryColor: 'white' }),
  ];
  const itemMap = new Map(items.map(i => [i.id, i]));
  const slots = { top: 'top', bottom: 'bot', shoes: 'shoe' };
  const highLow: OutfitCandidate[] = [{ slots, formula: 'high_low' }];
  const plain: OutfitCandidate[] = [{ slots, formula: 'one_two_three' }];

  assertEquals(rankCandidates(highLow, itemMap, ctxWith([])).length, 1);
  assertEquals(rankCandidates(plain, itemMap, ctxWith([])).length, 0);
});

Deno.test('high_low still rejects costume-level gaps (> 3.5)', () => {
  const items = [
    fi('top', 'top', { formality: 5.0, typeName: 'SHIRT' }),
    fi('bot', 'bottom', { formality: 1.0, typeName: 'SHORTS' }),
    fi('shoe', 'shoes', { formality: 3.0, typeName: 'SNEAKERS' }),
  ];
  const itemMap = new Map(items.map(i => [i.id, i]));
  const candidates: OutfitCandidate[] = [
    { slots: { top: 'top', bottom: 'bot', shoes: 'shoe' }, formula: 'high_low' },
  ];
  assertEquals(rankCandidates(candidates, itemMap, ctxWith([])).length, 0);
});

Deno.test('formalityConsistency rewards a deliberate high_low gap, penalises it otherwise', () => {
  const items = [
    fi('a', 'top', { formality: 4.0 }),
    fi('b', 'bottom', { formality: 2.0 }),
  ];
  assertEquals(scoreFormalityConsistency(items, 'high_low'), 1.0);
  assertEquals(scoreFormalityConsistency(items), 0.55);
});

Deno.test('formalityConsistency for high_low: no real gap means the mix did not happen', () => {
  const items = [
    fi('a', 'top', { formality: 3.0 }),
    fi('b', 'bottom', { formality: 2.8 }),
  ];
  assert(scoreFormalityConsistency(items, 'high_low') <= 0.6);
});

// ─── (b) softened register vetoes ────────────────────────────────────────────

Deno.test('hoodie + trousers keeps only a token penalty (0.85, was 0.7)', () => {
  const items = [
    fi('h', 'top', { typeName: 'HOODIE', formality: 1.5 }),
    fi('t', 'bottom', { typeName: 'TROUSERS', formality: 4.0 }),
    fi('s', 'shoes', { typeName: 'SNEAKERS', formality: 1.5 }),
  ];
  const { multiplier } = scoreTasteAdjustment(items);
  assertEquals(multiplier, 0.85);
});

Deno.test('sandals + trousers stays a strong veto', () => {
  const items = [
    fi('t', 'top', { typeName: 'SHIRT', formality: 3.5 }),
    fi('b', 'bottom', { typeName: 'TROUSERS', formality: 4.0 }),
    fi('s', 'shoes', { typeName: 'SANDALS', formality: 1.0 }),
  ];
  const { multiplier } = scoreTasteAdjustment(items);
  assert(multiplier <= 0.5);
});

// ─── (c) pattern-on-pattern by style ─────────────────────────────────────────

function twoPatternCandidate(): { itemMap: Map<string, FitItem>; candidates: OutfitCandidate[] } {
  const items = [
    fi('top', 'top', { typeName: 'SHIRT', pattern: 'striped', primaryColor: 'white', formality: 2.5 }),
    fi('bot', 'bottom', { typeName: 'TROUSERS', pattern: 'plaid', primaryColor: 'gray', formality: 2.5 }),
    fi('shoe', 'shoes', { typeName: 'SNEAKERS', primaryColor: 'black', formality: 2.5 }),
  ];
  return {
    itemMap: new Map(items.map(i => [i.id, i])),
    candidates: [{ slots: { top: 'top', bottom: 'bot', shoes: 'shoe' }, formula: 'one_two_three' }],
  };
}

Deno.test('two bold patterns pass for a streetwear user', () => {
  const { itemMap, candidates } = twoPatternCandidate();
  assertEquals(rankCandidates(candidates, itemMap, ctxWith(['streetwear'])).length, 1);
});

Deno.test('two bold patterns are still rejected for a minimalist user', () => {
  const { itemMap, candidates } = twoPatternCandidate();
  assertEquals(rankCandidates(candidates, itemMap, ctxWith(['minimalist'])).length, 0);
});

Deno.test('pattern-on-pattern carries a mild taste multiplier', () => {
  const items = [
    fi('a', 'top', { pattern: 'striped' }),
    fi('b', 'bottom', { pattern: 'plaid' }),
    fi('c', 'shoes', {}),
  ];
  const { multiplier } = scoreTasteAdjustment(items);
  assertEquals(multiplier, 0.85);
});

Deno.test('pattern-mix and flat-look multipliers never stack (one offence, one penalty)', () => {
  // All-dark-muted AND two bold patterns: patterns ARE the visual interest, so
  // only the pattern-mix multiplier applies (was 0.85 × 0.85 = 0.7225 before
  // the 2026-07-03 fixture finding).
  const darkPatterned = (id: string, cat: Parameters<typeof fi>[1], pattern?: 'striped' | 'plaid') =>
    ({ ...fi(id, cat, { pattern }), colorProfile: { ...fi(id, cat).colorProfile, lum: 20, sat: 10 } });
  const items = [
    darkPatterned('a', 'top', 'striped'),
    darkPatterned('b', 'bottom', 'plaid'),
    darkPatterned('c', 'shoes'),
  ];
  const { multiplier } = scoreTasteAdjustment(items);
  assertEquals(multiplier, 0.85);
});
