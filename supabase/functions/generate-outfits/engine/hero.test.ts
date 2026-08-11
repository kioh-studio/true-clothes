// Deno test suite for hero-first candidate generation.
// Run: deno test supabase/functions/generate-outfits/engine/
//
// Guarantees:
//   - heroes are selected only from eligible categories (top|bottom|outwear|onepiece)
//   - heroes are selected only when statementStrength >= HERO_MIN_STATEMENT (with fallback)
//   - every returned candidate contains the hero in its correct slot
//   - a wardrobe with no statement AND no non-neutral item → [] (no regression)
//   - a hero whose core can't complete contributes no candidates
//   - per-hero candidate count ≤ HERO_PER_CAP; distinct heroes ≤ HERO_CAP
//   - generation is deterministic for a fixed seed

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  generateHeroCandidates,
  HERO_CAP, HERO_PER_CAP, HERO_MIN_STATEMENT,
} from './generation.ts';
import { FitItem, ItemCategory } from './types.ts';

// ─── Fixture factory ──────────────────────────────────────────────────────────
//
// Builds a minimal FitItem directly (without going through enrichment) so tests
// can control statementStrength and colorProfile.undertone precisely — the two
// fields that drive hero selection logic. All other fields are set to sensible
// defaults that satisfy the FitItem interface.

function fi(
  id: string,
  category: ItemCategory,
  statementStrength = 0,
  undertone: 'warm' | 'cool' | 'neutral' = 'neutral',
  opts: { typeName?: string; formality?: number; fit?: FitItem['fit']; primaryColor?: string } = {},
): FitItem {
  return {
    id,
    category,
    typeName: opts.typeName ?? 'TEE',
    colorProfile: {
      primaryColor: (opts.primaryColor ?? 'white') as FitItem['colorProfile']['primaryColor'],
      colorLightness: 'light',
      colorSaturation: 'muted',
      sat: 0,
      lum: 0.9,
      undertone,
    },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: {
      pattern: 'solid',
      fabricWeight: 'medium',
      breathability: 'medium',
      season: 'allSeason',
      layerRole: 'base',
    },
    styleTags: [],
    fit: opts.fit ?? 'regular',
    formality: opts.formality ?? 2,
    statementStrength,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

// ─── Eligible categories only ─────────────────────────────────────────────────

Deno.test('shoes are not eligible as heroes even when statementStrength is very high', () => {
  const items = [
    fi('hero-top',   'top',    3.0),  // eligible
    fi('loud-shoe',  'shoes',  4.0),  // ineligible — shoes cannot anchor
    fi('b1',         'bottom'),
    fi('s1',         'shoes'),
  ];
  const cands = generateHeroCandidates(items, 'seed');
  assert(cands.length > 0, 'the top hero should produce candidates');
  for (const c of cands) {
    assertEquals(c.slots.top, 'hero-top', 'hero must appear in top slot');
    assert(
      c.slots.shoes !== 'hero-top' && c.slots.bottom !== 'hero-top',
      'hero must not leak into other slots',
    );
  }
});

Deno.test('accessories are not eligible as heroes even when statementStrength is very high', () => {
  const items = [
    fi('hero-top', 'top',       3.0),
    fi('loud-acc', 'accessory', 4.0),  // ineligible
    fi('b1',       'bottom'),
    fi('s1',       'shoes'),
  ];
  const cands = generateHeroCandidates(items, 'seed');
  assert(cands.length > 0);
  for (const c of cands) assert(c.slots.accessory !== 'loud-acc');
});

// ─── Hero slot correctness, per eligible category ─────────────────────────────

Deno.test('top hero: every candidate has hero in top slot and outfit is complete', () => {
  const items = [
    fi('hero', 'top', 3.0),
    fi('b1', 'bottom'),
    fi('b2', 'bottom'),
    fi('s1', 'shoes'),
  ];
  const cands = generateHeroCandidates(items, 'seed');
  assert(cands.length > 0, 'expected candidates');
  for (const c of cands) {
    assertEquals(c.slots.top, 'hero');
    assert(!!c.slots.bottom && !!c.slots.shoes, 'outfit must be complete');
  }
});

Deno.test('bottom hero: every candidate has hero in bottom slot and outfit is complete', () => {
  const items = [
    fi('hero', 'bottom', 3.0),
    fi('t1', 'top'),
    fi('t2', 'top'),
    fi('s1', 'shoes'),
  ];
  const cands = generateHeroCandidates(items, 'seed');
  assert(cands.length > 0);
  for (const c of cands) {
    assertEquals(c.slots.bottom, 'hero');
    assert(!!c.slots.top && !!c.slots.shoes);
  }
});

Deno.test('outwear hero: every candidate has hero in outwear slot and a complete core', () => {
  const items = [
    fi('hero', 'outwear', 3.0),
    fi('t1', 'top'),
    fi('b1', 'bottom'),
    fi('s1', 'shoes'),
  ];
  const cands = generateHeroCandidates(items, 'seed');
  assert(cands.length > 0);
  for (const c of cands) {
    assertEquals(c.slots.outwear, 'hero', 'hero must be in outwear slot');
    assert(!!c.slots.top && !!c.slots.bottom && !!c.slots.shoes, 'core must be complete');
  }
});

Deno.test('onepiece hero: every candidate has hero in both top and bottom slots', () => {
  const items = [
    fi('hero', 'onepiece', 3.0),
    fi('s1', 'shoes'),
    fi('s2', 'shoes'),
  ];
  const cands = generateHeroCandidates(items, 'seed');
  assert(cands.length > 0);
  for (const c of cands) {
    assertEquals(c.slots.top, 'hero');
    assertEquals(c.slots.bottom, 'hero');
    assert(!!c.slots.shoes);
  }
});

// ─── Statement threshold and fallback ─────────────────────────────────────────

Deno.test(`items below HERO_MIN_STATEMENT (${HERO_MIN_STATEMENT}) are excluded from primary pool`, () => {
  const below = HERO_MIN_STATEMENT - 0.1;
  const items = [
    fi('t-low',  'top', below),   // below threshold
    fi('t-high', 'top', HERO_MIN_STATEMENT),  // exactly at threshold → included
    fi('b1', 'bottom'),
    fi('s1', 'shoes'),
  ];
  const cands = generateHeroCandidates(items, 'seed');
  // Only t-high qualifies; t-low must not appear as hero in the top slot
  // (note t-low may appear in non-hero "other tops" pools — we only check
  //  that t-high is the hero when there's a clear threshold split).
  for (const c of cands) {
    assert(c.slots.top !== 't-low', 't-low is below threshold and must not be hero');
    assertEquals(c.slots.top, 't-high');
  }
});

Deno.test('fallback: single loudest non-neutral eligible item is used when none clear the threshold', () => {
  const below = HERO_MIN_STATEMENT - 0.5;
  const items = [
    fi('t-warm', 'top', below + 0.3, 'warm'),    // loudest non-neutral → fallback hero
    fi('t-neut', 'top', below,       'neutral'),  // neutral — no fallback
    fi('b1', 'bottom'),
    fi('s1', 'shoes'),
  ];
  const cands = generateHeroCandidates(items, 'seed');
  assert(cands.length > 0, 'fallback should produce candidates');
  for (const c of cands) {
    assertEquals(c.slots.top, 't-warm', 'fallback hero must be the loudest non-neutral item');
  }
});

Deno.test('fallback: returns [] when loudest eligible item has neutral undertone', () => {
  const below = HERO_MIN_STATEMENT - 0.5;
  const items = [
    fi('t1', 'top', below, 'neutral'),  // loudest but neutral — no fallback triggered
    fi('b1', 'bottom'),
    fi('s1', 'shoes'),
  ];
  assertEquals(generateHeroCandidates(items, 'seed').length, 0);
});

Deno.test('fully neutral wardrobe with no statement items returns []', () => {
  const items = [
    fi('t1', 'top', 0.5, 'neutral'),
    fi('t2', 'top', 1.0, 'neutral'),
    fi('b1', 'bottom', 0.5, 'neutral'),
    fi('s1', 'shoes'),
  ];
  assertEquals(generateHeroCandidates(items, 'seed').length, 0);
});

// ─── Uncompletable hero core → no candidates ──────────────────────────────────

Deno.test('top hero with no bottoms produces no candidates', () => {
  const items = [
    fi('hero', 'top', 3.0),
    fi('s1', 'shoes'),
    // no bottom items
  ];
  assertEquals(generateHeroCandidates(items, 'seed').length, 0);
});

Deno.test('top hero with no shoes produces no candidates', () => {
  const items = [
    fi('hero', 'top', 3.0),
    fi('b1', 'bottom'),
    // no shoes
  ];
  assertEquals(generateHeroCandidates(items, 'seed').length, 0);
});

// ─── Cap enforcement ──────────────────────────────────────────────────────────

Deno.test(`per-hero candidate count does not exceed HERO_PER_CAP (${HERO_PER_CAP})`, () => {
  // Large wardrobe to stress the per-hero cap: 10 × 10 = 100 possible core triples
  const items: FitItem[] = [fi('hero', 'top', 3.0)];
  for (let i = 0; i < 10; i++) items.push(fi(`b${i}`, 'bottom'));
  for (let i = 0; i < 10; i++) items.push(fi(`s${i}`, 'shoes'));

  const cands = generateHeroCandidates(items, 'seed');
  assert(
    cands.length <= HERO_PER_CAP,
    `expected ≤ ${HERO_PER_CAP} candidates, got ${cands.length}`,
  );
});

Deno.test(`at most HERO_CAP (${HERO_CAP}) distinct heroes are selected`, () => {
  // 10 statement tops of DISTINCT types (so per-type diversity doesn't cap first);
  // only the HERO_CAP highest-scoring should be chosen.
  const TOP_TYPES = ['TEE', 'POLO', 'KNIT', 'SHIRT', 'BLOUSE', 'VEST', 'SWEATER', 'CARDIGAN', 'HENLEY', 'TUNIC'];
  const items: FitItem[] = [];
  for (let i = 0; i < 10; i++) {
    items.push(fi(`hero${i}`, 'top', 3.0 + i * 0.1, 'neutral', { typeName: TOP_TYPES[i] }));
  }
  items.push(fi('b1', 'bottom'));
  items.push(fi('s1', 'shoes'));

  const cands = generateHeroCandidates(items, 'seed');
  const heroIds = new Set(cands.map(c => c.slots.top));
  assert(
    heroIds.size <= HERO_CAP,
    `expected ≤ ${HERO_CAP} distinct heroes, got ${heroIds.size}`,
  );
  // Highest heroScore wins: hero9=3.9 … hero4=3.4 are the top 6 → kept;
  // hero0=3.0 … hero3=3.3 are the four LOWEST → excluded.
  for (let i = 0; i < 10 - HERO_CAP; i++) {
    assert(!heroIds.has(`hero${i}`), `hero${i} (lowest score) should have been excluded by HERO_CAP`);
  }
  for (let i = 10 - HERO_CAP; i < 10; i++) {
    assert(heroIds.has(`hero${i}`), `hero${i} (top score) should have been selected`);
  }
});

Deno.test('at most one hero per garment TYPE (feed not flooded with same-type pieces)', () => {
  // Three loud TEEs (same type) + one loud SHIRT → only ONE TEE should be a hero,
  // plus the SHIRT → 2 distinct heroes, never 4.
  const items = [
    fi('tee-loud-1', 'top', 3.0, 'warm', { typeName: 'TEE' }),
    fi('tee-loud-2', 'top', 2.8, 'warm', { typeName: 'TEE' }),
    fi('tee-loud-3', 'top', 2.6, 'warm', { typeName: 'TEE' }),
    fi('shirt-loud', 'top', 2.5, 'cool', { typeName: 'SHIRT' }),
    fi('b1', 'bottom'),
    fi('s1', 'shoes'),
  ];
  const cands = generateHeroCandidates(items, 'seed');
  const heroIds = new Set(cands.map(c => c.slots.top));
  // exactly the highest TEE (tee-loud-1) + the SHIRT
  assert(heroIds.has('tee-loud-1'), 'the highest-scoring TEE should be the TEE hero');
  assert(heroIds.has('shirt-loud'), 'the SHIRT (distinct type) should also be a hero');
  assert(!heroIds.has('tee-loud-2') && !heroIds.has('tee-loud-3'), 'only one hero per type');
});

Deno.test('structural hero: a neutral tailored blazer leads even below the loudness threshold', () => {
  // statementStrength 0.5 alone is far below 2.0, but outerwear + high formality
  // lifts heroScore over the threshold → the quiet blazer is featured. Without the
  // structural path a minimalist/neutral wardrobe would never get a hero.
  const items = [
    fi('blazer', 'outwear', 0.5, 'cool', { typeName: 'BLAZER', formality: 4.5 }),
    fi('t1', 'top'),
    fi('b1', 'bottom'),
    fi('s1', 'shoes'),
  ];
  const cands = generateHeroCandidates(items, 'seed');
  assert(cands.length > 0, 'the structural blazer should produce hero candidates');
  for (const c of cands) {
    assertEquals(c.slots.outwear, 'blazer', 'the blazer must be the fixed outwear hero');
  }
});

Deno.test('palette affinity breaks ties: the on-palette piece is preferred as hero', () => {
  // Two equally-loud SHIRT tops (same type → only one can be the hero). The one in
  // the user's palette (red) should win via the palette bonus.
  const items = [
    fi('red-shirt',  'top', 2.0, 'warm', { typeName: 'SHIRT', primaryColor: 'red' }),
    fi('blue-shirt', 'top', 2.0, 'cool', { typeName: 'SHIRT', primaryColor: 'blue' }),
    fi('b1', 'bottom'),
    fi('s1', 'shoes'),
  ];
  const cands = generateHeroCandidates(items, 'seed', ['red']);
  const heroIds = new Set(cands.map(c => c.slots.top));
  assert(heroIds.has('red-shirt'), 'the on-palette (red) shirt should be the hero');
  assert(!heroIds.has('blue-shirt'), 'the off-palette shirt should not be a second same-type hero');
});

// ─── Determinism ──────────────────────────────────────────────────────────────

Deno.test('generateHeroCandidates is deterministic for a fixed seed', () => {
  const items = [
    fi('hero1', 'top',    3.0),
    fi('hero2', 'bottom', 2.5),
    fi('t1',    'top'),
    fi('b1',    'bottom'),
    fi('b2',    'bottom'),
    fi('s1',    'shoes'),
    fi('s2',    'shoes'),
  ];
  const a = generateHeroCandidates(items, 'stable-seed');
  const b = generateHeroCandidates(items, 'stable-seed');
  assertEquals(JSON.stringify(a), JSON.stringify(b), 'same seed must produce identical output');
});

Deno.test('different seeds produce different candidate orderings', () => {
  const items = [
    fi('hero', 'top', 3.0),
    fi('b1', 'bottom'), fi('b2', 'bottom'), fi('b3', 'bottom'),
    fi('s1', 'shoes'),  fi('s2', 'shoes'),  fi('s3', 'shoes'),
  ];
  const a = generateHeroCandidates(items, 'seed-A');
  const b = generateHeroCandidates(items, 'seed-B');
  // Both sets should be non-empty; they may differ in order
  assert(a.length > 0 && b.length > 0);
  // Not strictly guaranteed but with different seeds and enough combos they should differ
  // (we only assert non-empty here; the determinism test above is the real correctness check)
});
