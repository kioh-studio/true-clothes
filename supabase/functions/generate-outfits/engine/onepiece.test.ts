// Deno tests for one-piece (dress/jumpsuit/overalls) candidate generation.
// Run: deno test --allow-env --allow-read supabase/functions/generate-outfits/engine/
//
// Onepieces flow through the 10 formula pools (generation.ts getFormulaPools
// hands generators tops = tops + onepieces). Guarantees:
//   - slots.top === slots.bottom === the one-piece id for a self-paired look
//   - a dress-only wardrobe still yields candidates across several formulas
//   - rule_of_thirds / high_low never contain a onepiece
//   - DRESS pairs with slim/regular trousers and leggings, never skirt/shorts/wide
//   - OVERALLS get a base top underneath (bare only when none exists)
//   - JUMPSUIT is always self-paired
//   - TIGHTS (accessory) reachable on a dress outfit
//   - wardrobes with zero onepieces keep the exact same core (top|bottom|shoes) set
//   - generation is deterministic for a fixed seed

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { generateCandidates } from './generation.ts';
import { FitItem, ItemCategory, ItemFit } from './types.ts';

interface Opts {
  typeName?: string;
  fit?: ItemFit;
  color?: FitItem['colorProfile']['primaryColor'];
  lum?: number;
  weight?: 'light' | 'medium' | 'heavy';
  formality?: number;
  statement?: number;
  layerRole?: 'base' | 'mid' | 'outer';
  vivid?: boolean;
}

function fi(id: string, category: ItemCategory, o: Opts = {}): FitItem {
  return {
    id,
    category,
    typeName: o.typeName ?? (category === 'onepiece' ? 'DRESS' : category.toUpperCase()),
    colorProfile: {
      primaryColor: o.color ?? 'navy',
      colorLightness: 'medium',
      colorSaturation: o.vivid ? 'vivid' : 'muted',
      sat: 20,
      lum: o.lum ?? 40,
      undertone: 'neutral',
    },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: {
      pattern: 'solid',
      fabricWeight: o.weight ?? 'medium',
      breathability: 'medium',
      season: 'allSeason',
      layerRole: o.layerRole ?? (category === 'outwear' ? 'outer' : 'base'),
    },
    styleTags: [],
    fit: o.fit ?? 'regular',
    formality: o.formality ?? 2.5,
    statementStrength: o.statement ?? 0.3,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

const core = (c: { slots: { top: string; bottom: string; shoes: string } }) =>
  `${c.slots.top}|${c.slots.bottom}|${c.slots.shoes}`;

// Dress-only wardrobe: no tops/bottoms at all. Colours/weights/vividness vary
// so several pool generators are viable (monochrome, neutral_pop, tonal,
// texture_stack, one_two_three, layering_stack...).
function dressOnlyWardrobe(): FitItem[] {
  return [
    fi('dress-navy', 'onepiece', { color: 'navy', lum: 30, weight: 'medium', statement: 0.6 }),
    fi('dress-cream', 'onepiece', { color: 'cream', lum: 90, weight: 'light', statement: 0.4 }),
    fi('dress-red', 'onepiece', { color: 'red', lum: 50, weight: 'heavy', vivid: true, statement: 0.9 }),
    fi('shoe-black', 'shoes', { color: 'black', lum: 10, weight: 'heavy' }),
    fi('shoe-white', 'shoes', { color: 'white', lum: 95, weight: 'light' }),
    fi('coat-black', 'outwear', { color: 'black', lum: 10, weight: 'heavy' }),
    fi('bag-red', 'accessory', { color: 'red', vivid: true }),
  ];
}

// Mixed wardrobe with every onepiece kind and every pairing class.
function mixedWardrobe(): FitItem[] {
  return [
    fi('dress-a', 'onepiece', { color: 'navy', statement: 0.7 }),
    fi('dress-b', 'onepiece', { color: 'beige', lum: 80, statement: 0.5 }),
    fi('jump-a', 'onepiece', { typeName: 'JUMPSUIT', color: 'black', lum: 10, statement: 0.6 }),
    fi('overalls-a', 'onepiece', { typeName: 'OVERALLS', color: 'beige', lum: 75, statement: 0.6 }),
    fi('tee-a', 'top', { typeName: 'TEE', color: 'white', lum: 95 }),
    fi('knit-a', 'top', { typeName: 'SWEATER', color: 'gray', lum: 60, layerRole: 'mid' }),
    fi('slim-pants', 'bottom', { typeName: 'TROUSERS', fit: 'slim', color: 'charcoal', lum: 25 }),
    fi('leggings', 'bottom', { typeName: 'LEGGINGS', fit: 'slim', color: 'black', lum: 10 }),
    fi('wide-pants', 'bottom', { typeName: 'TROUSERS', fit: 'wide', color: 'beige', lum: 75 }),
    fi('skirt', 'bottom', { typeName: 'SKIRT', color: 'navy', lum: 30 }),
    fi('shorts', 'bottom', { typeName: 'SHORTS', color: 'khaki' as FitItem['colorProfile']['primaryColor'], lum: 70 }),
    fi('shoe-a', 'shoes', { color: 'black', lum: 10 }),
    fi('shoe-b', 'shoes', { color: 'white', lum: 95 }),
    fi('shoe-c', 'shoes', { color: 'brown', lum: 35 }),
    fi('coat-a', 'outwear', { color: 'black', lum: 10 }),
    fi('tights', 'accessory', { typeName: 'TIGHTS', color: 'black', lum: 10 }),
    fi('belt', 'accessory', { typeName: 'BELT', color: 'brown', lum: 35 }),
  ];
}

const isOnepiece = (id: string) => /^(dress|jump|overalls)/.test(id);

Deno.test('onepiece: dress-only wardrobe still yields candidates across >= 3 distinct formulas', () => {
  const cs = generateCandidates(dressOnlyWardrobe(), undefined, 'seed-1');
  assert(cs.length > 0);
  for (const c of cs) {
    assertEquals(c.slots.top, c.slots.bottom);
    assert(c.slots.top.startsWith('dress-'), `expected a dress id, got ${c.slots.top}`);
  }
  const formulas = new Set(cs.map(c => c.formula));
  assert(formulas.size >= 3, `expected >= 3 formulas, got ${[...formulas].join(',')}`);
});

Deno.test('onepiece: rule_of_thirds and high_low never contain a onepiece', () => {
  for (const wardrobe of [mixedWardrobe(), dressOnlyWardrobe()]) {
    for (const c of generateCandidates(wardrobe, undefined, 'seed-2')) {
      if (c.formula === 'rule_of_thirds' || c.formula === 'high_low') {
        assert(!isOnepiece(c.slots.top) && !isOnepiece(c.slots.bottom), `${c.formula} contained ${core(c)}`);
      }
    }
  }
});

Deno.test('onepiece: DRESS + slim trousers and DRESS + leggings appear; wide trousers / skirt / shorts never do', () => {
  const cs = generateCandidates(mixedWardrobe(), undefined, 'seed-3');
  const dressPairs = cs.filter(c => c.slots.top.startsWith('dress-') && c.slots.bottom !== c.slots.top);
  const bottoms = new Set(dressPairs.map(c => c.slots.bottom));
  assert(bottoms.has('slim-pants'), 'DRESS + slim trousers missing');
  assert(bottoms.has('leggings'), 'DRESS + leggings missing');
  for (const banned of ['wide-pants', 'skirt', 'shorts']) {
    assert(!bottoms.has(banned), `DRESS + ${banned} must never appear`);
  }
  // and a dress never sits in the bottom slot under a real top
  assert(!cs.some(c => c.slots.bottom.startsWith('dress-') && c.slots.top !== c.slots.bottom));
});

Deno.test('onepiece: OVERALLS always carry a base top when a tee exists; bare only when none exists', () => {
  const cs = generateCandidates(mixedWardrobe(), undefined, 'seed-4');
  const overalls = cs.filter(c => c.slots.bottom === 'overalls-a');
  assert(overalls.length > 0, 'expected overalls candidates');
  for (const c of overalls) {
    assertEquals(c.slots.top, 'tee-a', `overalls must sit over the base tee, got top=${c.slots.top}`);
  }
  assert(!cs.some(c => c.slots.top === 'overalls-a'), 'overalls must not be a bare self-pair when a base top exists');

  // No base top in the pool -> bare allowed.
  const noTee = mixedWardrobe().filter(i => i.id !== 'tee-a');
  const cs2 = generateCandidates(noTee, undefined, 'seed-4');
  assert(cs2.some(c => c.slots.top === 'overalls-a' && c.slots.bottom === 'overalls-a'), 'bare overalls expected without a base top');
  assert(!cs2.some(c => c.slots.bottom === 'overalls-a' && c.slots.top !== 'overalls-a'), 'no non-bare overalls without a base top (mid knit is not a base top)');
});

Deno.test('onepiece: JUMPSUIT never appears with bottom !== top', () => {
  const cs = generateCandidates(mixedWardrobe(), undefined, 'seed-5');
  const jump = cs.filter(c => c.slots.top === 'jump-a' || c.slots.bottom === 'jump-a');
  assert(jump.length > 0, 'expected jumpsuit candidates');
  for (const c of jump) assertEquals(c.slots.top, c.slots.bottom);
});

Deno.test('onepiece: TIGHTS reachable in the accessory slot of a dress outfit', () => {
  const found = [1, 2, 3, 4, 5, 6].some(n =>
    generateCandidates(mixedWardrobe(), undefined, `seed-tights-${n}`)
      .some(c => c.slots.top.startsWith('dress-') && c.slots.accessory === 'tights'));
  assert(found, 'no dress outfit with TIGHTS across 6 seeds');
});

Deno.test('onepiece: generation is deterministic for a fixed seed', () => {
  const a = generateCandidates(mixedWardrobe(), undefined, 'seed-1');
  const b = generateCandidates(mixedWardrobe(), undefined, 'seed-1');
  assertEquals(JSON.stringify(a), JSON.stringify(b));
});

// Pre-change expectation: the core (top|bottom|shoes) triples generateCandidates
// produced for this onepiece-free wardrobe BEFORE onepieces joined the pools
// (captured by running the previous engine, commit fa18e4b, over this exact
// wardrobe). Core selection is deterministic (no rand), so this proves the
// change is invisible to wardrobes without onepieces. Variant picks (accessory/
// outwear) DO shift with the RNG and are deliberately not compared.
const ZERO_ONEPIECE_EXPECTED_CORES: string[] = ["t1|b1|s1","t1|b1|s2","t1|b2|s1","t1|b2|s2","t2|b1|s1","t2|b1|s2","t2|b2|s1","t2|b2|s2","t3|b1|s1","t3|b1|s2","t3|b2|s1","t3|b2|s2"];

Deno.test('onepiece: wardrobe with zero onepieces keeps the exact pre-change core set', () => {
  const w = [
    fi('t1', 'top', { typeName: 'TEE', color: 'white', lum: 95, statement: 0.2 }),
    fi('t2', 'top', { typeName: 'SHIRT', color: 'navy', lum: 30, statement: 0.5, formality: 3.5 }),
    fi('t3', 'top', { typeName: 'SWEATER', color: 'red', lum: 50, vivid: true, statement: 0.9, layerRole: 'mid' }),
    fi('b1', 'bottom', { typeName: 'TROUSERS', fit: 'slim', color: 'charcoal', lum: 25, formality: 3.5 }),
    fi('b2', 'bottom', { typeName: 'JEANS', fit: 'wide', color: 'blue', lum: 45, weight: 'heavy' }),
    fi('s1', 'shoes', { color: 'black', lum: 10 }),
    fi('s2', 'shoes', { color: 'white', lum: 95, weight: 'light' }),
    fi('o1', 'outwear', { typeName: 'COAT', color: 'black', lum: 10, weight: 'heavy' }),
    fi('a1', 'accessory', { typeName: 'BAG', color: 'brown', lum: 35 }),
  ];
  const cores = [...new Set(generateCandidates(w, undefined, 'seed-1').map(core))].sort();
  assertEquals(cores, ZERO_ONEPIECE_EXPECTED_CORES);
});
