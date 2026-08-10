// Deno test suite for the wardrobe-affinity style fallback (2026-08-02).
// Run: deno test supabase/functions/generate-outfits/engine/
//
// Guarantees:
//   - eligibility requires a full outfit's worth of naturally-passing items
//     (top+bottom+shoes, or onepiece+shoes) — a high pass FRACTION alone
//     isn't enough if a whole slot is missing.
//   - ranking is deterministic: score desc, then popularity desc, then id asc.
//   - maxStyles caps the result.
//   - empty wardrobe → [].
//   - passesStyleNaturally never counts an item filterByStyle only kept via
//     its empty-category safety net.

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { resolveFallbackStyles, passesStyleNaturally, filterByStyle, styleConfigById } from './filtering.ts';
import { toFitItem } from './enrichment.ts';
import { ClothingItemRow, FitItem } from './types.ts';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function item(overrides: Partial<ClothingItemRow>): FitItem {
  return toFitItem({
    id: 'x', type: 'TEE', name: 'x', color: 'White', material: 'Cotton', ...overrides,
  });
}

// ─── Eligibility: only one style covered top+bottom+shoes ──────────────────

Deno.test('eligibility: a tweed wardrobe naturally suits Old Money and Dark Academia', () => {
  // Tweed excludes minimalist/smartcasual/bohemian/athleisure (not in their
  // allowed fabric lists); relaxed fit excludes preppy (slim/regular only);
  // the resulting formality (4.0-4.5) excludes streetwear/athleisure/y2k/
  // bohemian (all cap well below that). Old Money allows tweed + relaxed +
  // this formality range.
  //
  // Style catalog expansion (2026-08-10): Dark Academia also allows tweed +
  // relaxed + this formality range — an intentional, real overlap (tweed
  // cardigans/blazers are as core to dark academia as to old money, which is
  // why the two are configured as neighbors, see filtering.ts). It ranks
  // below Old Money by popularity, but both are eligible.
  const top    = item({ id: 'top1',    type: 'SHIRT',    color: 'Navy',     material: 'Tweed', fit: 'relaxed' });
  const bottom = item({ id: 'bottom1', type: 'TROUSERS', color: 'Charcoal', material: 'Tweed', fit: 'relaxed' });
  const shoes  = item({ id: 'shoes1',  type: 'LOAFERS',  color: 'Brown',    material: 'Tweed', fit: 'relaxed' });

  const result = resolveFallbackStyles([top, bottom, shoes]);

  assertEquals(result.map(c => c.id), ['oldmoney', 'darkacademia']);
});

// ─── Coverage requirement: high pass fraction, but missing shoes ───────────

Deno.test('coverage requirement: a style with no natural shoes is excluded even at high pass fraction', () => {
  const top1   = item({ id: 'top1',    type: 'TEE',      color: 'Black', material: 'Cotton' });
  const top2   = item({ id: 'top2',    type: 'KNIT',     color: 'Gray',  material: 'Cotton' });
  const bottom = item({ id: 'bottom1', type: 'TROUSERS', color: 'Gray',  material: 'Cotton' });
  // Yellow is banned in Minimalist's palette — this is the only shoes item,
  // so Minimalist's natural pool has 3/4 items (75%) but zero shoes.
  const shoes  = item({ id: 'shoes1',  type: 'SNEAKERS', color: 'Yellow', material: 'Nylon' });

  const wardrobe = [top1, top2, bottom, shoes];
  assert(passesStyleNaturally(top1, styleConfigById('minimalist')!));
  assert(passesStyleNaturally(top2, styleConfigById('minimalist')!));
  assert(passesStyleNaturally(bottom, styleConfigById('minimalist')!));
  assert(!passesStyleNaturally(shoes, styleConfigById('minimalist')!));

  const result = resolveFallbackStyles(wardrobe);
  assert(!result.some(c => c.id === 'minimalist'), 'minimalist should be excluded (no natural shoes)');
});

// ─── Onepiece + shoes counts as coverage ────────────────────────────────────

Deno.test('onepiece + shoes counts as full coverage (no top/bottom needed)', () => {
  const dress   = item({ id: 'dress1',   type: 'DRESS',   color: 'Beige', material: 'Linen' });
  const sandals = item({ id: 'sandals1', type: 'SANDALS', color: 'Beige', material: 'Leather' });

  assert(passesStyleNaturally(dress, styleConfigById('bohemian')!));
  assert(passesStyleNaturally(sandals, styleConfigById('bohemian')!));

  const result = resolveFallbackStyles([dress, sandals]);
  assert(result.some(c => c.id === 'bohemian'), 'bohemian should be eligible via onepiece+shoes');
});

// ─── Tie-break (popularity desc, then id asc), maxStyles cap, determinism ──

// Neutral, high-formality, high-quality basics (black/cotton tee+trousers,
// black leather loafers) naturally pass Old Money, Minimalist, Smart Casual,
// and Preppy identically (all 3 items pass all 4 configs) — an exact 3-way
// score tie (1.0) among those four, decided purely by popularity.
const tieWardrobe: FitItem[] = [
  item({ id: 'tee1',     type: 'TEE',      color: 'Black', material: 'Cotton',  fit: 'regular' }),
  item({ id: 'trouser1', type: 'TROUSERS', color: 'Black', material: 'Cotton',  fit: 'regular' }),
  item({ id: 'loafer1',  type: 'LOAFERS',  color: 'Black', material: 'Leather', fit: 'regular' }),
];

Deno.test('tie-break: equal-score styles rank by popularity desc, capped at maxStyles', () => {
  const result = resolveFallbackStyles(tieWardrobe);
  assertEquals(result.map(c => c.id), ['smartcasual', 'oldmoney', 'minimalist']);
});

Deno.test('maxStyles caps the result count', () => {
  assertEquals(resolveFallbackStyles(tieWardrobe, 1).map(c => c.id), ['smartcasual']);
  assertEquals(resolveFallbackStyles(tieWardrobe, 2).map(c => c.id), ['smartcasual', 'oldmoney']);
});

Deno.test('determinism: repeated calls on the same input return the same order', () => {
  const a = resolveFallbackStyles(tieWardrobe).map(c => c.id);
  const b = resolveFallbackStyles(tieWardrobe).map(c => c.id);
  assertEquals(a, b);
});

// ─── Empty wardrobe ──────────────────────────────────────────────────────────

Deno.test('empty wardrobe → []', () => {
  assertEquals(resolveFallbackStyles([]), []);
});

// ─── passesStyleNaturally vs filterByStyle's safety net ─────────────────────

Deno.test('passesStyleNaturally is false for an item only kept by the safety net', () => {
  // Yellow is banned in Old Money's palette — this item fails naturally, but
  // it's the ONLY 'top' item, so filterByStyle's empty-category safety net
  // restores it into `passed` anyway.
  const onlyTop = item({ id: 'top1', type: 'TEE', color: 'Yellow', material: 'Cotton' });
  const config = styleConfigById('oldmoney')!;

  const { passed } = filterByStyle([onlyTop], config);
  assert(passed.some(i => i.id === 'top1'), 'safety net should have restored the only top item');
  assert(!passesStyleNaturally(onlyTop, config), 'the item does not naturally pass despite being restored');
});
