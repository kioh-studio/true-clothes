// Deno test suite for the style catalog expansion (2026-08-10): 8 → 22
// styles. Structural guarantees only — these tests don't hit the network, so
// they encode the same id/attribute/neighbor data the companion
// `public.styles` migration (20260810000003_style_catalog_expansion.sql)
// applies live. If the two ever drift, update both together.
//
// Run: deno test supabase/functions/generate-outfits/engine/

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { STYLE_CONFIGS } from './filtering.ts';
import {
  PrimaryColor, FabricName, ItemFit, BannedFeature, ColorPalette, Silhouette, Mood,
} from './types.ts';

// ─── Source-of-truth id set — mirrors public.styles after the migration ────

const EXPECTED_STYLE_IDS = [
  // 8 original
  'oldmoney', 'minimalist', 'streetwear', 'smartcasual', 'preppy', 'athleisure', 'y2k', 'bohemian',
  // 14 added (style catalog expansion, 2026-08-10)
  'feminine', 'officechic', 'parisian', 'coquette', 'cleangirl', 'darkacademia',
  'cottagecore', 'grunge', 'athflow', 'elegant', 'kfashion', 'vintage', 'resort', 'artsy',
  // 9 added (style catalog expansion batch 2, 2026-08-10 — 11 requested,
  // 'mobwife'/'modest' stopped for a vocabulary gap, see plan.md)
  'glam', 'businessformal', 'gothic', 'utility', 'sporty', 'normcore', 'retro70s', 'pinup', 'whimsigoth',
  // 1 added (style catalog expansion batch 3, 2026-08-11 — 'mobwife'
  // unblocked by the new 'fur' FabricName value; 'modest' remains stopped,
  // its gap is a missing FitItem coverage attribute, not a fabric)
  'mobwife',
].sort();

// ─── Vocabulary — mirrors the unions declared in types.ts/enrichment.ts ────
// Runtime mirrors are necessary because TS unions aren't reifiable; keep in
// sync with types.ts if either vocabulary changes.

const VALID_COLORS: PrimaryColor[] = [
  'black', 'white', 'navy', 'beige', 'gray', 'brown', 'olive',
  'blue', 'red', 'purple', 'green', 'yellow', 'pink', 'orange',
  'cream', 'ivory', 'camel', 'tan', 'taupe', 'khaki', 'charcoal',
  'burgundy', 'teal', 'metallic', 'multicolor', 'natural',
  'mustard', 'rust', 'coral', 'mint', 'lavender', 'sage',
  'terracotta', 'mauve', 'wine', 'fuchsia', 'denim',
];
const VALID_FABRICS: FabricName[] = [
  'cotton', 'wool', 'linen', 'cashmere', 'silk', 'denim',
  'leather', 'suede', 'nylon', 'polyester', 'canvas', 'corduroy',
  'tweed', 'flannel', 'jersey', 'fleece', 'velvet',
  // 'fur' (2026-08-11) — unlocks 'mobwife'.
  'fur',
];
const VALID_FITS: ItemFit[] = ['slim', 'regular', 'relaxed', 'wide', 'oversized'];
const VALID_BANNED_FEATURES: BannedFeature[] = [
  'loud_logo', 'macro_print', 'full_print', 'neon_color',
  'floral_print', 'plaid_check', 'abstract_print', 'slogan_text', 'graphic_illustration',
  // 'distressed' re-added (2026-08-11) — now backed by clothing_items.distressed
  // and checked in filtering.ts featuresPasses; see types.ts BannedFeature doc comment.
  'distressed',
];
const VALID_COLOR_PALETTES: ColorPalette[] = ['neutral', 'earth', 'bold', 'pastel', 'dark', 'monochrome'];
const VALID_SILHOUETTES: Silhouette[] = ['relaxed', 'structured', 'bodycon', 'oversized', 'tailored'];
const VALID_MOODS: Mood[] = ['playful', 'serious', 'romantic', 'edgy', 'clean', 'artistic'];
// Mirrors enrichment.ts's CATEGORY_MAP keys (typesBanned, 2026-08-10) —
// typesBanned entries must be real typeName values, not invented ones.
const VALID_TYPE_NAMES = new Set([
  'TEE', 'POLO', 'KNIT', 'SHIRT', 'BLOUSE', 'VEST', 'SWEATER', 'CARDIGAN', 'HENLEY',
  'CAMISOLE', 'CROP', 'BODYSUIT', 'TUNIC', 'CORSET',
  'JACKET', 'BLAZER', 'COAT', 'HOODIE', 'PARKA', 'OVERCOAT', 'CAPE', 'KIMONO',
  'JEANS', 'TROUSERS', 'CHINOS', 'SHORTS', 'SKIRT', 'LEGGINGS',
  'DRESS', 'JUMPSUIT', 'OVERALLS', 'GOWN',
  'LOAFERS', 'SNEAKERS', 'BOOTS', 'HEELS', 'SANDALS', 'OXFORDS', 'MULES', 'FLATS', 'WEDGES',
  'BAG', 'BELT', 'SCARF', 'WATCH', 'CAP',
  'NECKLACE', 'SUNGLASSES', 'HAT', 'RING', 'BRACELET',
  'EARRINGS', 'GLOVES', 'TIGHTS', 'TIE',
]);

// Bidirectional pairs the task explicitly required — asserted individually
// so a regression on any one names the exact missing edge.
const REQUIRED_SYMMETRIC_PAIRS: Array<[string, string]> = [
  ['officechic', 'smartcasual'],
  ['cleangirl', 'minimalist'],
  ['darkacademia', 'oldmoney'],
  ['darkacademia', 'preppy'],
  ['athflow', 'athleisure'],
  ['coquette', 'feminine'],
  // Style catalog expansion batch 2 (2026-08-10)
  ['businessformal', 'officechic'],
  ['gothic', 'grunge'],
  ['sporty', 'athleisure'],
  ['normcore', 'minimalist'],
  ['retro70s', 'vintage'],
  ['whimsigoth', 'bohemian'],
  ['glam', 'elegant'],
  ['pinup', 'vintage'],
  // Style catalog expansion batch 3 (2026-08-11)
  ['mobwife', 'glam'], ['mobwife', 'gothic'], ['mobwife', 'elegant'],
];

// ─── (1) STYLE_CONFIGS ids ↔ expected DB id set ─────────────────────────────

Deno.test('style catalog: STYLE_CONFIGS ids exactly match the expected public.styles id set', () => {
  const configIds = STYLE_CONFIGS.map(c => c.id).sort();
  assertEquals(configIds, EXPECTED_STYLE_IDS);
  // No duplicate ids.
  assertEquals(new Set(configIds).size, configIds.length);
});

// ─── (2) every neighbor points at a real STYLE_CONFIGS id ──────────────────

Deno.test('style catalog: every neighbor id resolves to a real style', () => {
  const ids = new Set(STYLE_CONFIGS.map(c => c.id));
  for (const config of STYLE_CONFIGS) {
    for (const n of config.neighbors) {
      assert(ids.has(n.styleId), `${config.id} lists unknown neighbor '${n.styleId}'`);
      assert(n.styleId !== config.id, `${config.id} lists itself as a neighbor`);
    }
  }
});

// ─── (3) every neighbor edge in the whole catalog is bidirectional ─────────
// Originally scoped to edges touching only the 14 NEW styles (the catalog
// expansion's own additions), with a documented carve-out for two pre-
// existing one-directional edges from the original 8-style catalog:
// bohemian → y2k (0.3) and bohemian → athleisure (0.2) were never
// reciprocated. Fixed 2026-08-11 (see 'Reciprocity fix' comments on y2k's
// and athleisure's neighbor lists above — reciprocal weights were chosen
// deliberately per pair, not copied from the forward edge). A full
// catalog-wide sweep at fix time found no other asymmetric pairs, so this
// assertion is now unscoped and covers every style, old and new alike — any
// future one-directional edge (in either an existing or a newly added style)
// fails this test immediately, naming the exact missing reverse edge.
Deno.test('style catalog: every neighbor edge is bidirectional', () => {
  const byId = new Map(STYLE_CONFIGS.map(c => [c.id, c]));
  for (const config of STYLE_CONFIGS) {
    for (const n of config.neighbors) {
      const other = byId.get(n.styleId);
      assert(other, `${config.id} → ${n.styleId}: target style missing`);
      const hasReverse = other!.neighbors.some(back => back.styleId === config.id);
      assert(hasReverse, `${config.id} → ${n.styleId} has no reverse edge (${n.styleId} → ${config.id} missing)`);
    }
  }
});

Deno.test('style catalog: required cross-generation pairs are present and symmetric', () => {
  const byId = new Map(STYLE_CONFIGS.map(c => [c.id, c]));
  for (const [a, b] of REQUIRED_SYMMETRIC_PAIRS) {
    const aHasB = byId.get(a)!.neighbors.some(n => n.styleId === b);
    const bHasA = byId.get(b)!.neighbors.some(n => n.styleId === a);
    assert(aHasB, `${a} is missing neighbor ${b}`);
    assert(bHasA, `${b} is missing neighbor ${a}`);
  }
});

// ─── (4) every value used is drawn from the real engine vocabulary ─────────

Deno.test('style catalog: palette/fabric/fit/feature/attribute values are all valid vocabulary', () => {
  const colorSet = new Set<string>(VALID_COLORS);
  const fabricSet = new Set<string>(VALID_FABRICS);
  const fitSet = new Set<string>(VALID_FITS);
  const featureSet = new Set<string>(VALID_BANNED_FEATURES);
  const paletteSet = new Set<string>(VALID_COLOR_PALETTES);
  const silhouetteSet = new Set<string>(VALID_SILHOUETTES);
  const moodSet = new Set<string>(VALID_MOODS);

  for (const config of STYLE_CONFIGS) {
    for (const color of Object.keys(config.palette)) {
      assert(colorSet.has(color), `${config.id}: palette uses invalid color '${color}'`);
    }
    for (const fabric of [...config.fabricsAllowed, ...config.fabricsBanned]) {
      assert(fabricSet.has(fabric), `${config.id}: fabric list uses invalid fabric '${fabric}'`);
    }
    for (const fit of config.allowedFits) {
      assert(fitSet.has(fit), `${config.id}: allowedFits uses invalid fit '${fit}'`);
    }
    for (const feature of config.bannedFeatures) {
      assert(featureSet.has(feature), `${config.id}: bannedFeatures uses invalid feature '${feature}'`);
    }
    for (const typeName of config.typesBanned ?? []) {
      assert(VALID_TYPE_NAMES.has(typeName), `${config.id}: typesBanned uses invalid typeName '${typeName}'`);
    }
    for (const p of config.attributes.colorPalette) {
      assert(paletteSet.has(p), `${config.id}: attributes.colorPalette uses invalid value '${p}'`);
    }
    for (const s of config.attributes.silhouette) {
      assert(silhouetteSet.has(s), `${config.id}: attributes.silhouette uses invalid value '${s}'`);
    }
    for (const m of config.attributes.mood) {
      assert(moodSet.has(m), `${config.id}: attributes.mood uses invalid value '${m}'`);
    }
    assert(config.popularity >= 0 && config.popularity <= 1, `${config.id}: popularity out of [0,1]`);
    const [min, max] = config.formalityRange;
    assert(min <= max, `${config.id}: formalityRange min > max`);
  }
});

// ─── popularity is differentiated, not flat (sanity check on the new 14) ───

Deno.test('style catalog: the 14 new styles are not all given the same popularity', () => {
  const newIds = new Set(EXPECTED_STYLE_IDS.filter(id => ![
    'oldmoney', 'minimalist', 'streetwear', 'smartcasual', 'preppy', 'athleisure', 'y2k', 'bohemian',
    'glam', 'businessformal', 'gothic', 'utility', 'sporty', 'normcore', 'retro70s', 'pinup', 'whimsigoth',
    'mobwife',
  ].includes(id)));
  const pops = STYLE_CONFIGS.filter(c => newIds.has(c.id)).map(c => c.popularity);
  assertEquals(pops.length, 14);
  assert(new Set(pops).size > 1, 'all 14 new styles have identical popularity — expected differentiated values');
});

// ─── Style catalog expansion batch 2 (2026-08-10) — 22 → 31 ─────────────────
// 9 of the 11 requested styles shipped ('mobwife', 'modest' were stopped for
// a vocabulary gap at the time — see plan.md). gender_lean: all 'feminine'
// except 'businessformal' and 'utility' ('neutral'), per instruction.

const BATCH_2_IDS = ['glam', 'businessformal', 'gothic', 'utility', 'sporty', 'normcore', 'retro70s', 'pinup', 'whimsigoth'];

Deno.test('style catalog batch 2: the 9 new styles are not all given the same popularity', () => {
  const pops = STYLE_CONFIGS.filter(c => BATCH_2_IDS.includes(c.id)).map(c => c.popularity);
  assertEquals(pops.length, 9);
  assert(new Set(pops).size > 1, 'all 9 batch-2 styles have identical popularity — expected differentiated values');
});

// ─── Style catalog expansion batch 3 (2026-08-11) — 31 → 32 ─────────────────
// 'mobwife' unblocked: the 'fur' FabricName value (types.ts) + its
// FABRIC_DEFAULTS/MATERIAL_WARMTH/FABRIC_NAME_MAP entries (enrichment.ts)
// close the vocabulary gap batch 2 stopped on. 'modest' remains stopped —
// its gap (garment coverage/sleeve-hem-neckline) is a missing FitItem
// attribute, not a fabric, and is out of this batch's scope.

Deno.test('style catalog batch 3: mobwife exists with fur in its fabric vocabulary', () => {
  const mobwife = STYLE_CONFIGS.find(c => c.id === 'mobwife');
  assert(mobwife, 'mobwife style config missing');
  assert(mobwife!.fabricsAllowed.includes('fur'), 'mobwife should allow fur — it is the style\'s defining material');
});

// ─── mobwife vs its two nearest neighbors — must differ on at least 2 axes ──
// (design requirement: mobwife must be genuinely distinct from glam/gothic,
// not a relabel of either).

Deno.test('style catalog batch 3: mobwife differs from glam and gothic on at least 2 axes', () => {
  const byId = new Map(STYLE_CONFIGS.map(c => [c.id, c]));
  const mobwife = byId.get('mobwife')!;
  const glam = byId.get('glam')!;
  const gothic = byId.get('gothic')!;

  function countDifferingAxes(a: typeof mobwife, b: typeof mobwife): number {
    let n = 0;
    if (a.formalityRange[0] !== b.formalityRange[0] || a.formalityRange[1] !== b.formalityRange[1]) n++;
    if (JSON.stringify([...a.attributes.colorPalette].sort()) !== JSON.stringify([...b.attributes.colorPalette].sort())) n++;
    if (JSON.stringify([...a.attributes.silhouette].sort()) !== JSON.stringify([...b.attributes.silhouette].sort())) n++;
    if (a.attributes.patternLevel !== b.attributes.patternLevel) n++;
    if (a.attributes.textureRichness !== b.attributes.textureRichness) n++;
    if (JSON.stringify([...a.fabricsAllowed].sort()) !== JSON.stringify([...b.fabricsAllowed].sort())) n++;
    if (JSON.stringify([...a.allowedFits].sort()) !== JSON.stringify([...b.allowedFits].sort())) n++;
    return n;
  }

  assert(countDifferingAxes(mobwife, glam) >= 2, 'mobwife too similar to glam');
  assert(countDifferingAxes(mobwife, gothic) >= 2, 'mobwife too similar to gothic');
});

Deno.test('style catalog batch 3: mobwife has the highest textureRichness in the catalog', () => {
  const mobwife = STYLE_CONFIGS.find(c => c.id === 'mobwife')!;
  const maxOther = Math.max(...STYLE_CONFIGS.filter(c => c.id !== 'mobwife').map(c => c.attributes.textureRichness));
  assert(mobwife.attributes.textureRichness > maxOther,
    `mobwife textureRichness (${mobwife.attributes.textureRichness}) should exceed the rest of the catalog (max ${maxOther})`);
});
