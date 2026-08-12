// Deno test for the SLIDES garment-type gap (010-wardrobe-critic follow-up,
// 2026-08-13 — see backlog.md "TYPE_OPTIONS offers 10 garment types the DB
// will reject" / "7 of those 8 DB-only types are silently misclassified").
// `garment_types` has a live SLIDES row (category='shoes', base_formality=1.0,
// style_affinities=['athleisure','streetwear']) that the engine's CATEGORY_MAP
// never learned about, so `categoryOf('SLIDES')` fell through to `?? 'accessory'`.
// Live consequence: a SLIDES item filled the accessory slot of an outfit that
// already had BOOTS in the shoes slot (two pairs of footwear), and rendered at
// clothing size in the collage instead of the small accessory row.
// This proves categoryOf/toFitItem now resolve SLIDES as shoes, not the
// accessory fallback.
// Run: deno test supabase/functions/generate-outfits/engine/

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { categoryOf, toFitItem } from './enrichment.ts';
import { ClothingItemRow } from './types.ts';

Deno.test('categoryOf: SLIDES resolves to shoes, not the accessory fallback', () => {
  assertEquals(categoryOf('SLIDES'), 'shoes');
  // Control: a genuinely-unknown type still hits the accessory fallback, so
  // the assertion above is proving the CATEGORY_MAP entry, not the fallback.
  assertEquals(categoryOf('NOTAREALTYPE'), 'accessory');
});

Deno.test('toFitItem: type="SLIDES" resolves shoes/1.0 formality/athleisure+streetwear affinities', () => {
  const item: ClothingItemRow = {
    id: 'test-woven-slides',
    type: 'SLIDES',
    name: 'Woven Open-Toe Slides',
    color: 'Black',
    material: 'nylon',
  };

  const fitItem = toFitItem(item);

  assertEquals(fitItem.category, 'shoes');
  assertEquals(fitItem.formality, 1.0);
  assertEquals(fitItem.styleTags.includes('athleisure'), true);
  assertEquals(fitItem.styleTags.includes('streetwear'), true);
});
