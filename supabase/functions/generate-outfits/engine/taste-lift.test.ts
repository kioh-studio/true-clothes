// Deno tests for the exposure-lift upgrade of the taste vector (2026-07-02).
//
// Guarantees:
//   - fewer than MIN_EXPOSURE_SAMPLES impressions → no exposure baseline →
//     behaviour identical to the original positive-only mode
//   - saves indistinguishable from the shown feed → ~zero bonus everywhere
//     (no self-reinforcing "the feed likes itself" loop)
//   - saves that deviate from the feed → only candidates in the deviation
//     direction earn the bonus
//   - bonus stays within [0, 0.06] in lift mode
// Run: deno test supabase/functions/generate-outfits/engine/

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildTasteVector, tasteAffinityDelta, PositiveOutfit } from './taste.ts';
import { FitItem, ItemCategory } from './types.ts';

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

// Wardrobe: a FORMAL-DARK cluster, a CASUAL-LIGHT cluster, and a MID cluster.
function wardrobe(): Map<string, FitItem> {
  const items = [
    fi('top-f', 'top',    { formality: 4.5, statement: 0.3, lum: 25, primaryColor: 'charcoal' }),
    fi('bot-f', 'bottom', { formality: 4.5, statement: 0.3, lum: 20, primaryColor: 'black' }),
    fi('sho-f', 'shoes',  { formality: 4.5, statement: 0.3, lum: 20, primaryColor: 'black' }),
    fi('top-c', 'top',    { formality: 1.5, statement: 1.5, lum: 85, primaryColor: 'white' }),
    fi('bot-c', 'bottom', { formality: 1.5, statement: 1.0, lum: 80, primaryColor: 'beige' }),
    fi('sho-c', 'shoes',  { formality: 1.5, statement: 1.0, lum: 90, primaryColor: 'white' }),
    fi('top-m', 'top',    { formality: 3.0, statement: 0.7, lum: 55, primaryColor: 'gray' }),
    fi('bot-m', 'bottom', { formality: 3.0, statement: 0.7, lum: 50, primaryColor: 'navy' }),
    fi('sho-m', 'shoes',  { formality: 3.0, statement: 0.7, lum: 50, primaryColor: 'gray' }),
  ];
  return new Map(items.map(i => [i.id, i]));
}

const FORMAL = ['top-f', 'bot-f', 'sho-f'];
const CASUAL = ['top-c', 'bot-c', 'sho-c'];
const MID    = ['top-m', 'bot-m', 'sho-m'];

const saves = (ids: string[], n: number): PositiveOutfit[] =>
  Array.from({ length: n }, () => ({ itemIds: ids, weight: 1 }));
const shown = (ids: string[], n: number): Array<{ itemIds: string[] }> =>
  Array.from({ length: n }, () => ({ itemIds: ids }));

const resolve = (map: Map<string, FitItem>, ids: string[]) =>
  ids.map(id => map.get(id)!).filter(Boolean);

Deno.test('below MIN_EXPOSURE_SAMPLES impressions → no exposure baseline attached', () => {
  const map = wardrobe();
  const tv = buildTasteVector(saves(FORMAL, 8), map, shown(MID, 5))!;
  assertEquals(tv.exposure, undefined);
});

Deno.test('enough impressions → exposure baseline attached with its own sample count', () => {
  const map = wardrobe();
  const tv = buildTasteVector(saves(FORMAL, 8), map, shown(MID, 12))!;
  assert(tv.exposure !== undefined);
  assertEquals(tv.exposure!.sampleCount, 12);
});

Deno.test('saves that mirror the shown feed carry no signal — bonus ≈ 0 for feed-like candidates', () => {
  const map = wardrobe();
  // User was shown MID outfits and saved MID outfits — no differential taste.
  const tv = buildTasteVector(saves(MID, 8), map, shown(MID, 12))!;
  const deltaMid = tasteAffinityDelta(resolve(map, MID), tv);
  assert(deltaMid < 0.005, `expected ~0, got ${deltaMid}`);
});

Deno.test('saves deviating from the feed reward only the deviation direction', () => {
  const map = wardrobe();
  // Feed showed MID; user consistently saved FORMAL-DARK → real preference.
  const tv = buildTasteVector(saves(FORMAL, 8), map, shown(MID, 12))!;
  const deltaFormal = tasteAffinityDelta(resolve(map, FORMAL), tv);
  const deltaCasual = tasteAffinityDelta(resolve(map, CASUAL), tv);
  assert(deltaFormal > deltaCasual, `formal ${deltaFormal} should beat casual ${deltaCasual}`);
  assert(deltaFormal > 0.01, `preference direction should earn a real bonus, got ${deltaFormal}`);
  assert(deltaCasual < 0.005, `anti-direction should earn ~nothing, got ${deltaCasual}`);
});

Deno.test('lift-mode bonus stays within [0, 0.06]', () => {
  const map = wardrobe();
  const tv = buildTasteVector(saves(FORMAL, 20), map, shown(CASUAL, 30))!;
  for (const ids of [FORMAL, CASUAL, MID]) {
    const d = tasteAffinityDelta(resolve(map, ids), tv);
    assert(d >= 0 && d <= 0.06, `delta ${d} out of bounds`);
  }
});

Deno.test('fallback mode (no exposures at all) matches original positive-only behaviour', () => {
  const map = wardrobe();
  const tvNoExp = buildTasteVector(saves(FORMAL, 8), map)!;
  const tvThinExp = buildTasteVector(saves(FORMAL, 8), map, shown(MID, 3))!;
  const a = tasteAffinityDelta(resolve(map, FORMAL), tvNoExp);
  const b = tasteAffinityDelta(resolve(map, FORMAL), tvThinExp);
  assertEquals(a, b);
  assert(a > 0.02, 'on-taste candidate should earn a solid bonus in fallback mode');
});
