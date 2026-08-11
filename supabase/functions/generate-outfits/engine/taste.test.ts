// Deno test suite for the behaviour-learned taste vector (lever L2).
// Run: deno test supabase/functions/generate-outfits/engine/
//
// Guarantees:
//   - no usable positive history → undefined vector → ranking unaffected
//   - the vector reflects the character of liked outfits (formality / loudness)
//   - on-taste candidates earn a larger bonus than off-taste ones
//   - the bonus is bounded [0, MAX] and confidence-scales with sample count
//   - worn outfits weigh more than merely-saved ones

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildTasteVector, tasteAffinityDelta, PositiveOutfit } from './taste.ts';
import { FitItem, ItemCategory } from './types.ts';

// Minimal FitItem fixture — only the fields taste reads matter.
function fi(
  id: string,
  category: ItemCategory,
  opts: { formality?: number; statement?: number; lum?: number; primaryColor?: string } = {},
): FitItem {
  return {
    id,
    category,
    typeName: 'TEE',
    colorProfile: {
      primaryColor: (opts.primaryColor ?? 'navy') as FitItem['colorProfile']['primaryColor'],
      colorLightness: 'dark',
      colorSaturation: 'muted',
      sat: 20,
      lum: opts.lum ?? 40,
      undertone: 'cool',
    },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: { pattern: 'solid', fabricWeight: 'medium', breathability: 'medium', season: 'allSeason', layerRole: 'base' },
    styleTags: [],
    fit: 'regular',
    formality: opts.formality ?? 3,
    statementStrength: opts.statement ?? 0.5,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

// A wardrobe of formal, quiet, navy pieces + one casual loud red piece.
function wardrobe(): Map<string, FitItem> {
  const items = [
    fi('top-formal',  'top',    { formality: 4.0, statement: 0.4, lum: 45, primaryColor: 'navy' }),
    fi('bot-formal',  'bottom', { formality: 4.0, statement: 0.3, lum: 40, primaryColor: 'navy' }),
    fi('shoe-formal', 'shoes',  { formality: 4.0, statement: 0.3, lum: 30, primaryColor: 'black' }),
    fi('top-casual',  'top',    { formality: 1.5, statement: 3.0, lum: 70, primaryColor: 'red' }),
    fi('bot-casual',  'bottom', { formality: 1.5, statement: 0.5, lum: 20, primaryColor: 'blue' }),
    fi('shoe-casual', 'shoes',  { formality: 1.5, statement: 1.0, lum: 90, primaryColor: 'white' }),
  ];
  return new Map(items.map(i => [i.id, i]));
}

const FORMAL_OUTFIT = ['top-formal', 'bot-formal', 'shoe-formal'];
const CASUAL_OUTFIT = ['top-casual', 'bot-casual', 'shoe-casual'];

// ─── buildTasteVector ───────────────────────────────────────────────────────

Deno.test('no positives → undefined (ranking unaffected)', () => {
  assertEquals(buildTasteVector([], wardrobe()), undefined);
});

Deno.test('all item ids unresolvable → undefined', () => {
  const positives: PositiveOutfit[] = [{ itemIds: ['ghost1', 'ghost2'], weight: 1 }];
  assertEquals(buildTasteVector(positives, wardrobe()), undefined);
});

Deno.test('vector reflects the character of liked outfits (formal + quiet)', () => {
  const map = wardrobe();
  const tv = buildTasteVector([{ itemIds: FORMAL_OUTFIT, weight: 1 }], map)!;
  assert(tv !== undefined);
  assertEquals(tv.sampleCount, 1);
  assert(tv.meanFormality >= 3.5, `expected high formality, got ${tv.meanFormality}`);
  assert(tv.meanStatement <= 1.0, `expected low statement, got ${tv.meanStatement}`);
  assert((tv.colorWeight['navy'] ?? 0) > 0, 'navy should be a liked colour');
});

Deno.test('worn weighs more than saved', () => {
  const map = wardrobe();
  // one casual SAVED (w1) vs same casual WORN (w2) mixed with a formal saved:
  // worn should pull the mean toward the worn outfit's character more strongly.
  const savedHeavy = buildTasteVector(
    [{ itemIds: FORMAL_OUTFIT, weight: 1 }, { itemIds: CASUAL_OUTFIT, weight: 1 }], map,
  )!;
  const wornHeavy = buildTasteVector(
    [{ itemIds: FORMAL_OUTFIT, weight: 1 }, { itemIds: CASUAL_OUTFIT, weight: 2 }], map,
  )!;
  // casual is lower formality → weighting it more drags the mean DOWN
  assert(wornHeavy.meanFormality < savedHeavy.meanFormality,
    `worn-weighted casual should lower mean formality (${wornHeavy.meanFormality} < ${savedHeavy.meanFormality})`);
});

// ─── tasteAffinityDelta ─────────────────────────────────────────────────────

Deno.test('on-taste candidate earns a larger bonus than off-taste', () => {
  const map = wardrobe();
  const tv = buildTasteVector([{ itemIds: FORMAL_OUTFIT, weight: 2 }], map)!;
  // Use a high sample count so confidence is non-trivial.
  const tvConfident = { ...tv, sampleCount: 8 };

  const formalItems = FORMAL_OUTFIT.map(id => map.get(id)!);
  const casualItems = CASUAL_OUTFIT.map(id => map.get(id)!);

  const onTaste  = tasteAffinityDelta(formalItems, tvConfident);
  const offTaste = tasteAffinityDelta(casualItems, tvConfident);
  assert(onTaste > offTaste, `on-taste (${onTaste}) should beat off-taste (${offTaste})`);
  assert(onTaste > 0, 'a strongly on-taste outfit should earn a positive bonus');
});

Deno.test('bonus is bounded [0, 0.06] and never negative', () => {
  const map = wardrobe();
  const tv = { ...buildTasteVector([{ itemIds: FORMAL_OUTFIT, weight: 2 }], map)!, sampleCount: 100 };
  for (const ids of [FORMAL_OUTFIT, CASUAL_OUTFIT]) {
    const d = tasteAffinityDelta(ids.map(id => map.get(id)!), tv);
    assert(d >= 0 && d <= 0.06 + 1e-9, `delta out of bounds: ${d}`);
  }
});

Deno.test('bonus confidence-scales with sample count (1 < 8)', () => {
  const map = wardrobe();
  const base = buildTasteVector([{ itemIds: FORMAL_OUTFIT, weight: 1 }], map)!;
  const formalItems = FORMAL_OUTFIT.map(id => map.get(id)!);

  const d1 = tasteAffinityDelta(formalItems, { ...base, sampleCount: 1 });
  const d8 = tasteAffinityDelta(formalItems, { ...base, sampleCount: 8 });
  assert(d8 > d1, `more samples → bigger bonus (${d8} > ${d1})`);
});
