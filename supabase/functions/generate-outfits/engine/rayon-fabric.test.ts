// Deno test for the rayon vocabulary expansion (010-wardrobe-critic follow-up,
// 2026-08-12 — see plan.md "Demo woman account" phase 2 and backlog.md §AF).
// `FABRIC_DEFAULTS` in enrichment.ts previously had no 'Rayon' entry, so any
// item with material='rayon' silently fell back to the generic
// fabricWeight='medium'/breathability='medium' default instead of the
// light/breathable profile rayon actually has (same bucket as linen/silk).
// This proves toFitItem now reads the real profile, not the default.
// Run: deno test supabase/functions/generate-outfits/engine/

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { toFitItem } from './enrichment.ts';
import { ClothingItemRow } from './types.ts';

Deno.test('toFitItem: material="rayon" resolves fabricWeight=light, breathability=high (not the medium/medium default)', () => {
  const item: ClothingItemRow = {
    id: 'test-rayon-blouse',
    type: 'BLOUSE',
    name: 'Rayon Blouse',
    color: 'White',
    material: 'rayon', // DB stores material lowercase; primaryMaterial() Title-Cases it for the lookup
  };

  const fitItem = toFitItem(item);

  assertEquals(fitItem.fabric.fabricWeight, 'light');
  assertEquals(fitItem.fabric.breathability, 'high');
  // Sanity: a genuinely-unknown material still hits the medium/medium
  // default, so this isn't just the default agreeing with rayon by accident.
  const unknownMaterialItem: ClothingItemRow = { ...item, id: 'test-unknown-fabric', material: 'unobtainium' };
  const unknownFitItem = toFitItem(unknownMaterialItem);
  assertEquals(unknownFitItem.fabric.fabricWeight, 'medium');
  assertEquals(unknownFitItem.fabric.breathability, 'medium');
});
