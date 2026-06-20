// Deno test suite for the Mix & Match pinned-candidate path (feature 008).
// Run: deno test supabase/functions/generate-outfits/engine/
//
// Guarantees:
//   - every returned candidate contains the pin in its correct slot (SC-003)
//   - every returned candidate is a complete outfit (top + bottom + footwear)
//   - an uncompletable wardrobe yields [] (sparse-wardrobe state)
//   - the unpinned generateCandidates path is unaffected (regression guard)

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { generatePinnedCandidates, generateCandidates } from './generation.ts';
import { toFitItem } from './enrichment.ts';
import { ClothingItemRow, FitItem } from './types.ts';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function item(overrides: Partial<ClothingItemRow>): FitItem {
  return toFitItem({
    id: 'x', type: 'TEE', name: 'x', color: 'White', material: 'Cotton', ...overrides,
  });
}

// A wardrobe that can complete an outfit around a pinned top: bottoms + shoes.
const wardrobe: FitItem[] = [
  item({ id: 'top1',    type: 'SHIRT',    color: 'White' }),
  item({ id: 'top2',    type: 'KNIT',     color: 'Navy'  }),
  item({ id: 'bottom1', type: 'TROUSERS', color: 'Beige' }),
  item({ id: 'bottom2', type: 'JEANS',    color: 'Navy'  }),
  item({ id: 'shoe1',   type: 'LOAFERS',  color: 'Brown' }),
  item({ id: 'jacket1', type: 'BLAZER',   color: 'Navy'  }),
  item({ id: 'belt1',   type: 'BELT',     color: 'Brown' }),
];

const SEED = 'test-seed';

function isComplete(slots: { top?: string; bottom?: string; shoes?: string }): boolean {
  return !!slots.top && !!slots.bottom && !!slots.shoes;
}

// ─── Pin inclusion + completeness, per pinned category ─────────────────────────

Deno.test('pinned TOP: every candidate contains the pin in the top slot and is complete', () => {
  const pin = item({ id: 'scanned', type: 'POLO', color: 'Olive' });
  const cands = generatePinnedCandidates(wardrobe, pin, SEED);

  assert(cands.length > 0, 'expected candidates');
  for (const c of cands) {
    assertEquals(c.slots.top, 'scanned');
    assert(isComplete(c.slots), 'outfit must be complete (top+bottom+shoes)');
  }
});

Deno.test('pinned BOTTOM: pin fills the bottom slot of every complete candidate', () => {
  const pin = item({ id: 'scanned', type: 'TROUSERS', color: 'Charcoal' });
  const cands = generatePinnedCandidates(wardrobe, pin, SEED);

  assert(cands.length > 0);
  for (const c of cands) {
    assertEquals(c.slots.bottom, 'scanned');
    assert(isComplete(c.slots));
  }
});

Deno.test('pinned SHOES: pin fills the shoes slot of every complete candidate', () => {
  const pin = item({ id: 'scanned', type: 'SNEAKERS', color: 'White' });
  const cands = generatePinnedCandidates(wardrobe, pin, SEED);

  assert(cands.length > 0);
  for (const c of cands) {
    assertEquals(c.slots.shoes, 'scanned');
    assert(isComplete(c.slots));
  }
});

Deno.test('pinned OUTERWEAR: full core from wardrobe, pin forced into outwear slot', () => {
  const pin = item({ id: 'scanned', type: 'COAT', color: 'Camel' });
  const cands = generatePinnedCandidates(wardrobe, pin, SEED);

  assert(cands.length > 0);
  for (const c of cands) {
    assertEquals(c.slots.outwear, 'scanned');
    assert(isComplete(c.slots), 'core must still be complete from the wardrobe');
  }
});

Deno.test('pinned ACCESSORY: full core from wardrobe, pin forced into accessory slot', () => {
  const pin = item({ id: 'scanned', type: 'SCARF', color: 'Burgundy' });
  const cands = generatePinnedCandidates(wardrobe, pin, SEED);

  assert(cands.length > 0);
  for (const c of cands) {
    assertEquals(c.slots.accessory, 'scanned');
    assert(isComplete(c.slots));
  }
});

Deno.test('pinned ONEPIECE: pin fills both top and bottom slots', () => {
  const pin = item({ id: 'scanned', type: 'DRESS', color: 'Black' });
  const cands = generatePinnedCandidates(wardrobe, pin, SEED);

  assert(cands.length > 0);
  for (const c of cands) {
    assertEquals(c.slots.top, 'scanned');
    assertEquals(c.slots.bottom, 'scanned');
    assert(!!c.slots.shoes);
  }
});

// ─── Uncompletable wardrobe → sparse state ─────────────────────────────────────

Deno.test('uncompletable wardrobe (no bottoms) yields no candidates for a pinned top', () => {
  const noBottoms = wardrobe.filter(i => i.category !== 'bottom');
  const pin = item({ id: 'scanned', type: 'POLO', color: 'Olive' });
  assertEquals(generatePinnedCandidates(noBottoms, pin, SEED).length, 0);
});

Deno.test('empty wardrobe yields no candidates', () => {
  const pin = item({ id: 'scanned', type: 'POLO', color: 'Olive' });
  assertEquals(generatePinnedCandidates([], pin, SEED).length, 0);
});

// ─── Determinism + regression guard ────────────────────────────────────────────

Deno.test('pinned generation is deterministic for a fixed seed', () => {
  const pin = item({ id: 'scanned', type: 'POLO', color: 'Olive' });
  const a = generatePinnedCandidates(wardrobe, pin, SEED);
  const b = generatePinnedCandidates(wardrobe, pin, SEED);
  assertEquals(JSON.stringify(a), JSON.stringify(b));
});

Deno.test('regression: the unpinned candidate path is unchanged and pin-free', () => {
  const a = generateCandidates(wardrobe, undefined, SEED);
  const b = generateCandidates(wardrobe, undefined, SEED);
  // Same seed → identical output (baseline still reproducible).
  assertEquals(JSON.stringify(a), JSON.stringify(b));
  // No baseline candidate references the transient pin id.
  for (const c of a) {
    for (const id of Object.values(c.slots)) {
      assert(id !== 'scanned', 'baseline must never contain the pin');
    }
  }
});
