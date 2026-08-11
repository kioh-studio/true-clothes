// Deno test suite for the filtering extensions (2026-08-10):
//   (1) BannedFeature vocabulary expansion — floral_print, plaid_check,
//       abstract_print, slogan_text, graphic_illustration — each backed by a
//       real FitItem signal (fabric.pattern / graphics.artworkType).
//   (2) StyleConfig.typesBanned — hard typeName exclusion, hand-curated per
//       style, independent of color/fabric/fit/formality.
// Run: deno test supabase/functions/generate-outfits/engine/
//
// Guarantees exercised here:
//   - each new feature rejects an item that genuinely carries its signal
//     (via an isolated permissive fixture config, so the assertion is about
//     the engine's raw feature-detection logic, not any particular real
//     style's other constraints).
//   - typesBanned rejects the declared typeName and nothing else.
//   - the empty-category safety net (filtering.ts:885) still restores items
//     when a heavily-restricted real style would otherwise empty a category.
//   - a style that declares neither new bannedFeatures nor typesBanned
//     behaves identically to before this change.
//   - HOODIE still passes K-Fashion naturally (anti-regression for the
//     blazer-over-hoodie `mid` slot look shipped today, 2026-08-10) — the
//     new typesBanned additions only ever touched oldmoney/darkacademia/
//     elegant/officechic/parisian, never kfashion.

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { filterByStyle, passesStyleNaturally, styleConfigById } from './filtering.ts';
import { toFitItem } from './enrichment.ts';
import { ClothingItemRow, FitItem, StyleConfig, BannedFeature, ScoringWeights } from './types.ts';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function item(overrides: Partial<ClothingItemRow>): FitItem {
  return toFitItem({
    id: 'x', type: 'TEE', name: 'x', color: 'White', material: 'Cotton', ...overrides,
  });
}

const NEUTRAL_WEIGHTS: ScoringWeights = {
  style: 0.14, color: 0.14, fit: 0.14, proportion: 0.14, formality: 0.14, season: 0.15, texture: 0.15,
};

// A style config with every OTHER axis wide open (empty palette map = no
// color ever banned, empty fabric lists = no fabric ever banned, empty
// allowedFits = any fit, formalityRange spans the whole 1-5 scale) so a
// rejection can only ever come from the one bannedFeature/typeName under
// test — isolates the new detection logic from any real style's other
// constraints.
function permissiveConfig(bannedFeatures: BannedFeature[], typesBanned: string[] = []): StyleConfig {
  return {
    id: 'test-permissive', name: 'Test Permissive',
    palette: {},
    fabricsAllowed: [], fabricsBanned: [],
    allowedFits: [],
    formalityRange: [1, 5],
    bannedFeatures,
    typesBanned,
    overrides: [],
    weights: NEUTRAL_WEIGHTS,
    attributes: { formality: 2.5, colorPalette: [], silhouette: [], patternLevel: 1, textureRichness: 1, mood: [] },
    neighbors: [],
    popularity: 0.5,
  };
}

// ─── (1) each new BannedFeature rejects a matching item ────────────────────

Deno.test('floral_print rejects an item with fabric.pattern floral', () => {
  const config = permissiveConfig(['floral_print']);
  const floral = item({ id: 'f1', pattern: 'floral' });
  const solid  = item({ id: 's1', pattern: 'solid' });
  assert(!passesStyleNaturally(floral, config));
  assert(passesStyleNaturally(solid, config));
});

Deno.test('plaid_check rejects plaid AND checkered — the pattern macro_print exempts', () => {
  const config = permissiveConfig(['plaid_check']);
  const plaid     = item({ id: 'p1', pattern: 'plaid' });
  const checkered = item({ id: 'c1', pattern: 'checkered' });
  const striped   = item({ id: 'st1', pattern: 'striped' });
  assert(!passesStyleNaturally(plaid, config));
  assert(!passesStyleNaturally(checkered, config));
  assert(passesStyleNaturally(striped, config));

  // Cross-check against macro_print: checkered is explicitly exempted from
  // macro_print (filtering.ts featuresPasses), so plaid_check is the ONLY
  // way to ban a checkered item — proving it isn't redundant.
  const macroPrintOnly = permissiveConfig(['macro_print']);
  assert(passesStyleNaturally(checkered, macroPrintOnly), 'macro_print must NOT catch checkered (pre-existing exemption)');
});

Deno.test('abstract_print rejects an item with fabric.pattern abstract', () => {
  const config = permissiveConfig(['abstract_print']);
  const abstract = item({ id: 'a1', pattern: 'abstract' });
  const solid    = item({ id: 's1', pattern: 'solid' });
  assert(!passesStyleNaturally(abstract, config));
  assert(passesStyleNaturally(solid, config));
});

Deno.test('slogan_text rejects an item whose graphics.artworkType is slogan_text (independent of fabric.pattern)', () => {
  const config = permissiveConfig(['slogan_text']);
  // Pattern stays 'solid' — the signal is carried entirely by the
  // structured graphics jsonb (LogoSignal), not fabric.pattern, so this
  // proves the check isn't accidentally riding on macro_print.
  const sloganTee = item({ id: 'sl1', pattern: 'solid', graphics: { present: true, size: 'medium', kind: 'slogan_text', text: 'HELLO' } });
  const plainTee  = item({ id: 'pl1', pattern: 'solid', graphics: { present: false, size: null, kind: null, text: null } });
  assert(!passesStyleNaturally(sloganTee, config));
  assert(passesStyleNaturally(plainTee, config));
});

Deno.test('graphic_illustration rejects an item whose graphics.artworkType is graphic_illustration', () => {
  const config = permissiveConfig(['graphic_illustration']);
  const graphicTee = item({ id: 'g1', pattern: 'solid', graphics: { present: true, size: 'large', kind: 'graphic', text: null } });
  const logoTee    = item({ id: 'lg1', pattern: 'solid', graphics: { present: true, size: 'small', kind: 'brand_logo', text: null } });
  assert(!passesStyleNaturally(graphicTee, config));
  // brand_logo is a DIFFERENT artworkType — must not be caught by
  // graphic_illustration (only by loud_logo, which this config doesn't ban).
  assert(passesStyleNaturally(logoTee, config));
});

// ─── (2) typesBanned rejects the declared typeName and nothing else ────────

Deno.test('typesBanned rejects the declared typeName only', () => {
  const config = permissiveConfig([], ['HOODIE']);
  const hoodie = item({ id: 'h1', type: 'HOODIE' });
  const tee    = item({ id: 't1', type: 'TEE' });
  assert(!passesStyleNaturally(hoodie, config));
  assert(passesStyleNaturally(tee, config));
});

Deno.test('typesBanned undefined/empty is a no-op (default behavior preserved)', () => {
  const config = permissiveConfig([]);
  const hoodie = item({ id: 'h1', type: 'HOODIE' });
  assert(passesStyleNaturally(hoodie, config));
});

// ─── (3) empty-category safety net still fires under heavy real-style restriction ──

Deno.test('safety net: a wardrobe that fails Glam on every new axis still gets a top', () => {
  const glam = styleConfigById('glam')!;
  // Wrong color (not in glam palette-perfect/allowed/accent — olive is
  // explicitly banned), wrong fabric (cotton, banned), wrong fit territory,
  // low formality, checkered pattern (now plaid_check-banned) — this item
  // fails nearly every axis, but it is the ONLY 'top' in the wardrobe.
  const onlyTop = item({ id: 'top1', type: 'TEE', color: 'Olive', material: 'Cotton', pattern: 'checkered' });
  const bottom  = item({ id: 'bottom1', type: 'TROUSERS', color: 'Black', material: 'Wool', fit: 'slim' });
  const shoes   = item({ id: 'shoes1', type: 'HEELS', color: 'Black', material: 'Silk', fit: 'slim' });

  const { passed } = filterByStyle([onlyTop, bottom, shoes], glam);
  assert(passed.some(i => i.category === 'top'), 'safety net should have restored a top so the category is not empty');
  assert(!passesStyleNaturally(onlyTop, glam), 'sanity: the item genuinely does not pass naturally');
});

// ─── (4) an untouched style behaves identically to before this change ──────

Deno.test('regression: bohemian (no new bannedFeatures/typesBanned) is unaffected — floral still passes naturally', () => {
  const bohemian = styleConfigById('bohemian')!;
  assertEquals(bohemian.typesBanned, undefined);
  assert(!bohemian.bannedFeatures.includes('floral_print'));
  // Floral fits bohemian's own aesthetic — must still pass naturally exactly
  // as before the vocabulary expansion (bohemian only bans loud_logo).
  const floralDress = item({ id: 'fd1', type: 'DRESS', color: 'Beige', material: 'Linen', pattern: 'floral', fit: 'relaxed' });
  assert(passesStyleNaturally(floralDress, bohemian));
});

Deno.test('regression: streetwear (empty bannedFeatures, no typesBanned) still accepts a graphic hoodie', () => {
  const streetwear = styleConfigById('streetwear')!;
  assertEquals(streetwear.bannedFeatures.length, 0);
  assertEquals(streetwear.typesBanned, undefined);
  const graphicHoodie = item({
    id: 'gh1', type: 'HOODIE', color: 'Black', material: 'Cotton', fit: 'oversized',
    pattern: 'graphic', graphics: { present: true, size: 'large', kind: 'graphic', text: null },
  });
  assert(passesStyleNaturally(graphicHoodie, streetwear));
});

// ─── (5) anti-regression: HOODIE still passes K-Fashion naturally ──────────
// The new typesBanned additions only ever touched oldmoney, darkacademia,
// elegant, officechic, parisian — kfashion (whose blazer-over-hoodie look
// the `mid` slot unlocked today, per STYLE_AFFINITIES HOODIE not listing
// kfashion but the outfit still being valid) must be untouched.

Deno.test('anti-regression: a black cotton oversized hoodie still passes K-Fashion naturally', () => {
  const kfashion = styleConfigById('kfashion')!;
  assertEquals(kfashion.typesBanned, undefined);
  const hoodie = item({ id: 'kh1', type: 'HOODIE', color: 'Black', material: 'Cotton', fit: 'oversized' });
  assert(passesStyleNaturally(hoodie, kfashion));
});

// ─── New-style-config assertions: the exact features/types this task added ──

// ─── (6) 'distressed' (re-added 2026-08-11) — fail-open guarantee ──────────
// clothing_items.distressed is a NEW nullable column; ~70 existing wardrobe
// items have no value yet. featuresPasses must reject ONLY a CONFIRMED
// `fabric.distressed === true`; undefined (item never assessed) must NEVER
// reject, or a fail-closed rule would mass-fail real wardrobes overnight.

Deno.test('distressed: an item with distressed=true is rejected by a style that bans it', () => {
  const config = permissiveConfig(['distressed']);
  const rippedJeans = item({ id: 'dj1', type: 'JEANS', distressed: true });
  assert(!passesStyleNaturally(rippedJeans, config));
});

Deno.test('distressed: an item with distressed=undefined is NOT rejected by that same style (fail-open)', () => {
  const config = permissiveConfig(['distressed']);
  const unassessed = item({ id: 'dj2', type: 'JEANS' }); // no `distressed` override → undefined
  assert(passesStyleNaturally(unassessed, config));
});

Deno.test('distressed: an item with distressed=null (explicit DB null) is NOT rejected either', () => {
  const config = permissiveConfig(['distressed']);
  const explicitNull = item({ id: 'dj3', type: 'JEANS', distressed: null });
  assert(passesStyleNaturally(explicitNull, config));
});

Deno.test('distressed: an item with distressed=true passes a style that does NOT ban it', () => {
  const configNoBan = permissiveConfig([]); // permissive, no bannedFeatures at all
  const rippedJeans = item({ id: 'dj4', type: 'JEANS', distressed: true });
  assert(passesStyleNaturally(rippedJeans, configNoBan));
});

Deno.test('distressed: real style config — oldmoney rejects a confirmed-distressed item, allows an unassessed one', () => {
  const oldmoney = styleConfigById('oldmoney')!;
  assert(oldmoney.bannedFeatures.includes('distressed'));
  // TROUSERS/wool — a fabric oldmoney's fabricsAllowed whitelist actually
  // permits (unlike denim), so a rejection can only come from `distressed`.
  const rippedTrousers = item({
    id: 'od1', type: 'TROUSERS', color: 'Navy', material: 'Wool', fit: 'regular', distressed: true,
  });
  const plainTrousers = item({
    id: 'od2', type: 'TROUSERS', color: 'Navy', material: 'Wool', fit: 'regular',
  });
  assert(!passesStyleNaturally(rippedTrousers, oldmoney));
  assert(passesStyleNaturally(plainTrousers, oldmoney));
});

Deno.test('oldmoney bans HOODIE by type and slogan/graphic content by feature', () => {
  const oldmoney = styleConfigById('oldmoney')!;
  assertEquals(oldmoney.typesBanned, ['HOODIE']);
  assert(oldmoney.bannedFeatures.includes('slogan_text'));
  assert(oldmoney.bannedFeatures.includes('graphic_illustration'));

  const hoodie = item({ id: 'h1', type: 'HOODIE', color: 'Navy', material: 'Cashmere', fit: 'relaxed' });
  assert(!passesStyleNaturally(hoodie, oldmoney));

  const sloganKnit = item({
    id: 'sk1', type: 'KNIT', color: 'Cream', material: 'Wool', pattern: 'solid',
    graphics: { present: true, size: 'medium', kind: 'slogan_text', text: 'CLUB' },
  });
  assert(!passesStyleNaturally(sloganKnit, oldmoney));
});
