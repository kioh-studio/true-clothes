// Deno tests for the Wardrobe Critic analysis (feature 010).
// Covers the contract invariants (specs/010-wardrobe-critic/contracts/):
//   1. every unlock_count ≥ UNLOCK_THRESHOLD in gaps mode
//   2. no recommendation duplicates an owned archetype
//   3. recommendations respect the user's selected styles
//   4. sample_outfits contain only REAL wardrobe ids (never hypo_*)
//   5. deterministic: same wardrobe + seed → same report
//   6. sparse wardrobe → starter mode with owned flags
// Run: deno test supabase/functions/wardrobe-critic/

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { analyzeWardrobe, UNLOCK_THRESHOLD, MAX_RECOMMENDATIONS } from './analyze.ts';
import { ARCHETYPES } from './archetypes.ts';
import { ClothingItemRow } from '../generate-outfits/engine/types.ts';

const row = (id: string, type: string, color: string, material?: string, fit?: string): ClothingItemRow =>
  ({ id, type, name: `${color} ${type}`, color, material, fit, pattern: 'solid' });

// A smart-casual wardrobe DELIBERATELY missing formal footwear (only sneakers)
// and missing any white shirt — the critic should surface those gaps.
function gappyWardrobe(): ClothingItemRow[] {
  return [
    row('t1', 'TEE', 'Black', 'Cotton', 'regular'),
    row('t2', 'TEE', 'Grey', 'Cotton', 'regular'),
    row('t3', 'POLO', 'Navy', 'Cotton', 'regular'),
    row('t4', 'KNIT', 'Charcoal', 'Wool', 'regular'),
    row('t5', 'SWEATER', 'Cream', 'Wool', 'relaxed'),
    row('t6', 'SHIRT', 'Blue', 'Cotton', 'regular'),
    row('b1', 'TROUSERS', 'Charcoal', 'Wool', 'regular'),
    row('b2', 'CHINOS', 'Olive', 'Cotton', 'regular'),
    row('b3', 'JEANS', 'Navy', 'Denim', 'regular'),
    row('b4', 'TROUSERS', 'Beige', 'Cotton', 'regular'),
    row('s1', 'SNEAKERS', 'White', 'Leather', 'regular'),
    row('s2', 'SNEAKERS', 'Black', 'Canvas', 'regular'),
    row('o1', 'BLAZER', 'Navy', 'Wool', 'regular'),
    row('o2', 'JACKET', 'Olive', 'Cotton', 'regular'),
    row('a1', 'BELT', 'Brown', 'Leather'),
  ];
}

const INPUT = {
  selectedStyles: ['smartcasual', 'minimalist'],
  colorPreferences: ['navy', 'beige', 'white'],
  bodyMeasurements: {},
  weatherSeason: 'summer' as const,
  seed: 'test:2026-07-03',
};

Deno.test('gaps mode: finds gaps, all above threshold, capped at 3, sorted desc', () => {
  const report = analyzeWardrobe({ ...INPUT, wardrobeRows: gappyWardrobe() });
  assertEquals(report.mode, 'gaps');
  assert(report.recommendations.length >= 1 && report.recommendations.length <= MAX_RECOMMENDATIONS);
  for (const r of report.recommendations) assert(r.unlockCount >= UNLOCK_THRESHOLD);
  for (let i = 1; i < report.recommendations.length; i++) {
    assert(report.recommendations[i - 1].unlockCount >= report.recommendations[i].unlockCount);
  }
  assert(report.baselineQualified > 0);
});

Deno.test('never recommends an owned archetype', () => {
  const report = analyzeWardrobe({ ...INPUT, wardrobeRows: gappyWardrobe() });
  // Wardrobe owns white sneakers + navy blazer + navy jeans → those archetypes are out.
  const ids = report.recommendations.map(r => r.archetypeId);
  assert(!ids.includes('white_sneakers'));
  assert(!ids.includes('navy_blazer'));
  assert(!ids.includes('dark_jeans'));
});

Deno.test('recommendations respect selected styles', () => {
  const report = analyzeWardrobe({ ...INPUT, wardrobeRows: gappyWardrobe() });
  for (const r of report.recommendations) {
    const a = ARCHETYPES.find(x => x.id === r.archetypeId)!;
    assert(a.styleAffinity.some(s => INPUT.selectedStyles.includes(s)),
      `${r.archetypeId} not affine to ${INPUT.selectedStyles}`);
  }
});

Deno.test('sample outfits contain only real wardrobe ids, never hypo_*', () => {
  const report = analyzeWardrobe({ ...INPUT, wardrobeRows: gappyWardrobe() });
  const realIds = new Set(gappyWardrobe().map(r => r.id));
  for (const r of report.recommendations) {
    for (const outfit of r.sampleOutfits) {
      for (const id of outfit) {
        assert(realIds.has(id), `unknown id ${id}`);
        assert(!id.startsWith('hypo_'));
      }
    }
  }
});

Deno.test('deterministic: same wardrobe + seed → identical report', () => {
  const a = analyzeWardrobe({ ...INPUT, wardrobeRows: gappyWardrobe() });
  const b = analyzeWardrobe({ ...INPUT, wardrobeRows: gappyWardrobe() });
  assertEquals(JSON.stringify(a), JSON.stringify(b));
});

Deno.test('notes are filled in both locales with the real count', () => {
  const report = analyzeWardrobe({ ...INPUT, wardrobeRows: gappyWardrobe() });
  for (const r of report.recommendations) {
    assert(r.note.en.includes(String(r.unlockCount)));
    assert(r.note.vi.includes(String(r.unlockCount)));
    assert(!r.note.en.includes('{count}') && !r.note.vi.includes('{count}'));
  }
});

Deno.test('sparse wardrobe → starter mode with owned flags', () => {
  const sparse = [
    row('t1', 'TEE', 'White', 'Cotton', 'regular'),
    row('b1', 'JEANS', 'Navy', 'Denim', 'regular'),
    // no shoes at all
  ];
  const report = analyzeWardrobe({ ...INPUT, wardrobeRows: sparse });
  assertEquals(report.mode, 'starter');
  assertEquals(report.recommendations.length, 0);
  assert(report.starterChecklist.length > 0);
  const whiteTee = report.starterChecklist.find(s => s.archetypeId === 'white_tee');
  assert(whiteTee !== undefined && whiteTee.owned === true);
  const sneakers = report.starterChecklist.find(s => s.archetypeId === 'white_sneakers');
  assert(sneakers !== undefined && sneakers.owned === false);
});

Deno.test('redundancy: a cluster of 5 near-identical items is called out', () => {
  const wardrobe = [
    ...gappyWardrobe(),
    row('r1', 'TEE', 'White', 'Cotton', 'regular'),
    row('r2', 'TEE', 'White', 'Cotton', 'regular'),
    row('r3', 'TEE', 'Cream', 'Cotton', 'regular'),
    row('r4', 'TEE', 'Ivory', 'Cotton', 'regular'),
    row('r5', 'TEE', 'White', 'Cotton', 'regular'),
  ];
  const report = analyzeWardrobe({ ...INPUT, wardrobeRows: wardrobe });
  assert(report.redundancy !== null);
  assertEquals(report.redundancy!.typeName, 'TEE');
  assertEquals(report.redundancy!.colorFamily, 'whites');
  assert(report.redundancy!.count >= 5);
});

Deno.test('archetype catalog is structurally valid', () => {
  const seen = new Set<string>();
  const STYLE_IDS = new Set(['oldmoney', 'minimalist', 'streetwear', 'smartcasual', 'preppy', 'athleisure', 'y2k', 'bohemian']);
  for (const a of ARCHETYPES) {
    assert(!seen.has(a.id), `duplicate archetype id ${a.id}`);
    seen.add(a.id);
    assert(a.syntheticRow.id === `hypo_${a.id}`);
    assert(a.styleAffinity.length > 0 && a.styleAffinity.every(s => STYLE_IDS.has(s)));
    assert(a.noteTemplate.en.includes('{count}') && a.noteTemplate.vi.includes('{count}'));
    assert(a.label.en.length > 0 && a.label.vi.length > 0);
  }
});
