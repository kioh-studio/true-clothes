// Deno tests for deriveProportionNotes (backlog AL). Display-only module.
// Run: deno test supabase/functions/generate-outfits/engine/

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { deriveProportionNotes } from './proportion-notes.ts';
import { FitItem, ItemCategory } from './types.ts';

function fi(
  id: string,
  category: ItemCategory,
  opts: { fit?: FitItem['fit']; color?: string; typeName?: string; drape?: FitItem['drape'] } = {},
): FitItem {
  return {
    id,
    category,
    typeName: opts.typeName ?? 'TEE',
    colorProfile: {
      primaryColor: (opts.color ?? 'gray') as FitItem['colorProfile']['primaryColor'],
      colorLightness: 'medium', colorSaturation: 'muted', sat: 20, lum: 50, undertone: 'neutral',
    },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: { pattern: 'solid', fabricWeight: 'medium', breathability: 'medium', season: 'allSeason', layerRole: 'base' },
    styleTags: [],
    fit: opts.fit ?? 'relaxed', // relaxed/relaxed: no fitted/wide volume rule, no waist rule
    formality: 2.5,
    statementStrength: 0.5,
    drape: opts.drape,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

const keys = (items: FitItem[], slots?: { top?: string; outwear?: string }) =>
  deriveProportionNotes(items, slots).map(n => n.key);

Deno.test('column fires for same-tone top + bottom, not for different tones', () => {
  assertEquals(keys([fi('t', 'top', { color: 'black' }), fi('b', 'bottom', { color: 'black' })]), ['column']);
  assertEquals(keys([fi('t', 'top', { color: 'black' }), fi('b', 'bottom', { color: 'blue' })]), []);
});

Deno.test('leg_line fires for same-tone bottom + shoes; column suppresses it', () => {
  assertEquals(keys([fi('t', 'top', { color: 'white' }), fi('b', 'bottom', { color: 'black' }), fi('s', 'shoes', { color: 'black' })]), ['leg_line']);
  assertEquals(keys([fi('t', 'top', { color: 'white' }), fi('b', 'bottom', { color: 'black' }), fi('s', 'shoes', { color: 'brown' })]), []);
  assertEquals(
    keys([fi('t', 'top', { color: 'black' }), fi('b', 'bottom', { color: 'black' }), fi('s', 'shoes', { color: 'black' })]),
    ['column'],
  );
});

Deno.test('open_layer fires when the outwear-slot item differs in colour from the inner top', () => {
  const base = [fi('t', 'top', { color: 'white' }), fi('b', 'bottom', { color: 'blue' })];
  assertEquals(keys([...base, fi('o', 'outwear', { color: 'black' })], { top: 't', outwear: 'o' }), ['open_layer']);
  assertEquals(keys([...base, fi('o', 'outwear', { color: 'white' })], { top: 't', outwear: 'o' }), []);
});

Deno.test('waist fires with a belt, not without', () => {
  const base = [fi('t', 'top', { color: 'white' }), fi('b', 'bottom', { color: 'blue' })];
  assertEquals(keys([...base, fi('belt', 'accessory', { typeName: 'BELT', color: 'brown' })]), ['waist']);
  assertEquals(keys(base), []);
});

Deno.test('fitted_top_wide_leg fires at top<=2 & bottom>=4 only', () => {
  assertEquals(keys([fi('t', 'top', { fit: 'slim', color: 'white' }), fi('b', 'bottom', { fit: 'wide', color: 'blue' })]), ['fitted_top_wide_leg']);
  assertEquals(keys([fi('t', 'top', { fit: 'relaxed', color: 'white' }), fi('b', 'bottom', { fit: 'wide', color: 'blue' })]), []);
});

Deno.test('wide_top_slim_leg fires at top>=4 & bottom<=2 only', () => {
  assertEquals(keys([fi('t', 'top', { fit: 'oversized', color: 'white' }), fi('b', 'bottom', { fit: 'slim', color: 'blue' })]), ['wide_top_slim_leg']);
  assertEquals(keys([fi('t', 'top', { fit: 'oversized', color: 'white' }), fi('b', 'bottom', { fit: 'relaxed', color: 'blue' })]), []);
});

Deno.test('structured_shoulder fires for a structured outwear item only', () => {
  const base = [fi('t', 'top', { color: 'white' }), fi('b', 'bottom', { color: 'blue' })];
  const out = (drape: FitItem['drape']) => fi('o', 'outwear', { color: 'white', drape, typeName: 'COAT' });
  assertEquals(keys([...base, out('structured')], { outwear: 'o' }), ['structured_shoulder']);
  assertEquals(keys([...base, out('fluid')], { outwear: 'o' }), []);
});

Deno.test('capped at 2 notes, in priority order, and deterministic', () => {
  const items = [
    fi('t', 'top', { color: 'black', fit: 'slim' }),
    fi('b', 'bottom', { color: 'black', fit: 'wide' }),
    fi('belt', 'accessory', { typeName: 'BELT' }),
  ];
  const a = deriveProportionNotes(items);
  assertEquals(a.map(n => n.key), ['column', 'waist']); // fitted_top_wide_leg also matches, cut by the cap
  assertEquals(a, deriveProportionNotes(items));
  assert(a.every(n => n.en && n.vi));
});

Deno.test('empty / partial outfits do not throw', () => {
  assertEquals(keys([]), []);
  assertEquals(keys([fi('s', 'shoes')]), []);
});
