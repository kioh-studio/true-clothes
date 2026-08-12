// Deno tests for the layering package (2026-07-03):
//   - layerRole derived by TYPE ('mid' is live vocabulary again)
//   - canLayer rule derivation (cardigan/vest always; overshirt fabrics/fit;
//     non-slim knits; never tees)
//   - dual-role variant: a canLayer top may occupy the outwear slot OVER a
//     base top, as an OPTIONAL extra variant — bare cores are always emitted,
//     layering never gates normal outfits
//   - physical sanity: the layer must be ≥ weight and ≥ volume of the base
// Run: deno test supabase/functions/generate-outfits/engine/

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { toFitItem } from './enrichment.ts';
import { generateCandidates } from './generation.ts';
import { FitItem, ItemCategory, ClothingItemRow, FabricWeight } from './types.ts';

// ─── layerRole by type + canLayer derivation (through real enrichment) ──────

const row = (over: Partial<ClothingItemRow> & { type: string }): ClothingItemRow => ({
  id: over.id ?? 'x', name: over.name ?? over.type, color: over.color ?? 'navy', ...over,
});

Deno.test('layerRole derives by type: base / mid / outer are all live', () => {
  assertEquals(toFitItem(row({ type: 'TEE' })).fabric.layerRole, 'base');
  assertEquals(toFitItem(row({ type: 'SHIRT' })).fabric.layerRole, 'base');
  assertEquals(toFitItem(row({ type: 'SWEATER' })).fabric.layerRole, 'mid');
  assertEquals(toFitItem(row({ type: 'KNIT' })).fabric.layerRole, 'mid');
  assertEquals(toFitItem(row({ type: 'CARDIGAN' })).fabric.layerRole, 'mid');
  assertEquals(toFitItem(row({ type: 'JACKET' })).fabric.layerRole, 'outer');
  assertEquals(toFitItem(row({ type: 'COAT' })).fabric.layerRole, 'outer');
});

Deno.test('canLayer: cardigan/vest always; flannel shirt yes; declared-regular shirt yes; tee never', () => {
  assertEquals(toFitItem(row({ type: 'CARDIGAN' })).canLayer, true);
  assertEquals(toFitItem(row({ type: 'VEST' })).canLayer, true);
  assertEquals(toFitItem(row({ type: 'SHIRT', material: 'Flannel' })).canLayer, true);
  // Declared regular fit (stored `fit` column) — a soft shirt in a light
  // fabric worn open over a tee is standard; cut/closure decides, not weight.
  assertEquals(toFitItem(row({ type: 'SHIRT', material: 'Cotton', fit: 'regular' })).canLayer, true);
  assertEquals(toFitItem(row({ type: 'SHIRT', material: 'Cotton', fit: 'oversized' })).canLayer, true);
  assertEquals(toFitItem(row({ type: 'TEE' })).canLayer, false);
});

Deno.test('canLayer: SHIRT regular only counts on a DECLARED fit, not a type-default guess', () => {
  // No stored `fit`, no fit keyword in the name → deriveFitWithProvenance
  // guesses TYPE_DEFAULT_FIT (regular for SHIRT) with real: false. Flipping
  // regular→true unconditionally would make every unlabelled shirt
  // layerable off that guess — must stay false.
  assertEquals(toFitItem(row({ type: 'SHIRT', name: 'Shirt', material: 'Linen' })).canLayer, false);
  assertEquals(toFitItem(row({ type: 'HENLEY', name: 'Henley', material: 'Cotton' })).canLayer, false);
  // Stored `fit: 'regular'` (real signal) → true, even in a light fabric.
  assertEquals(toFitItem(row({ type: 'SHIRT', material: 'Linen', fit: 'regular' })).canLayer, true);
  // HENLEY is deliberately excluded from the regular-fit allowance (2026-08-12
  // correction): a henley's short neck placket, unlike a shirt's full-length
  // button front, physically cannot hang open over another top — declaring
  // it 'regular' doesn't change that. Stays false even with a real fit signal.
  assertEquals(toFitItem(row({ type: 'HENLEY', material: 'Cotton', fit: 'regular' })).canLayer, false);
  // A fit keyword in the NAME is also a real signal per deriveFitWithProvenance.
  assertEquals(toFitItem(row({ type: 'SHIRT', name: 'Regular Fit Oxford Shirt', material: 'Cotton' })).canLayer, true);
  // Relaxed/oversized unchanged regardless of provenance.
  assertEquals(toFitItem(row({ type: 'SHIRT', name: 'Oversized Oxford Shirt', material: 'Cotton' })).canLayer, true);
  // Slim shirts never layer, declared or not.
  assertEquals(toFitItem(row({ type: 'SHIRT', material: 'Linen', fit: 'slim' })).canLayer, false);
  // LAYER_FABRICS and heavy-weight shortcuts still short-circuit before fit,
  // even on a slim fit that the regular/declared path would otherwise reject.
  assertEquals(toFitItem(row({ type: 'SHIRT', material: 'Denim', fit: 'slim' })).canLayer, true);
  assertEquals(toFitItem(row({ type: 'SHIRT', material: 'Leather', fit: 'slim' })).canLayer, true);
});

Deno.test('canLayer: knits layer unless slim', () => {
  assertEquals(toFitItem(row({ type: 'KNIT', fit: 'relaxed' })).canLayer, true);
  assertEquals(toFitItem(row({ type: 'KNIT', fit: 'slim' })).canLayer, false);
});

// ─── canBeSoleTop: opacity gate on the BASE role (2026-08-14) ───────────────
// A cardigan has THREE roles: base (sole torso garment), mid, outer.
// deriveCanLayer above gates mid/outer ("born to be worn open") but the base
// role was previously ungated (CATEGORY_MAP grants 'top' unconditionally),
// which let a see-through mesh cardigan be selected as the ONLY thing on the
// torso. The fix is opacity, not type — proven here by also blocking a
// non-cardigan sheer top (a blouse).

Deno.test('canBeSoleTop: a sheer cardigan cannot be a sole top', () => {
  assertEquals(toFitItem(row({ type: 'CARDIGAN', opacity: 'sheer' })).canBeSoleTop, false);
});

Deno.test('canBeSoleTop: the same cardigan marked opaque CAN be a sole top', () => {
  assertEquals(toFitItem(row({ type: 'CARDIGAN', opacity: 'opaque' })).canBeSoleTop, true);
});

Deno.test('canBeSoleTop: semi opacity still counts as sole-top-capable (only sheer is blocked)', () => {
  assertEquals(toFitItem(row({ type: 'CARDIGAN', opacity: 'semi' })).canBeSoleTop, true);
});

Deno.test('canBeSoleTop: unknown/unassessed opacity keeps the old behaviour (allowed)', () => {
  assertEquals(toFitItem(row({ type: 'CARDIGAN' })).canBeSoleTop, true);
  assertEquals(toFitItem(row({ type: 'CARDIGAN', opacity: null })).canBeSoleTop, true);
});

Deno.test('canBeSoleTop: type-agnostic — a sheer BLOUSE (non-cardigan) is also blocked', () => {
  assertEquals(toFitItem(row({ type: 'BLOUSE', opacity: 'sheer' })).canBeSoleTop, false);
  assertEquals(toFitItem(row({ type: 'BLOUSE', opacity: 'opaque' })).canBeSoleTop, true);
});

// ─── generation.ts: the gate applied where the top slot is filled ──────────

Deno.test('generation: a sheer top is NOT emitted as a bare (sole-torso) outfit', () => {
  const bareWardrobe = (canBeSoleTop: boolean) => {
    const cardigan = fi('cardigan', 'top', { canLayer: true, fabricWeight: 'light', fit: 'relaxed', layerRole: 'base' });
    cardigan.canBeSoleTop = canBeSoleTop;
    return [cardigan, fi('jeans', 'bottom', {}), fi('sneakers', 'shoes', {})];
  };
  const isBareTop = (c: { slots: { top: string; outwear?: string; mid?: string } }) =>
    c.slots.top === 'cardigan' && c.slots.outwear === undefined && c.slots.mid === undefined;

  // Control: an opaque cardigan with nothing to layer with DOES reach the bare slot.
  const opaqueCandidates = generateCandidates(bareWardrobe(true), RULE_OF_THIRDS, 'seed-layer');
  assert(opaqueCandidates.some(isBareTop), 'expected an opaque sole cardigan to be emitted bare');

  // A sheer cardigan in the identical wardrobe never reaches the bare slot.
  const sheerCandidates = generateCandidates(bareWardrobe(false), RULE_OF_THIRDS, 'seed-layer');
  assert(sheerCandidates.every(c => !isBareTop(c)));
});

Deno.test('generation: a sheer top IS still usable when a real outerwear layer covers it', () => {
  const cardigan = fi('sheer-cardigan', 'top', { canLayer: true, fabricWeight: 'light', fit: 'relaxed', layerRole: 'base' });
  cardigan.canBeSoleTop = false;
  const wardrobe = [
    cardigan,
    fi('real-coat', 'outwear', { fabricWeight: 'heavy', fit: 'relaxed', layerRole: 'outer' }),
    fi('jeans', 'bottom', {}),
    fi('sneakers', 'shoes', {}),
  ];
  const candidates = generateCandidates(wardrobe, LAYERING_STACK, 'seed-layer');
  assert(candidates.some(c => c.slots.top === 'sheer-cardigan' && c.slots.outwear === 'real-coat'));
});

// ─── dual-role variants in generation (hand-built items for precise control) ─

function fi(
  id: string,
  category: ItemCategory,
  opts: {
    canLayer?: boolean; layerRole?: 'base' | 'mid' | 'outer';
    fabricWeight?: FabricWeight; fit?: FitItem['fit']; statement?: number;
  } = {},
): FitItem {
  return {
    id,
    category,
    typeName: 'TEE',
    colorProfile: { primaryColor: 'navy', colorLightness: 'dark', colorSaturation: 'muted', sat: 20, lum: 40, undertone: 'neutral' },
    graphics: { graphicWeight: 'none', artworkType: 'none' },
    fabric: {
      pattern: 'solid',
      fabricWeight: opts.fabricWeight ?? 'medium',
      breathability: 'medium',
      season: 'allSeason',
      layerRole: opts.layerRole ?? 'base',
    },
    styleTags: [],
    fit: opts.fit ?? 'regular',
    formality: 2.5,
    statementStrength: opts.statement ?? 0.5,
    canLayer: opts.canLayer ?? false,
    provenance: { fit: false, material: false, pattern: false, warmthSeason: false },
  };
}

const RULE_OF_THIRDS = ['rule_of_thirds'] as Parameters<typeof generateCandidates>[1];
// poolRuleOfThirds always sets outwear: [] (see generation.ts) — fine for the
// dual-role canLayer-via-pool.tops tests above, but the sole-torso-layer gate
// test below needs a REAL outwear-category item to reach pool.outwear, so it
// uses the one formula whose pool actually populates that field.
const LAYERING_STACK = ['layering_stack'] as Parameters<typeof generateCandidates>[1];

function layeringWardrobe(): FitItem[] {
  return [
    fi('tee', 'top', { fabricWeight: 'light', fit: 'regular', layerRole: 'base' }),
    fi('flannel', 'top', { canLayer: true, fabricWeight: 'medium', fit: 'relaxed', layerRole: 'base', statement: 1.0 }),
    fi('jeans', 'bottom', {}),
    fi('sneakers', 'shoes', {}),
    // no true outerwear in this wardrobe
  ];
}

Deno.test('a canLayer top appears in the outwear slot over a base top', () => {
  const candidates = generateCandidates(layeringWardrobe(), RULE_OF_THIRDS, 'seed-layer');
  const layered = candidates.find(c => c.slots.top === 'tee' && c.slots.outwear === 'flannel');
  assert(layered !== undefined, 'expected a tee-under-flannel layered variant');
});

Deno.test('layering never gates: bare (non-layered) cores are still emitted', () => {
  const candidates = generateCandidates(layeringWardrobe(), RULE_OF_THIRDS, 'seed-layer');
  assert(candidates.some(c => c.slots.top === 'tee' && c.slots.outwear === undefined));
  assert(candidates.some(c => c.slots.top === 'flannel' && c.slots.outwear === undefined));
});

Deno.test('an item never layers over itself', () => {
  const candidates = generateCandidates(layeringWardrobe(), RULE_OF_THIRDS, 'seed-layer');
  assert(candidates.every(c => c.slots.outwear === undefined || c.slots.outwear !== c.slots.top));
});

Deno.test('physical sanity: a lighter/tighter canLayer piece never goes over a heavier base', () => {
  const wardrobe = [
    fi('heavy-base', 'top', { fabricWeight: 'heavy', fit: 'relaxed', layerRole: 'base' }),
    fi('light-layer', 'top', { canLayer: true, fabricWeight: 'light', fit: 'slim', layerRole: 'base' }),
    fi('jeans', 'bottom', {}),
    fi('sneakers', 'shoes', {}),
  ];
  const candidates = generateCandidates(wardrobe, RULE_OF_THIRDS, 'seed-layer');
  assert(candidates.every(c => !(c.slots.top === 'heavy-base' && c.slots.outwear === 'light-layer')));
});

Deno.test('layered variants only sit over true base tops (never over a mid)', () => {
  const wardrobe = [
    fi('mid-knit', 'top', { fabricWeight: 'medium', fit: 'regular', layerRole: 'mid' }),
    fi('cardigan', 'top', { canLayer: true, fabricWeight: 'medium', fit: 'relaxed', layerRole: 'mid' }),
    fi('jeans', 'bottom', {}),
    fi('sneakers', 'shoes', {}),
  ];
  const candidates = generateCandidates(wardrobe, RULE_OF_THIRDS, 'seed-layer');
  assert(candidates.every(c => !(c.slots.top === 'mid-knit' && c.slots.outwear === 'cardigan')));
});

Deno.test('deterministic with layering in play', () => {
  const a = generateCandidates(layeringWardrobe(), RULE_OF_THIRDS, 'seed-layer');
  const b = generateCandidates(layeringWardrobe(), RULE_OF_THIRDS, 'seed-layer');
  assertEquals(JSON.stringify(a), JSON.stringify(b));
});
