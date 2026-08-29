// Deno test for the 7 remaining DB-only garment types (010-wardrobe-critic
// follow-up, 2026-08-21 — see backlog.md "6 of the remaining 7 DB-only types
// are silently misclassified as `accessory`"). `garment_types` carries 8
// type_keys CATEGORY_MAP never learned; SLIDES was closed 2026-08-13
// (slides-category.test.ts). This closes the other 7: TANK, CARGO, JOGGERS,
// DERBY, GILET, WINDBREAKER, SOCKS. Each was falling through
// `categoryOf`'s `?? 'accessory'` fallback — wrong slot, wrong layer role,
// wrong scoring. SOCKS already landed on 'accessory' via that fallback; it's
// asserted here too now that it's an explicit CATEGORY_MAP entry, not an
// accident of the fallback.
// Run: deno test supabase/functions/generate-outfits/engine/

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { categoryOf } from './enrichment.ts';

Deno.test('categoryOf: the 7 DB-only types resolve to their real category, not the accessory fallback', () => {
  assertEquals(categoryOf('TANK'), 'top');
  assertEquals(categoryOf('CARGO'), 'bottom');
  assertEquals(categoryOf('JOGGERS'), 'bottom');
  assertEquals(categoryOf('DERBY'), 'shoes');
  assertEquals(categoryOf('GILET'), 'outwear');
  assertEquals(categoryOf('WINDBREAKER'), 'outwear');
  assertEquals(categoryOf('SOCKS'), 'accessory');
  // Control: a genuinely-unknown type still hits the accessory fallback, so
  // the assertions above are proving real CATEGORY_MAP entries, not the
  // fallback (SOCKS included — it now has an explicit entry).
  assertEquals(categoryOf('NOTAREALTYPE'), 'accessory');
});

Deno.test('categoryOf: lowercase input resolves the same — categoryOf upper-cases internally', () => {
  assertEquals(categoryOf('tank'), 'top');
  assertEquals(categoryOf('cargo'), 'bottom');
  assertEquals(categoryOf('joggers'), 'bottom');
  assertEquals(categoryOf('derby'), 'shoes');
  assertEquals(categoryOf('gilet'), 'outwear');
  assertEquals(categoryOf('windbreaker'), 'outwear');
  assertEquals(categoryOf('socks'), 'accessory');
});
