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
