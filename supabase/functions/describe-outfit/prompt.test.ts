// Deno tests for describe-outfit's sole-torso-layer marker (2026-08-13):
//   - the bug: "HOW TO WEAR" told the user to open a cardigan that was the
//     ONLY thing on the torso — nothing underneath it to open it over.
//   - root cause (docs/redesign-outfit-completion.md:38): the prompt named
//     the garment's TYPE but never its ROLE in this specific outfit.
// This does NOT test the LLM's output (non-deterministic) — only the
// deterministic input construction: deriveSoleTorsoLayerIndex itself, and
// buildItemLines embedding its result as `sole torso layer` next to the
// right garment in the user-turn text actually sent to the model.
// Run: deno test --allow-all supabase/functions/describe-outfit/

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { deriveSoleTorsoLayerIndex, buildItemLines, OutfitItem } from './prompt.ts';

// ─── deriveSoleTorsoLayerIndex ─────────────────────────────────────────────

Deno.test('deriveSoleTorsoLayerIndex: a single top-family garment (with bottom + shoes) is the sole torso layer', () => {
  const items: OutfitItem[] = [
    { name: 'Grey Cardigan', type: 'CARDIGAN', color: 'Grey' },
    { name: 'Black Jeans', type: 'JEANS', color: 'Black' },
    { name: 'White Sneakers', type: 'SNEAKERS', color: 'White' },
  ];
  assertEquals(deriveSoleTorsoLayerIndex(items), 0);
});

Deno.test('deriveSoleTorsoLayerIndex: reproduces the actual bug scenario — cardigan alone reads as sole torso layer', () => {
  // The screenshot outfit: cardigan is the ONLY garment on the torso, and
  // the model told the user to open it. This is exactly that shape.
  const items: OutfitItem[] = [
    { name: 'Beige Cardigan', type: 'CARDIGAN', color: 'Beige', material: 'Wool' },
    { name: 'Wide-leg Trousers', type: 'TROUSERS', color: 'Cream' },
    { name: 'Loafers', type: 'LOAFERS', color: 'Brown' },
  ];
  assertEquals(deriveSoleTorsoLayerIndex(items), 0);
});

Deno.test('deriveSoleTorsoLayerIndex: null once a second torso garment is present — real layering', () => {
  const items: OutfitItem[] = [
    { name: 'White Tee', type: 'TEE', color: 'White' },
    { name: 'Grey Cardigan', type: 'CARDIGAN', color: 'Grey' },
    { name: 'Black Jeans', type: 'JEANS', color: 'Black' },
  ];
  assertEquals(deriveSoleTorsoLayerIndex(items), null);
});

Deno.test('deriveSoleTorsoLayerIndex: null when an outer-shell type accompanies a base top — also real layering', () => {
  const items: OutfitItem[] = [
    { name: 'Wool Coat', type: 'COAT', color: 'Camel' },
    { name: 'Black Turtleneck', type: 'SWEATER', color: 'Black' },
  ];
  assertEquals(deriveSoleTorsoLayerIndex(items), null);
});

Deno.test('deriveSoleTorsoLayerIndex: null when there are zero torso-family garments (e.g. bottom + shoes only)', () => {
  const items: OutfitItem[] = [
    { name: 'Black Jeans', type: 'JEANS', color: 'Black' },
    { name: 'White Sneakers', type: 'SNEAKERS', color: 'White' },
  ];
  assertEquals(deriveSoleTorsoLayerIndex(items), null);
});

Deno.test('deriveSoleTorsoLayerIndex: type match is case-insensitive (client may send lowercase)', () => {
  // Fixture changed 2026-08-21: the second item used to be lowercase 'dress',
  // which only passed because DRESS was absent from TORSO_LAYER_TYPES at the
  // time (a bug, fixed below) — this test's intent is case-insensitivity
  // only, so the second item is now a genuine non-torso garment instead.
  const items: OutfitItem[] = [
    { name: 'Kimono Jacket', type: 'kimono', color: 'Navy' },
    { name: 'Black Jeans', type: 'jeans', color: 'Black' },
  ];
  assertEquals(deriveSoleTorsoLayerIndex(items), 0);
});

Deno.test('deriveSoleTorsoLayerIndex: items missing `type` are never counted as torso garments', () => {
  const items: OutfitItem[] = [
    { name: 'Mystery Item', color: 'Black' },
    { name: 'Black Jeans', type: 'JEANS', color: 'Black' },
  ];
  assertEquals(deriveSoleTorsoLayerIndex(items), null);
});

Deno.test('deriveSoleTorsoLayerIndex: the sole torso layer can be at any index, not just 0', () => {
  const items: OutfitItem[] = [
    { name: 'Black Jeans', type: 'JEANS', color: 'Black' },
    { name: 'White Sneakers', type: 'SNEAKERS', color: 'White' },
    { name: 'Vest', type: 'VEST', color: 'Olive' },
  ];
  assertEquals(deriveSoleTorsoLayerIndex(items), 2);
});

// ─── buildItemLines ─────────────────────────────────────────────────────────

Deno.test('buildItemLines: marks the sole torso layer garment\'s line, and only that line', () => {
  const items: OutfitItem[] = [
    { name: 'Grey Cardigan', type: 'CARDIGAN', color: 'Grey' },
    { name: 'Black Jeans', type: 'JEANS', color: 'Black' },
    { name: 'White Sneakers', type: 'SNEAKERS', color: 'White' },
  ];
  const out = buildItemLines(items);
  const lines = out.split('\n');
  assertStringIncludes(lines[0], 'sole torso layer');
  assertEquals(lines[1].includes('sole torso layer'), false);
  assertEquals(lines[2].includes('sole torso layer'), false);
});

Deno.test('buildItemLines: no marker anywhere once a real second torso layer is present', () => {
  const items: OutfitItem[] = [
    { name: 'White Tee', type: 'TEE', color: 'White' },
    { name: 'Grey Cardigan', type: 'CARDIGAN', color: 'Grey' },
    { name: 'Black Jeans', type: 'JEANS', color: 'Black' },
  ];
  const out = buildItemLines(items);
  assertEquals(out.includes('sole torso layer'), false);
});

Deno.test('buildItemLines: marker appends after the existing color/material/fit attributes, comma-joined', () => {
  const items: OutfitItem[] = [
    { name: 'Grey Cardigan', type: 'CARDIGAN', color: 'Grey', material: 'Wool', fit: 'oversized' },
  ];
  assertEquals(
    buildItemLines(items),
    '1. Grey Cardigan (cardigan) — Grey, Wool, oversized fit, sole torso layer',
  );
});

Deno.test('buildItemLines: regression — formatting unchanged (no marker) when nothing is a sole torso layer', () => {
  const items: OutfitItem[] = [
    { name: 'Black Jeans', type: 'JEANS', color: 'Black' },
    { name: 'White Sneakers', type: 'SNEAKERS', color: 'White' },
  ];
  assertEquals(
    buildItemLines(items),
    '1. Black Jeans (jeans) — Black\n2. White Sneakers (sneakers) — White',
  );
});

Deno.test('buildItemLines: item with no name falls back to type, marker still appends correctly', () => {
  const items: OutfitItem[] = [
    { type: 'VEST', color: 'Olive' },
  ];
  assertEquals(buildItemLines(items), '1. VEST — Olive, sole torso layer');
});

// ─── one-piece coverage (2026-08-21 — DRESS/JUMPSUIT/OVERALLS/GOWN were
// missing from TORSO_LAYER_TYPES, diverging from the canonical
// isSoleTorsoLayer(slots) in generate-outfits/engine/curator.ts) ──────────

Deno.test('deriveSoleTorsoLayerIndex: a dress worn alone is the sole torso layer (was bug (a): missing marker)', () => {
  const items: OutfitItem[] = [
    { name: 'Slip Dress', type: 'DRESS', color: 'Black' },
    { name: 'Heels', type: 'HEELS', color: 'Black' },
    { name: 'Clutch Bag', type: 'BAG', color: 'Black' },
  ];
  assertEquals(deriveSoleTorsoLayerIndex(items), 0);
});

Deno.test('deriveSoleTorsoLayerIndex: dress + blazer is null, not the blazer (was bug (b): false positive)', () => {
  const items: OutfitItem[] = [
    { name: 'Slip Dress', type: 'DRESS', color: 'Black' },
    { name: 'Cream Blazer', type: 'BLAZER', color: 'Cream' },
    { name: 'Heels', type: 'HEELS', color: 'Black' },
  ];
  assertEquals(deriveSoleTorsoLayerIndex(items), null);
});

Deno.test('deriveSoleTorsoLayerIndex: a jumpsuit worn alone is the sole torso layer', () => {
  const items: OutfitItem[] = [
    { name: 'Wide-leg Jumpsuit', type: 'JUMPSUIT', color: 'Navy' },
  ];
  assertEquals(deriveSoleTorsoLayerIndex(items), 0);
});

Deno.test('deriveSoleTorsoLayerIndex: tee + cardigan still resolves null (existing two-torso-layer behaviour unaffected)', () => {
  const items: OutfitItem[] = [
    { name: 'White Tee', type: 'TEE', color: 'White' },
    { name: 'Grey Cardigan', type: 'CARDIGAN', color: 'Grey' },
  ];
  assertEquals(deriveSoleTorsoLayerIndex(items), null);
});
