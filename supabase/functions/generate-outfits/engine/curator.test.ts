// Deno tests for the curator's sole-torso-layer marker (2026-08-14):
//   - isSoleTorsoLayer flags an outfit whose top (or one-piece) is the only
//     torso garment, so the candidate line handed to the curator LLM carries
//     that fact and its "never advise opening a sole layer" rule has
//     something deterministic to key off.
// This does NOT test the LLM's output (non-deterministic) — only the
// deterministic input construction: isSoleTorsoLayer itself, and index.ts's
// candidate-line builder would embed its result as `sole torso layer` in the
// parenthetical (exercised indirectly here via the same OutfitSlots shapes
// index.ts's `describe` callback receives).
//
// Also covers describeItem (2026-08-14) — the pure candidate-line formatter
// extracted from index.ts so the pattern/print_scale/drape/opacity/
// distressed/warmth_season/visual_interest suppression rules are directly
// testable: each new attribute appears only when it's informative, vanishes
// at its default/null, and size/brand/measurements never appear at all.
// Run: deno test supabase/functions/generate-outfits/engine/

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { isSoleTorsoLayer, describeItem } from './curator.ts';
import { OutfitSlots, ClothingItemRow } from './types.ts';

const slots = (over: Partial<OutfitSlots> = {}): OutfitSlots => ({
  top: 'top-id', bottom: 'bottom-id', shoes: 'shoes-id', ...over,
});

Deno.test('isSoleTorsoLayer: true when top has no outwear and no mid — nothing else is on the torso', () => {
  assertEquals(isSoleTorsoLayer(slots()), true);
});

Deno.test('isSoleTorsoLayer: false once an outwear layer is present', () => {
  assertEquals(isSoleTorsoLayer(slots({ outwear: 'cardigan-id' })), false);
});

Deno.test('isSoleTorsoLayer: false once a mid layer is present (even without a true outer)', () => {
  assertEquals(isSoleTorsoLayer(slots({ mid: 'knit-id' })), false);
});

Deno.test('isSoleTorsoLayer: false when both outwear and mid are present', () => {
  assertEquals(isSoleTorsoLayer(slots({ outwear: 'blazer-id', mid: 'hoodie-id' })), false);
});

Deno.test('isSoleTorsoLayer: true for a one-piece with nothing layered over it (top === bottom, no outwear/mid)', () => {
  // Mirrors index.ts's isOnepiece check (slots.top === slots.bottom) — the
  // one-piece is still the only thing ON the torso in this case.
  assertEquals(isSoleTorsoLayer(slots({ top: 'dress-id', bottom: 'dress-id' })), true);
});

// ─── describeItem ────────────────────────────────────────────────────────

const row = (over: Partial<ClothingItemRow> = {}): ClothingItemRow => ({
  id: 'item-1', type: 'TEE', name: 'Classic Tee', color: 'white', ...over,
});

Deno.test('describeItem: regression — bare name/type/color unchanged when nothing else applies', () => {
  assertEquals(describeItem(row(), 'top'), 'top: Classic Tee (tee, white)');
});

Deno.test('describeItem: regression — type/color/material/fit format unchanged (the pre-existing shape)', () => {
  assertEquals(
    describeItem(row({ material: 'Cotton', fit: 'regular' }), 'top'),
    'top: Classic Tee (tee, white, Cotton, regular fit)',
  );
});

Deno.test('describeItem: pattern omitted when solid', () => {
  assertEquals(describeItem(row({ pattern: 'solid' }), 'top'), 'top: Classic Tee (tee, white)');
});

Deno.test('describeItem: pattern omitted when null', () => {
  assertEquals(describeItem(row({ pattern: null }), 'top'), 'top: Classic Tee (tee, white)');
});

Deno.test('describeItem: pattern printed when non-solid', () => {
  assertStringIncludes(describeItem(row({ pattern: 'floral' }), 'top'), 'floral');
});

Deno.test('describeItem: print_scale rides along only with a real printed pattern', () => {
  assertEquals(
    describeItem(row({ pattern: 'floral', printScale: 'large' }), 'top'),
    'top: Classic Tee (tee, white, large floral)',
  );
});

Deno.test('describeItem: print_scale omitted when pattern is solid (scale is meaningless on a plain garment)', () => {
  const out = describeItem(row({ pattern: 'solid', printScale: 'large' }), 'top');
  assertEquals(out.includes('large'), false);
});

Deno.test('describeItem: drape structured is printed', () => {
  assertStringIncludes(describeItem(row({ drape: 'structured' }), 'top'), 'structured');
});

Deno.test('describeItem: drape fluid is printed', () => {
  assertStringIncludes(describeItem(row({ drape: 'fluid' }), 'top'), 'fluid');
});

Deno.test('describeItem: drape regular is omitted (unremarkable middle)', () => {
  assertEquals(describeItem(row({ drape: 'regular' }), 'top'), 'top: Classic Tee (tee, white)');
});

Deno.test('describeItem: drape null is omitted', () => {
  assertEquals(describeItem(row({ drape: null }), 'top'), 'top: Classic Tee (tee, white)');
});

Deno.test('describeItem: opacity sheer is printed', () => {
  assertStringIncludes(describeItem(row({ opacity: 'sheer' }), 'top'), 'sheer');
});

Deno.test('describeItem: opacity semi is printed', () => {
  assertStringIncludes(describeItem(row({ opacity: 'semi' }), 'top'), 'semi');
});

Deno.test('describeItem: opacity opaque is omitted (default read)', () => {
  assertEquals(describeItem(row({ opacity: 'opaque' }), 'top'), 'top: Classic Tee (tee, white)');
});

Deno.test('describeItem: opacity null is omitted', () => {
  assertEquals(describeItem(row({ opacity: null }), 'top'), 'top: Classic Tee (tee, white)');
});

Deno.test('describeItem: distressed true is printed', () => {
  assertStringIncludes(describeItem(row({ distressed: true }), 'top'), 'distressed');
});

Deno.test('describeItem: distressed false is omitted', () => {
  assertEquals(describeItem(row({ distressed: false }), 'top'), 'top: Classic Tee (tee, white)');
});

Deno.test('describeItem: distressed null/undefined is omitted', () => {
  assertEquals(describeItem(row({ distressed: null }), 'top'), 'top: Classic Tee (tee, white)');
});

Deno.test('describeItem: warmth_season printed as-is when set', () => {
  assertStringIncludes(describeItem(row({ warmthSeason: 'warm_winter' }), 'top'), 'warm_winter');
});

Deno.test('describeItem: warmth_season omitted when null', () => {
  assertEquals(describeItem(row({ warmthSeason: null }), 'top'), 'top: Classic Tee (tee, white)');
});

Deno.test('describeItem: visual_interest renders as "statement" at/above the 0.8 threshold', () => {
  assertStringIncludes(describeItem(row({ visualInterest: 0.8 }), 'top'), 'statement');
  assertStringIncludes(describeItem(row({ visualInterest: 0.95 }), 'top'), 'statement');
});

Deno.test('describeItem: visual_interest vanishes below the threshold', () => {
  assertEquals(describeItem(row({ visualInterest: 0.79 }), 'top'), 'top: Classic Tee (tee, white)');
  assertEquals(describeItem(row({ visualInterest: 0.5 }), 'top'), 'top: Classic Tee (tee, white)');
  assertEquals(describeItem(row({ visualInterest: 0.2 }), 'top'), 'top: Classic Tee (tee, white)');
});

Deno.test('describeItem: visual_interest null/undefined omitted, and the raw number is NEVER printed', () => {
  assertEquals(describeItem(row({ visualInterest: null }), 'top'), 'top: Classic Tee (tee, white)');
  const out = describeItem(row({ visualInterest: 0.87 }), 'top');
  assertEquals(out.includes('0.87'), false);
  assertEquals(out.includes('0.8'), false); // never digits — only the word "statement"
  assertStringIncludes(out, 'statement');
});

Deno.test('describeItem: extra (sole torso layer marker) still appends last, after any new attributes', () => {
  assertEquals(
    describeItem(row({ pattern: 'floral', drape: 'fluid' }), 'top', 'sole torso layer'),
    'top: Classic Tee (tee, white, floral, fluid, sole torso layer)',
  );
});

Deno.test('describeItem: size, brand, and measurements never appear in the output for any input', () => {
  // ClothingItemRow carries no `size`/`brand` fields at all (by type) — this
  // simulates a row shape that DID carry them (e.g. a future DB column added
  // without updating the type) to guard against them ever leaking in.
  const dirty = {
    ...row({ material: 'Wool', fit: 'slim' }),
    size: 'M',
    brand: 'Acme',
    m_chest: 92,
    measurements: [{ label: 'chest', value: 92, unit: 'cm' }],
  } as ClothingItemRow & { size: string; brand: string; m_chest: number };
  const out = describeItem(dirty, 'top');
  assertEquals(out.includes('M)'), false);
  assertEquals(out.toLowerCase().includes('acme'), false);
  assertEquals(out.includes('92'), false);
  assertEquals(out, 'top: Classic Tee (tee, white, Wool, slim fit)');
});

Deno.test('describeItem: all attributes together stay in the documented order and stay short', () => {
  const out = describeItem(row({
    material: 'Silk',
    fit: 'loose',
    pattern: 'floral',
    printScale: 'medium',
    drape: 'fluid',
    opacity: 'semi',
    distressed: true,
    warmthSeason: 'lightweight_summer',
    visualInterest: 0.9,
  }), 'top', 'sole torso layer');
  assertEquals(
    out,
    'top: Classic Tee (tee, white, Silk, loose fit, medium floral, fluid, semi, distressed, lightweight_summer, statement, sole torso layer)',
  );
});
