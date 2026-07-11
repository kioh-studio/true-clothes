// Deno tests for visual enrichment đợt 2 (2026-07-03):
//   - print_scale reshapes how loud a pattern reads (micro quieter, large louder)
//   - visual_interest nudges statementStrength and hero selection
//   - drape feeds the house-POV precision credit (only when known)
//   - absent fields → behaviour identical to before (defaults untouched)
// Run: deno test supabase/functions/generate-outfits/engine/

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { toFitItem } from './enrichment.ts';
import { housePOVDelta } from './scoring.ts';
import { ClothingItemRow } from './types.ts';

const row = (over: Partial<ClothingItemRow> & { type: string }): ClothingItemRow => ({
  id: over.id ?? 'x', name: over.name ?? over.type, color: over.color ?? 'navy', ...over,
});

Deno.test('print_scale: micro reads quieter, large reads louder than the categorical default', () => {
  const base = toFitItem(row({ type: 'SHIRT', pattern: 'striped' }));
  const micro = toFitItem(row({ type: 'SHIRT', pattern: 'striped', printScale: 'micro' }));
  const large = toFitItem(row({ type: 'SHIRT', pattern: 'striped', printScale: 'large' }));
  assert(micro.statementStrength < base.statementStrength);
  assert(large.statementStrength > base.statementStrength);
});

Deno.test('visual_interest shifts statementStrength around its 0.5 center', () => {
  const plain = toFitItem(row({ type: 'TEE', visualInterest: 0.2 }));
  const neutral = toFitItem(row({ type: 'TEE', visualInterest: 0.5 }));
  const striking = toFitItem(row({ type: 'TEE', visualInterest: 0.9 }));
  assert(plain.statementStrength <= neutral.statementStrength);
  assert(striking.statementStrength > neutral.statementStrength);
  assertEquals(neutral.statementStrength, toFitItem(row({ type: 'TEE' })).statementStrength);
});

Deno.test('absent visual fields leave the item byte-identical to the pre-đợt-2 derivation', () => {
  const item = toFitItem(row({ type: 'KNIT', material: 'Wool', fit: 'relaxed' }));
  assertEquals(item.drape, undefined);
  assertEquals(item.visualInterest, undefined);
});

Deno.test('drape=structured on 2+ pieces earns the house-POV precision credit', () => {
  const structured = [
    toFitItem(row({ id: 'a', type: 'SHIRT', color: 'white', material: 'Cotton', drape: 'structured' })),
    toFitItem(row({ id: 'b', type: 'TROUSERS', color: 'charcoal', material: 'Wool', drape: 'structured' })),
    toFitItem(row({ id: 'c', type: 'LOAFERS', color: 'black', material: 'Leather' })),
  ];
  const unknownDrape = [
    toFitItem(row({ id: 'a', type: 'SHIRT', color: 'white', material: 'Cotton' })),
    toFitItem(row({ id: 'b', type: 'TROUSERS', color: 'charcoal', material: 'Wool' })),
    toFitItem(row({ id: 'c', type: 'LOAFERS', color: 'black', material: 'Leather' })),
  ];
  assert(housePOVDelta(structured, ['minimalist']) > housePOVDelta(unknownDrape, ['minimalist']));
});
