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
];
const VALID_FITS: ItemFit[] = ['slim', 'regular', 'relaxed', 'wide', 'oversized'];
const VALID_BANNED_FEATURES: BannedFeature[] = ['loud_logo', 'macro_print', 'full_print', 'neon_color', 'distressed'];
const VALID_COLOR_PALETTES: ColorPalette[] = ['neutral', 'earth', 'bold', 'pastel', 'dark', 'monochrome'];
const VALID_SILHOUETTES: Silhouette[] = ['relaxed', 'structured', 'bodycon', 'oversized', 'tailored'];
const VALID_MOODS: Mood[] = ['playful', 'serious', 'romantic', 'edgy', 'clean', 'artistic'];

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

// ─── (3) neighbors added by the catalog expansion are symmetric ────────────
// Scoped to edges touching at least one of the 14 NEW styles — the task's
// bidirectionality requirement is about this expansion's own additions
// ("thêm style mới làm neighbor của style cũ... hai chiều"), not a retroactive
// fix of the original 8. One pre-existing asymmetry predates this change:
// bohemian → y2k (0.3) and bohemian → athleisure (0.2) were never reciprocated
// (y2k/athleisure's own neighbor lists don't include bohemian) — verified
// against the catalog as it stood before this migration. Left as-is (not this
// task's scope to touch old-old edges) and logged in backlog.md.
const ORIGINAL_8 = new Set([
  'oldmoney', 'minimalist', 'streetwear', 'smartcasual', 'preppy', 'athleisure', 'y2k', 'bohemian',
]);

Deno.test('style catalog: every neighbor edge touching a new style is bidirectional', () => {
  const byId = new Map(STYLE_CONFIGS.map(c => [c.id, c]));
  for (const config of STYLE_CONFIGS) {
    for (const n of config.neighbors) {
      if (ORIGINAL_8.has(config.id) && ORIGINAL_8.has(n.styleId)) continue; // pre-existing old-old edge, out of scope
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
  ].includes(id)));
  const pops = STYLE_CONFIGS.filter(c => newIds.has(c.id)).map(c => c.popularity);
  assertEquals(pops.length, 14);
  assert(new Set(pops).size > 1, 'all 14 new styles have identical popularity — expected differentiated values');
});

// ─── Style catalog expansion batch 2 (2026-08-10) — 22 → 31 ─────────────────
// 9 of the 11 requested styles ('mobwife', 'modest' stopped for a vocabulary
// gap — see plan.md). gender_lean: all 'feminine' except 'businessformal' and
// 'utility' ('neutral'), per instruction.

const BATCH_2_IDS = ['glam', 'businessformal', 'gothic', 'utility', 'sporty', 'normcore', 'retro70s', 'pinup', 'whimsigoth'];

Deno.test('style catalog batch 2: the 9 new styles are not all given the same popularity', () => {
  const pops = STYLE_CONFIGS.filter(c => BATCH_2_IDS.includes(c.id)).map(c => c.popularity);
  assertEquals(pops.length, 9);
  assert(new Set(pops).size > 1, 'all 9 batch-2 styles have identical popularity — expected differentiated values');
});
