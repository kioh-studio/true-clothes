// Formula pools + candidate generation.
// Merges formulaCatalog.ts + outfitCompositor.ts.

import { FitItem, ItemCategory, PrimaryColor, ColorLightness, OutfitCandidate, OutfitSlots, TargetSilhouette } from './types.ts';
import { VOLUME } from './scoring.ts';
import { pairSilhouetteMatch, measurementPriorityBoost } from './silhouette.ts';

// ─── Formula Definitions ────────────────────────────────────────────────────

export type FormulaId =
  | 'monochrome' | 'neutral_pop' | 'tonal_gradient' | 'high_low'
  | 'texture_stack' | 'pattern_solid' | 'one_two_three'
  | 'rule_of_thirds' | 'layering_stack' | 'contrast_pairing';

export interface FormulaDef {
  id: FormulaId;
  name: string;
  desc: string;
  shortDesc: string;
}

export const FORMULA_CATALOG: FormulaDef[] = [
  { id: 'monochrome',      name: 'Monochrome',       desc: 'One color family across the entire outfit, varied by texture and shade.', shortDesc: 'SINGLE TONE' },
  { id: 'neutral_pop',     name: 'Neutral + Pop',    desc: 'Full neutral base with one bold color accent piece.', shortDesc: 'NEUTRAL + ACCENT' },
  { id: 'tonal_gradient',  name: 'Tonal Gradient',   desc: 'Same hue family arranged from light to dark across layers.', shortDesc: 'TONAL LAYERS' },
  { id: 'high_low',        name: 'High-Low Mix',     desc: 'Deliberate contrast between dressy and casual pieces.', shortDesc: 'HIGH-LOW' },
  { id: 'texture_stack',   name: 'Texture Stack',    desc: 'Three or more distinct fabric textures creating tactile depth.', shortDesc: 'TEXTURE PLAY' },
  { id: 'pattern_solid',   name: 'Pattern + Solid',  desc: 'One patterned statement piece grounded by solid neutrals.', shortDesc: 'PATTERN + SOLID' },
  { id: 'one_two_three',   name: '1-2-3 Rule',       desc: 'One statement piece, two neutrals, and a completing shoe.', shortDesc: '1-2-3 RULE' },
  { id: 'rule_of_thirds',  name: 'Rule of Thirds',   desc: 'Visual weight split at one-third / two-thirds between top and bottom.', shortDesc: 'THIRDS' },
  { id: 'layering_stack',  name: 'Layering Stack',   desc: 'Base layer, mid layer, and outer layer building depth and warmth.', shortDesc: 'LAYERED' },
  { id: 'contrast_pairing',name: 'Contrast Pairing', desc: 'Opposite textures or formality levels create visual tension.', shortDesc: 'CONTRAST' },
];

export const formulaById = (id: FormulaId): FormulaDef | undefined =>
  FORMULA_CATALOG.find(f => f.id === id);

// ─── Style × Formula Matrix ────────────────────────────────────────────────

export const STYLE_FORMULA_MATRIX: Record<string, FormulaId[]> = {
  oldmoney:    ['tonal_gradient', 'neutral_pop', 'one_two_three', 'texture_stack', 'rule_of_thirds', 'layering_stack'],
  minimalist:  ['monochrome', 'tonal_gradient', 'pattern_solid', 'neutral_pop', 'rule_of_thirds'],
  streetwear:  ['high_low', 'texture_stack', 'neutral_pop', 'one_two_three', 'contrast_pairing', 'layering_stack'],
  smartcasual: ['neutral_pop', 'tonal_gradient', 'one_two_three', 'pattern_solid', 'rule_of_thirds'],
  preppy:      ['one_two_three', 'pattern_solid', 'neutral_pop', 'tonal_gradient', 'layering_stack'],
  athleisure:  ['monochrome', 'neutral_pop', 'high_low', 'contrast_pairing'],
  y2k:         ['high_low', 'neutral_pop', 'pattern_solid', 'one_two_three', 'contrast_pairing'],
  bohemian:    ['texture_stack', 'pattern_solid', 'one_two_three', 'tonal_gradient', 'layering_stack', 'contrast_pairing'],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const NEUTRALS = new Set<PrimaryColor>([
  'black', 'white', 'gray', 'charcoal', 'beige', 'cream', 'ivory',
  'tan', 'taupe', 'camel', 'brown', 'khaki', 'natural',
]);

function isNeutral(item: FitItem): boolean {
  return NEUTRALS.has(item.colorProfile.primaryColor);
}

const COLOR_FAMILIES: Record<string, PrimaryColor[]> = {
  blacks: ['black', 'charcoal'],
  whites: ['white', 'cream', 'ivory'],
  blues: ['navy', 'blue', 'teal'],
  greens: ['olive', 'green', 'teal'],
  earths: ['beige', 'tan', 'taupe', 'camel', 'brown', 'khaki', 'natural'],
  reds: ['red', 'burgundy', 'pink'],
  yellows: ['yellow', 'orange'],
  grays: ['gray', 'charcoal'],
};

export function getColorFamily(color: PrimaryColor): string {
  for (const [family, members] of Object.entries(COLOR_FAMILIES)) {
    if (members.includes(color)) return family;
  }
  return 'other';
}


// ─── Formula Pool type ──────────────────────────────────────────────────────

export interface FormulaPool {
  formula: FormulaId;
  tops: FitItem[];
  bottoms: FitItem[];
  shoes: FitItem[];
  outwear: FitItem[];
  accessory: FitItem[];
}

type ByCategory = Record<ItemCategory, FitItem[]>;

function categorize(items: FitItem[]): ByCategory {
  return {
    top: items.filter(i => i.category === 'top'),
    bottom: items.filter(i => i.category === 'bottom'),
    shoes: items.filter(i => i.category === 'shoes'),
    outwear: items.filter(i => i.category === 'outwear'),
    accessory: items.filter(i => i.category === 'accessory'),
    onepiece: items.filter(i => i.category === 'onepiece'),
  };
}

// ─── Pool generators ────────────────────────────────────────────────────────

function poolMonochrome(cats: ByCategory): FormulaPool[] {
  const pools: FormulaPool[] = [];
  const families = new Set<string>();
  for (const item of [...cats.top, ...cats.bottom, ...cats.shoes]) {
    families.add(getColorFamily(item.colorProfile.primaryColor));
  }
  for (const family of families) {
    const inFamily = (item: FitItem) => getColorFamily(item.colorProfile.primaryColor) === family;
    const tops = cats.top.filter(inFamily);
    const bottoms = cats.bottom.filter(inFamily);
    const shoes = cats.shoes.filter(inFamily);
    if (tops.length > 0 && bottoms.length > 0 && shoes.length > 0) {
      pools.push({
        formula: 'monochrome', tops, bottoms, shoes,
        outwear: cats.outwear.filter(inFamily),
        accessory: cats.accessory.filter(inFamily),
      });
    }
  }
  return pools;
}

function poolNeutralPop(cats: ByCategory): FormulaPool[] {
  const neutralTops = cats.top.filter(isNeutral);
  const neutralBottoms = cats.bottom.filter(isNeutral);
  const neutralShoes = cats.shoes.filter(isNeutral);
  if (neutralTops.length === 0 || neutralBottoms.length === 0 || neutralShoes.length === 0) return [];

  const popOutwear = cats.outwear.filter(i => !isNeutral(i));
  const popAccessory = cats.accessory.filter(i => !isNeutral(i));
  const popTops = cats.top.filter(i => !isNeutral(i));
  if (popOutwear.length === 0 && popAccessory.length === 0 && popTops.length === 0) return [];

  return [{
    formula: 'neutral_pop', tops: neutralTops, bottoms: neutralBottoms, shoes: neutralShoes,
    outwear: popOutwear.length > 0 ? popOutwear : [],
    accessory: popAccessory.length > 0 ? popAccessory : [],
  }];
}

function poolTonalGradient(cats: ByCategory): FormulaPool[] {
  const pools: FormulaPool[] = [];
  const families = new Set<string>();
  for (const item of [...cats.top, ...cats.bottom]) {
    families.add(getColorFamily(item.colorProfile.primaryColor));
  }
  for (const family of families) {
    const inFamily = (item: FitItem) => getColorFamily(item.colorProfile.primaryColor) === family;
    const tops = cats.top.filter(inFamily);
    const bottoms = cats.bottom.filter(inFamily);
    if (tops.length === 0 || bottoms.length === 0) continue;
    const lightnesses = new Set([
      ...tops.map(i => i.colorProfile.colorLightness),
      ...bottoms.map(i => i.colorProfile.colorLightness),
    ]);
    if (lightnesses.size < 2) continue;
    pools.push({
      formula: 'tonal_gradient', tops, bottoms,
      shoes: cats.shoes.filter(i => isNeutral(i) || inFamily(i)),
      outwear: cats.outwear.filter(i => isNeutral(i) || inFamily(i)),
      accessory: cats.accessory,
    });
  }
  return pools;
}

function poolHighLow(cats: ByCategory): FormulaPool[] {
  // Uses the enrichment-derived item.formality (type + color + material aware)
  // instead of a category-level estimate that made formal tops unreachable.
  const formalTops = cats.top.filter(i => i.formality >= 3.5);
  const casualTops = cats.top.filter(i => i.formality <= 2.5);
  const formalBottoms = cats.bottom.filter(i => i.formality >= 3.5);
  const casualBottoms = cats.bottom.filter(i => i.formality <= 2.5);
  const pools: FormulaPool[] = [];
  if (formalTops.length > 0 && casualBottoms.length > 0) {
    pools.push({ formula: 'high_low', tops: formalTops, bottoms: casualBottoms, shoes: cats.shoes, outwear: cats.outwear, accessory: cats.accessory });
  }
  if (casualTops.length > 0 && formalBottoms.length > 0) {
    pools.push({ formula: 'high_low', tops: casualTops, bottoms: formalBottoms, shoes: cats.shoes, outwear: cats.outwear, accessory: cats.accessory });
  }
  return pools;
}

function poolTextureStack(cats: ByCategory): FormulaPool[] {
  const allItems = [...cats.top, ...cats.bottom, ...cats.shoes, ...cats.outwear];
  const materials = new Set(allItems.map(i => i.fabric.fabricWeight + '_' + i.fabric.pattern));
  if (materials.size < 3) return [];
  return [{ formula: 'texture_stack', tops: cats.top, bottoms: cats.bottom, shoes: cats.shoes, outwear: cats.outwear, accessory: cats.accessory }];
}

function poolPatternSolid(cats: ByCategory): FormulaPool[] {
  const patternedTops = cats.top.filter(i => i.fabric.pattern !== 'solid');
  const patternedOutwear = cats.outwear.filter(i => i.fabric.pattern !== 'solid');
  const solidTops = cats.top.filter(i => i.fabric.pattern === 'solid');
  const solidBottoms = cats.bottom.filter(i => i.fabric.pattern === 'solid');
  const solidShoes = cats.shoes.filter(i => i.fabric.pattern === 'solid');
  if (solidTops.length === 0 || solidBottoms.length === 0 || solidShoes.length === 0) return [];
  const hasPattern = patternedTops.length > 0 || patternedOutwear.length > 0;
  if (!hasPattern) return [];
  const pools: FormulaPool[] = [];
  if (patternedTops.length > 0) {
    pools.push({
      formula: 'pattern_solid', tops: patternedTops, bottoms: solidBottoms, shoes: solidShoes,
      outwear: cats.outwear.filter(i => i.fabric.pattern === 'solid'),
      accessory: cats.accessory.filter(i => i.fabric.pattern === 'solid'),
    });
  }
  if (patternedOutwear.length > 0) {
    pools.push({
      formula: 'pattern_solid', tops: solidTops, bottoms: solidBottoms, shoes: solidShoes,
      outwear: patternedOutwear,
      accessory: cats.accessory.filter(i => i.fabric.pattern === 'solid'),
    });
  }
  return pools;
}

function poolOneTwoThree(cats: ByCategory): FormulaPool[] {
  const statementTops = cats.top.filter(i => i.colorProfile.colorSaturation === 'vivid' || i.fabric.pattern !== 'solid');
  const neutralTops = cats.top.filter(isNeutral);
  const neutralBottoms = cats.bottom.filter(isNeutral);
  if (neutralBottoms.length === 0) return [];
  const pools: FormulaPool[] = [];
  if (statementTops.length > 0) {
    pools.push({ formula: 'one_two_three', tops: statementTops, bottoms: neutralBottoms, shoes: cats.shoes, outwear: cats.outwear.filter(isNeutral), accessory: cats.accessory });
  }
  const statementOutwear = cats.outwear.filter(i => !isNeutral(i));
  if (neutralTops.length > 0 && statementOutwear.length > 0) {
    pools.push({ formula: 'one_two_three', tops: neutralTops, bottoms: neutralBottoms, shoes: cats.shoes, outwear: statementOutwear, accessory: cats.accessory });
  }
  return pools;
}

function poolRuleOfThirds(cats: ByCategory): FormulaPool[] {
  if (cats.top.length === 0 || cats.bottom.length === 0 || cats.shoes.length === 0) return [];
  return [{ formula: 'rule_of_thirds', tops: cats.top, bottoms: cats.bottom, shoes: cats.shoes, outwear: [], accessory: cats.accessory }];
}

function poolLayeringStack(cats: ByCategory): FormulaPool[] {
  if (cats.outwear.length === 0 || cats.top.length === 0 || cats.bottom.length === 0 || cats.shoes.length === 0) return [];
  // Base OR mid tops sit under outerwear (tee+coat and sweater+coat are both
  // canonical stacks). Before layerRole was derived by type (2026-07-03) every
  // top was 'base', so this filter was a no-op; keeping mid preserves that
  // coverage now that knits/cardigans carry their true 'mid' role.
  const baseTops = cats.top.filter(i => i.fabric.layerRole === 'base' || i.fabric.layerRole === 'mid');
  if (baseTops.length === 0) return [];
  return [{ formula: 'layering_stack', tops: baseTops, bottoms: cats.bottom, shoes: cats.shoes, outwear: cats.outwear, accessory: cats.accessory }];
}

function poolContrastPairing(cats: ByCategory): FormulaPool[] {
  const lightTops = cats.top.filter(i => i.fabric.fabricWeight === 'light');
  const heavyTops = cats.top.filter(i => i.fabric.fabricWeight === 'heavy');
  const lightBottoms = cats.bottom.filter(i => i.fabric.fabricWeight === 'light');
  const heavyBottoms = cats.bottom.filter(i => i.fabric.fabricWeight === 'heavy');
  const pools: FormulaPool[] = [];
  if (lightTops.length > 0 && heavyBottoms.length > 0) {
    pools.push({ formula: 'contrast_pairing', tops: lightTops, bottoms: heavyBottoms, shoes: cats.shoes, outwear: cats.outwear, accessory: cats.accessory });
  }
  if (heavyTops.length > 0 && lightBottoms.length > 0) {
    pools.push({ formula: 'contrast_pairing', tops: heavyTops, bottoms: lightBottoms, shoes: cats.shoes, outwear: cats.outwear, accessory: cats.accessory });
  }
  if (pools.length === 0) {
    const mutedTops = cats.top.filter(i => i.colorProfile.colorSaturation === 'muted');
    const vividBottoms = cats.bottom.filter(i => i.colorProfile.colorSaturation === 'vivid');
    if (mutedTops.length > 0 && vividBottoms.length > 0) {
      pools.push({ formula: 'contrast_pairing', tops: mutedTops, bottoms: vividBottoms, shoes: cats.shoes, outwear: cats.outwear, accessory: cats.accessory });
    }
  }
  return pools;
}

// ─── Get all formula pools ──────────────────────────────────────────────────

export function getFormulaPools(items: FitItem[], preferredFormulas?: FormulaId[]): FormulaPool[] {
  const cats = categorize(items);
  const generators: Record<FormulaId, (cats: ByCategory) => FormulaPool[]> = {
    monochrome: poolMonochrome, neutral_pop: poolNeutralPop, tonal_gradient: poolTonalGradient,
    high_low: poolHighLow, texture_stack: poolTextureStack, pattern_solid: poolPatternSolid,
    one_two_three: poolOneTwoThree, rule_of_thirds: poolRuleOfThirds,
    layering_stack: poolLayeringStack, contrast_pairing: poolContrastPairing,
  };

  const formulasToUse = preferredFormulas && preferredFormulas.length > 0
    ? preferredFormulas
    : FORMULA_CATALOG.map(f => f.id);

  const allPools: FormulaPool[] = [];
  for (const formulaId of formulasToUse) {
    const gen = generators[formulaId];
    if (gen) allPools.push(...gen(cats));
  }
  return allPools;
}

// ─── Candidate generation (from outfitCompositor) ───────────────────────────

const PER_FORMULA_CAP = 80;
export const GENERATION_CAP = 500;

// Seeded RNG so the same user gets the same candidate set within a day —
// keeps exclude_ids paging coherent and results reproducible for debugging.
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface FormulaCandidate extends OutfitCandidate {
  formula: FormulaId;
}

// ─── Anchor-first composition (S2, 2026-07-02) ───────────────────────────────
//
// A stylist doesn't enumerate every combination and grade it — they pick the
// piece the look is BUILT AROUND, then choose each remaining piece FOR the
// pieces already on the table. generateFromPool used to enumerate cores
// round-robin; it now composes them: rank anchors, pick the best-matching
// counterpart for each anchor, then the best shoe for that pair. Deterministic
// (affinity sort with id tie-breaks); the seeded rand only feeds variant picks.

// Reuses scoring.ts's canonical VOLUME map (slim=1 … oversized=5) — do not
// redefine it here.
const FIT_VOLUME: Record<string, number> = VOLUME;
const ANCHOR_CAP = 8;   // anchors considered per pool
const BRANCH = 2;       // counterparts / shoes explored per step

function isTopLike(i: FitItem): boolean {
  return i.category === 'top' || i.category === 'outwear' || i.category === 'onepiece';
}
function isBottomLike(i: FitItem): boolean {
  return i.category === 'bottom' || i.category === 'onepiece';
}

// How well two SPECIFIC pieces sit together — the conditional judgment a
// stylist makes at each pick. Cheap heuristics in [0, 1], formula-aware.
//
// Silhouette-first resolution (2026-07-12): when a `target` is supplied with
// `targetConfidence > 0`, the generic proportion term is confidence-blended
// with how well the pair realizes the target silhouette — but ONLY when {a,b}
// actually contains one top-like and one bottom-like item (a shoe/top or
// shoe/bottom pairAffinity call is unaffected). At targetConfidence === 0
// (fully guessed wardrobe, or no target passed) this is byte-identical to the
// pre-existing generic behaviour.
export function pairAffinity(
  a: FitItem, b: FitItem, formula?: FormulaId,
  target?: TargetSilhouette, targetConfidence = 0,
): number {
  const pa = a.colorProfile, pb = b.colorProfile;

  // Colour relationship: neutrals pair with anything; chromatic pairs follow hue distance.
  let color: number;
  if (pa.hue === undefined || pb.hue === undefined) {
    color = 0.85;
  } else {
    const d = Math.min(Math.abs(pa.hue - pb.hue), 360 - Math.abs(pa.hue - pb.hue));
    color = d <= 30 ? 1.0 : d <= 50 ? 0.85 : (d >= 150 ? 0.9 : d >= 120 ? 0.7 : 0.4);
  }

  // Light/dark interplay: some contrast reads deliberate — except in tonal
  // formulas, where tightness is the concept and the pool already enforces it.
  let light: number;
  if (formula === 'monochrome' || formula === 'tonal_gradient') {
    light = 0.8;
  } else {
    const dl = Math.abs(pa.lum - pb.lum);
    light = dl >= 15 && dl <= 70 ? 1.0 : dl < 15 ? 0.6 : 0.7;
  }

  // Register: neighbours by default; a deliberate split for high_low.
  const df = Math.abs(a.formality - b.formality);
  const formality = formula === 'high_low'
    ? (df >= 1.5 && df <= 3.0 ? 1.0 : df >= 1.0 ? 0.7 : 0.4)
    : Math.max(0, 1 - df / 2.5);

  // Proportion: one fitted piece against one with volume beats two of a kind.
  const dv = Math.abs((FIT_VOLUME[a.fit] ?? 2) - (FIT_VOLUME[b.fit] ?? 2));
  const genericProportion = dv === 1 || dv === 2 ? 1.0 : dv === 0 ? 0.7 : 0.5;

  let proportion = genericProportion;
  if (target && targetConfidence > 0) {
    const top = isTopLike(a) ? a : (isTopLike(b) ? b : undefined);
    const bottom = isBottomLike(b) ? b : (isBottomLike(a) ? a : undefined);
    if (top && bottom && top.id !== bottom.id) {
      const silhouetteMatch = pairSilhouetteMatch(top, bottom, target);
      proportion = (1 - targetConfidence) * genericProportion + targetConfidence * silhouetteMatch;
    }
  }

  // Undertone: warm and cool fight unless one side is neutral.
  const undertone = pa.undertone === 'neutral' || pb.undertone === 'neutral' || pa.undertone === pb.undertone ? 1.0 : 0.5;

  return 0.30 * color + 0.20 * light + 0.25 * formality + 0.15 * proportion + 0.10 * undertone;
}

// Deterministic ordering helpers: affinity desc, id asc as the tie-break.
const byScoreThenId = <T extends { s: number; i: FitItem }>(a: T, b: T) =>
  b.s - a.s || (a.i.id < b.i.id ? -1 : 1);

function generateFromPool(pool: FormulaPool, rand: () => number, target?: TargetSilhouette): FormulaCandidate[] {
  const outwear = shuffle(pool.outwear, rand);
  const accs    = shuffle(pool.accessory, rand);

  if (pool.tops.length === 0 || pool.bottoms.length === 0 || pool.shoes.length === 0) return [];

  // Silhouette-first resolution (2026-07-12): degradable — at conf 0 (no
  // target, or a fully-guessed wardrobe) every boost below is exactly 0 and
  // pairAffinity's blend is a no-op, so this is byte-identical to the
  // pre-existing behaviour. `mBoost` is the SMALL measurement-priority nudge:
  // enough to break a near-tie toward a measured item, never enough to
  // override a real statementStrength/affinity gap ("loudest piece leads").
  const conf = target?.confidence ?? 0;
  const mBoost = (i: FitItem) => (conf > 0 ? measurementPriorityBoost(i) : 0);

  // 1. Anchors: the loudest pieces across tops + bottoms + OUTERWEAR lead
  //    their looks (a statement coat anchors by presence — S2 follow-up,
  //    2026-07-03). Deterministic: statementStrength desc, id tie-break.
  type Core = { top: FitItem; bottom: FitItem; shoe: FitItem; outwear?: FitItem };
  const anchors = [...pool.tops, ...pool.bottoms, ...pool.outwear]
    .map(i => ({ s: i.statementStrength + mBoost(i), i }))
    .sort(byScoreThenId)
    .slice(0, ANCHOR_CAP)
    .map(({ i }) => i);

  // 2. Compose around each anchor: best counterparts FOR the anchor, then the
  //    best shoes FOR each resulting pair (averaged affinity to both pieces).
  const cores: Core[] = [];
  const seenCore = new Set<string>();
  const perAnchor: Core[][] = [];

  for (const anchor of anchors) {
    const looks: Core[] = [];

    if (anchor.category === 'outwear') {
      // Outerwear leads: it is FIXED into the outwear slot and the whole core
      // is composed under it — best top for the coat, best bottom for that
      // pair, best shoes for the result.
      const tops = pool.tops
        .map(i => ({ s: pairAffinity(anchor, i, pool.formula, target, conf) + mBoost(i), i }))
        .sort(byScoreThenId).slice(0, BRANCH).map(({ i }) => i);
      for (const top of tops) {
        const bottom = pool.bottoms
          .map(i => ({
            s: (pairAffinity(top, i, pool.formula, target, conf) + pairAffinity(anchor, i, pool.formula, target, conf)) / 2 + mBoost(i),
            i,
          }))
          .sort(byScoreThenId)[0]?.i;
        if (!bottom) continue;
        const shoes = pool.shoes
          .map(i => ({ s: (pairAffinity(i, top, pool.formula) + pairAffinity(i, bottom, pool.formula)) / 2, i }))
          .sort(byScoreThenId).slice(0, BRANCH).map(({ i }) => i);
        for (const shoe of shoes) looks.push({ top, bottom, shoe, outwear: anchor });
      }
    } else {
      const anchorIsTop = anchor.category !== 'bottom';
      const counterpartPool = anchorIsTop ? pool.bottoms : pool.tops;

      const counterparts = counterpartPool
        .map(i => ({ s: pairAffinity(anchor, i, pool.formula, target, conf) + mBoost(i), i }))
        .sort(byScoreThenId)
        .slice(0, BRANCH)
        .map(({ i }) => i);

      for (const counterpart of counterparts) {
        const top = anchorIsTop ? anchor : counterpart;
        const bottom = anchorIsTop ? counterpart : anchor;
        const shoes = pool.shoes
          .map(i => ({ s: (pairAffinity(i, top, pool.formula) + pairAffinity(i, bottom, pool.formula)) / 2, i }))
          .sort(byScoreThenId)
          .slice(0, BRANCH)
          .map(({ i }) => i);
        for (const shoe of shoes) looks.push({ top, bottom, shoe });
      }
    }
    perAnchor.push(looks);
  }

  // 3. Interleave anchor-major (every anchor's best look before any anchor's
  //    second) so the front of the feed shows DIFFERENT stories, not four
  //    variations of the strongest anchor.
  const maxLooks = perAnchor.reduce((m, l) => Math.max(m, l.length), 0);
  coreLoop:
  for (let round = 0; round < maxLooks; round++) {
    for (const looks of perAnchor) {
      if (round >= looks.length) continue;
      const c = looks[round];
      const key = `${c.top.id}|${c.bottom.id}|${c.shoe.id}|${c.outwear?.id ?? ''}`;
      if (seenCore.has(key)) continue;
      seenCore.add(key);
      cores.push(c);
      if (cores.length >= PER_FORMULA_CAP) break coreLoop;
    }
  }

  // For each core, precompute its DISTINCT full-outfit variants (bare core,
  // +accessory, +outerwear, +both — whichever the pool supports), shuffled.
  // Emitting round-robin (every core's 1st variant before any core's 2nd) keeps
  // core diversity up front while still surfacing multiple distinct MIXES of the
  // same items: duplicate items across outfits are fine, duplicate full outfits
  // are not. Round 0 already yields a natural mix of 3-/4-/5-item outfits.
  const pick = (arr: FitItem[]) => arr[Math.floor(rand() * arr.length)];

  // Dual-role layering (2026-07-03) — an OPTIONAL variant, never a gate: a
  // canLayer top from this pool may occupy the outwear slot OVER a true base
  // top (overshirt/cardigan/knit-over). Physical sanity: the layer must be at
  // least as heavy and not tighter than what's underneath. The bare core is
  // always emitted too, so non-layered outfits are entirely unaffected.
  const WEIGHT_ORDER: Record<string, number> = { light: 0, medium: 1, heavy: 2 };
  const layerables = pool.tops.filter(t => t.canLayer);
  const layerOptionsFor = (baseTop: FitItem): FitItem[] =>
    baseTop.fabric.layerRole === 'base'
      ? layerables.filter(l =>
          l.id !== baseTop.id &&
          WEIGHT_ORDER[l.fabric.fabricWeight] >= WEIGHT_ORDER[baseTop.fabric.fabricWeight] &&
          (FIT_VOLUME[l.fit] ?? 2) >= (FIT_VOLUME[baseTop.fit] ?? 2))
      : [];

  // Mid layer (2026-08-10) — resolved by fabric.layerRole, NOT the coarse
  // CATEGORY_MAP that files both HOODIE and BLAZER under the 'outwear'
  // ItemCategory (see enrichment.ts CATEGORY_MAP / LAYER_ROLE_BY_TYPE). That
  // split is also why the SAME layerRole ('mid') lands in two different
  // ItemCategory buckets today — SWEATER/KNIT/CARDIGAN/VEST under 'top',
  // HOODIE/KIMONO under 'outwear' — so the candidate pool is unified here
  // from BOTH pool.tops and pool.outwear rather than re-deriving that split.
  const midOptions = [...pool.tops, ...pool.outwear].filter(i => i.fabric.layerRole === 'mid');
  // A TRUE outer (blazer/jacket/coat/…) — excludes the mid-role items that
  // also happen to share the 'outwear' ItemCategory (hoodie/kimono), which
  // must never be treated as the true shell for this variant.
  const trueOuterOptions = pool.outwear.filter(i => i.fabric.layerRole === 'outer');
  // CALIBRATION-PENDING: a true outer worn over a HEAVY mid doesn't physically
  // fit (a thick hoodie/heavy knit under a blazer) — banned outright rather
  // than merely discouraged by scoring. Banning heavy mid here already rules
  // out heavy-on-heavy stacking too (a heavy outer over a light/medium mid is
  // still fine, so only the mid side needs the check).
  const midFitsUnderOuter = (mid: FitItem) => mid.fabric.fabricWeight !== 'heavy';

  const variantsFor = (c: Core): OutfitSlots[] => {
    const base: OutfitSlots = { top: c.top.id, bottom: c.bottom.id, shoes: c.shoe.id };
    // Outerwear-anchored core: the coat is fixed — only the accessory (and,
    // when the anchor is a true outer, a mid layer) varies.
    if (c.outwear) {
      base.outwear = c.outwear.id;
      const vs: OutfitSlots[] = [{ ...base }];
      if (accs.length > 0) vs.push({ ...base, accessory: pick(accs).id });
      // Dual-role mid layer (blazer OVER a thin hoodie): only when the anchor
      // is a TRUE outer over a TRUE base top — an anchor that is itself a mid
      // piece (e.g. hoodie anchoring alone) has nothing sensible to layer
      // under it, and a mid-role c.top (e.g. sweater as the base) would double
      // up two mid pieces in one look.
      if (c.outwear.fabric.layerRole === 'outer' && c.top.fabric.layerRole === 'base') {
        const midChoices = midOptions.filter(m =>
          m.id !== c.top.id && m.id !== c.outwear!.id && midFitsUnderOuter(m));
        if (midChoices.length > 0) vs.push({ ...base, mid: pick(midChoices).id });
      }
      return shuffle(vs, rand);
    }
    // Sole-torso gate (2026-08-14) — a bare top (no outwear, no mid) is the
    // ONLY garment on the torso, so it must be able to stand alone; see
    // enrichment.ts's deriveCanBeSoleTop for why this is an opacity check,
    // not a type check. Only the two "nothing else on the torso" variants
    // below are gated (bare, and bare+accessory — an accessory like a belt
    // or bag doesn't cover the torso) — every OTHER variant adds a real
    // outerwear/layer/mid piece over the top, so a sheer top stays fully
    // selectable there, per "not excluded from the wardrobe outright".
    const canBeSole = c.top.canBeSoleTop !== false;
    const vs: OutfitSlots[] = canBeSole ? [{ ...base }] : [];
    if (canBeSole && accs.length > 0)          vs.push({ ...base, accessory: pick(accs).id });
    if (outwear.length > 0)                    vs.push({ ...base, outwear: pick(outwear).id });
    if (outwear.length > 0 && accs.length > 0) vs.push({ ...base, outwear: pick(outwear).id, accessory: pick(accs).id });
    const layers = layerOptionsFor(c.top);
    if (layers.length > 0)                     vs.push({ ...base, outwear: pick(layers).id });
    // Mid + true outer together (2026-08-10): the base top stays fixed, a
    // TRUE outer takes the outwear slot and a compatible mid layers between
    // them — e.g. blazer over a thin hoodie over a tee. Bounded to ONE extra
    // variant, same as the other optional-slot additions above — no
    // combinatorial blowup.
    if (c.top.fabric.layerRole === 'base' && trueOuterOptions.length > 0) {
      const outer = pick(trueOuterOptions);
      const midChoices = midOptions.filter(m =>
        m.id !== c.top.id && m.id !== outer.id && midFitsUnderOuter(m));
      if (midChoices.length > 0) vs.push({ ...base, outwear: outer.id, mid: pick(midChoices).id });
    }
    return shuffle(vs, rand);
  };
  const coreVariants = cores.map(variantsFor);
  const maxRounds = coreVariants.reduce((m, v) => Math.max(m, v.length), 0);

  const candidates: FormulaCandidate[] = [];
  for (let round = 0; round < maxRounds; round++) {
    for (const vs of coreVariants) {
      if (round >= vs.length) continue;
      candidates.push({ slots: vs[round], formula: pool.formula });
      if (candidates.length >= PER_FORMULA_CAP) {
        // Bounded growth: the mid-layer variant above adds at most ONE extra
        // variant per core (same shape as +accessory/+outwear/+layer), so this
        // cap is unchanged from before that feature — logged so a real cutoff
        // is visible rather than silently dropping remaining rounds/cores.
        console.log(`[generate-outfits] formula '${pool.formula}' hit PER_FORMULA_CAP=${PER_FORMULA_CAP} (${cores.length} cores, round ${round}/${maxRounds}) — remaining variants dropped`);
        return candidates;
      }
    }
  }
  return candidates;
}

// One-piece garments (dress/jumpsuit) fill both core slots themselves (Q29):
// the candidate is onepiece + shoes, optionally layered with outerwear and/or
// an accessory. slots.top === slots.bottom === the one-piece id — this is
// DELIBERATE, not a hack: ranking.ts's slotsToIds dedupes the flattened slot
// list before scoring, so downstream code that resolves "the top item" /
// "the bottom item" via `.find(i => i.category === 'top' || 'onepiece')`
// etc. never double-counts a dress. Do not add a separate `onepiece` slot to
// OutfitSlots.
//
// Round-robin matters here for the same reason it does in generateFromPool's
// coreVariants loop (~601-618): with enough dresses × shoes, the cross
// product alone can exceed ONEPIECE_CAP, so if every pair's BARE variant were
// emitted before any pair's dressed-up ones, the cap would exhaust itself on
// bare looks and outerwear/accessory variants would NEVER be reached — a
// dress wardrobe would silently lose its entire layered-look category. Round-
// robin (every pair's Nth variant before any pair's N+1th), combined with
// shuffling each pair's own variant order, spreads the cap truncation evenly
// across bare/+accessory/+outerwear/+both instead of exhausting one class
// first.
const ONEPIECE_CAP = 60;

function generateOnepieceCandidates(items: FitItem[], rand: () => number): FormulaCandidate[] {
  const onepieces = shuffle(items.filter(i => i.category === 'onepiece'), rand);
  const shoes     = shuffle(items.filter(i => i.category === 'shoes'), rand);
  const outwear   = shuffle(items.filter(i => i.category === 'outwear'), rand);
  // Same early-out as before this fix (onepieces/shoes/outwear are shuffled
  // unconditionally either way, exactly as before): a wardrobe with zero
  // onepieces or zero shoes returns [] here having consumed only those three
  // shuffles' worth of `rand`. `accs` is shuffled AFTER this check, not
  // alongside the other three above — every existing fixture (none of which
  // contain a onepiece) hits this early return, so if `accs` were shuffled
  // above, its extra `rand` draws would shift the RNG sequence consumed by
  // every DOWNSTREAM formula-pool call in generateCandidates for wardrobes
  // that never touch this function's real logic at all, silently changing
  // unrelated snapshots. Keeping it below preserves byte-identical output
  // for every onepiece-free wardrobe.
  if (onepieces.length === 0 || shoes.length === 0) return [];
  const accs = shuffle(items.filter(i => i.category === 'accessory'), rand);

  const pick = (arr: FitItem[]) => arr[Math.floor(rand() * arr.length)];

  // (onepiece, shoe) pairs — the same cross product as before, but capped at
  // ONEPIECE_CAP pairs while building it: the worst case is exactly one
  // candidate per pair (an onepiece pool with no outerwear and no
  // accessory), so no more than ONEPIECE_CAP pairs can ever be needed, and
  // capping here keeps a large wardrobe (many dresses × many shoes) from
  // building an unbounded cross product before truncation.
  const pairs: { op: FitItem; shoe: FitItem }[] = [];
  pairLoop:
  for (const op of onepieces) {
    for (const shoe of shoes) {
      pairs.push({ op, shoe });
      if (pairs.length >= ONEPIECE_CAP) break pairLoop;
    }
  }

  // For each pair, its distinct full-outfit variants — bare, +accessory,
  // +outerwear, +both — only including a variant class whose pool is
  // non-empty (same idiom as variantsFor in generateFromPool), then
  // shuffled so no single class systematically leads for every pair.
  //
  // Formula tagging: bare and +accessory stay 'one_two_three' — in the core
  // path a formula is a property of the POOL a core came from, not of which
  // optional slot got filled (an accessory added to a rule_of_thirds core
  // stays 'rule_of_thirds'), so the accessory-only onepiece variant follows
  // its bare sibling rather than getting a formula of its own. Any variant
  // carrying outerwear stays 'layering_stack', matching the pre-existing tag.
  const variantsFor = (op: FitItem, shoe: FitItem): FormulaCandidate[] => {
    const base: OutfitSlots = { top: op.id, bottom: op.id, shoes: shoe.id };
    const vs: FormulaCandidate[] = [{ slots: { ...base }, formula: 'one_two_three' }];
    if (accs.length > 0) {
      vs.push({ slots: { ...base, accessory: pick(accs).id }, formula: 'one_two_three' });
    }
    if (outwear.length > 0) {
      vs.push({ slots: { ...base, outwear: pick(outwear).id }, formula: 'layering_stack' });
    }
    if (outwear.length > 0 && accs.length > 0) {
      vs.push({
        slots: { ...base, outwear: pick(outwear).id, accessory: pick(accs).id },
        formula: 'layering_stack',
      });
    }
    return shuffle(vs, rand);
  };

  const pairVariants = pairs.map(({ op, shoe }) => variantsFor(op, shoe));
  const maxRounds = pairVariants.reduce((m, v) => Math.max(m, v.length), 0);

  const candidates: FormulaCandidate[] = [];
  for (let round = 0; round < maxRounds; round++) {
    for (const vs of pairVariants) {
      if (round >= vs.length) continue;
      candidates.push(vs[round]);
      if (candidates.length >= ONEPIECE_CAP) return candidates;
    }
  }
  return candidates;
}

// ─── Shared inner loop ────────────────────────────────────────────────────────
//
// Builds complete outfit candidates (top + bottom + shoes + optional layers)
// given pre-resolved slot pools expressed as id arrays. Both the pinned path
// (generatePinnedCandidates) and the hero-first path (generateHeroCandidates)
// share this loop so the enumeration logic has ONE source of truth.
//
// fixedOutwear / fixedAccessory — when set, that id is forced into every
// candidate and the corresponding optional pool is skipped. cap limits the
// total returned; rand must be the caller's seeded generator so this function
// consumes its share of the RNG sequence in order.
// Returns [] immediately when any core pool is empty.
function buildAroundFixed(
  topPool: string[], bottomPool: string[], shoePool: string[],
  outwear: string[], accs: string[],
  fixedOutwear: string | undefined, fixedAccessory: string | undefined,
  cap: number, rand: () => number,
): FormulaCandidate[] {
  if (topPool.length === 0 || bottomPool.length === 0 || shoePool.length === 0) return [];

  const pick = (arr: string[]) => arr[Math.floor(rand() * arr.length)];
  const candidates: FormulaCandidate[] = [];

  for (const top of topPool) {
    for (const bottom of bottomPool) {
      for (const shoe of shoePool) {
        const base: OutfitSlots = { top, bottom, shoes: shoe };
        if (fixedOutwear)   base.outwear   = fixedOutwear;
        if (fixedAccessory) base.accessory = fixedAccessory;

        // Distinct variants: bare core, +accessory, +outerwear (only for the
        // optional slots that aren't already fixed by the caller).
        const variants: OutfitSlots[] = [{ ...base }];
        if (!fixedAccessory && accs.length > 0)    variants.push({ ...base, accessory: pick(accs) });
        if (!fixedOutwear   && outwear.length > 0) variants.push({ ...base, outwear:   pick(outwear) });

        for (const v of shuffle(variants, rand)) {
          candidates.push({ slots: v, formula: 'one_two_three' });
          if (candidates.length >= cap) return candidates;
        }
      }
    }
  }
  return candidates;
}

// ─── Pinned candidate generation (Try On / Mix & Match — feature 008) ────────
//
// Builds outfits that ALWAYS contain a transient pinned item (the scanned
// garment the user is considering, not yet in their wardrobe). The pin's slot
// is fixed; the remaining slots are filled from the user's actual wardrobe, so
// every returned candidate is a COMPLETE outfit (top + bottom + footwear core)
// that includes the pin. Scoring/ranking/filtering downstream is unchanged —
// the pin is just another FitItem in the itemMap (contract generate-outfits-pin).
//
// Returns [] when the wardrobe cannot complete an outfit around the pin (e.g.
// pin is a top but there are no bottoms/shoes) → the client's sparse-wardrobe
// state. 100% of returned candidates include the pin (SC-003 / FR-012a).
const PINNED_CAP = 120;

export function generatePinnedCandidates(
  wardrobe: FitItem[], pin: FitItem, seed?: string, target?: TargetSilhouette,
): FormulaCandidate[] {
  const rand = seed ? mulberry32(hashStr(seed)) : Math.random;
  const cats = categorize(wardrobe);

  // Silhouette-first resolution (2026-07-12): at conf 0 (no target passed, or
  // a fully-guessed wardrobe) this is a plain shuffle, byte-identical to the
  // pre-existing behaviour. With confidence, a measured top/bottom surfaces
  // earlier in its pool — a stable sort on top of the seeded shuffle, so it
  // stays deterministic without hard-filtering out any guessed item.
  const conf = target?.confidence ?? 0;
  const orderIds = (arr: FitItem[]): string[] => {
    const shuffled = shuffle(arr, rand);
    if (conf <= 0) return shuffled.map(i => i.id);
    return [...shuffled].sort((a, b) => measurementPriorityBoost(b) - measurementPriorityBoost(a)).map(i => i.id);
  };

  const tops    = orderIds(cats.top);
  const bottoms = orderIds(cats.bottom);
  const shoes   = shuffle(cats.shoes, rand).map(i => i.id);
  const outwear = shuffle(cats.outwear, rand).map(i => i.id);
  const accs    = shuffle(cats.accessory, rand).map(i => i.id);

  const pid = pin.id;

  // Resolve the three core slots, substituting the pin into its own slot.
  // A pinned outerwear/accessory leaves the full core to the wardrobe but is
  // forced into the optional slot of every candidate.
  let topPool = tops, bottomPool = bottoms, shoePool = shoes;
  let fixedOutwear: string | undefined;
  let fixedAccessory: string | undefined;

  switch (pin.category) {
    case 'top':       topPool = [pid]; break;
    case 'bottom':    bottomPool = [pid]; break;
    case 'shoes':     shoePool = [pid]; break;
    case 'onepiece':  topPool = [pid]; bottomPool = [pid]; break;
    case 'outwear':   fixedOutwear = pid; break;
    case 'accessory': fixedAccessory = pid; break;
  }

  // Can't complete the core → no candidates → sparse-wardrobe state.
  if (topPool.length === 0 || bottomPool.length === 0 || shoePool.length === 0) return [];

  return buildAroundFixed(
    topPool, bottomPool, shoePool,
    outwear, accs,
    fixedOutwear, fixedAccessory,
    PINNED_CAP, rand,
  );
}

// ─── Hero-first generation ────────────────────────────────────────────────────
//
// Generates outfits built AROUND high-statement ("hero") items in the user's
// wardrobe. The resulting candidates are merged into the normal pool by index.ts
// so visually striking pieces get featured even when formula scoring would rank
// them lower. Uses buildAroundFixed so enumeration behavior is identical to the
// pinned path.
export const HERO_CAP           = 6;    // max heroes selected per day
export const HERO_PER_CAP       = 24;   // max candidates contributed per hero
export const HERO_MIN_STATEMENT = 2.0;  // minimum heroScore to qualify as a hero
const HERO_PALETTE_BONUS        = 0.5;  // a piece in the user's own palette makes a better hero

// A piece can LEAD a look two ways, and heroScore captures both:
//   • loudly — colour/pattern/graphics (statementStrength), OR
//   • architecturally — a tailored or outerwear piece anchors a look by its CUT
//     even in a quiet neutral. Without this, a minimalist/all-neutral wardrobe
//     (MIEN's target aesthetic) would never get a hero and L3 would do nothing.
// Plus a small nudge when the piece sits in the user's palette, so the featured
// item also matches their taste. All weights tunable.
function structuralPresence(item: FitItem): number {
  let b = 0;
  if (item.category === 'outwear') b += 1.0;                       // outerwear naturally anchors
  if (item.formality >= 4.0) b += 0.8;                             // tailored/formal (blazer, structured trouser)
  else if (item.formality >= 3.5) b += 0.5;
  if (item.fit === 'slim' || item.fit === 'oversized') b += 0.3;  // a deliberate silhouette
  return Math.min(b, 1.8);
}

// A piece the user has actually saved/worn outfits around is a proven hero —
// small additive bonus so their own favourites get featured (L2 follow-up c).
const HERO_FAVOURITE_BONUS = 0.4;

function heroScore(item: FitItem, palette: Set<PrimaryColor>, favourites?: Set<string>): number {
  const paletteBonus = palette.has(item.colorProfile.primaryColor) ? HERO_PALETTE_BONUS : 0;
  const favouriteBonus = favourites?.has(item.id) ? HERO_FAVOURITE_BONUS : 0;
  // Visual interest (đợt 2): a piece the camera says is striking makes a better
  // hero than an equally-categorised plain one. Centered on 0.5, ±0.4 swing.
  const visualBonus = typeof item.visualInterest === 'number' ? (item.visualInterest - 0.5) * 0.8 : 0;
  return item.statementStrength + structuralPresence(item) + paletteBonus + favouriteBonus + visualBonus;
}

export function generateHeroCandidates(
  items: FitItem[], seed?: string, userPalette: PrimaryColor[] = [], favouriteIds?: Set<string>,
  target?: TargetSilhouette,
): FormulaCandidate[] {
  const rand = seed ? mulberry32(hashStr(seed)) : Math.random;

  // Hero-eligible categories: statement pieces that ANCHOR an outfit visually.
  // Shoes and accessories are excluded — they complement rather than lead.
  const eligibleCategories = new Set<ItemCategory>(['top', 'bottom', 'outwear', 'onepiece']);
  const eligible = items.filter(i => eligibleCategories.has(i.category));
  const palette = new Set(userPalette);

  // Silhouette-first resolution (2026-07-12): same degradable measurement
  // boost as generateFromPool — 0 (no-op) unless a target with real
  // confidence is supplied, so existing callers (no 5th arg) are unaffected.
  const conf = target?.confidence ?? 0;
  const mBoost = (i: FitItem) => (conf > 0 ? measurementPriorityBoost(i) : 0);

  // Primary hero pool: rank eligible items by heroScore (loudness + architectural
  // presence + palette affinity), keep those above the threshold, and take at most
  // ONE hero per garment TYPE so the feed isn't six near-identical statement pieces.
  // Deterministic: heroScore desc, id tie-break.
  const ranked = eligible
    .map(i => ({ i, s: heroScore(i, palette, favouriteIds) + mBoost(i) }))
    .filter(({ s }) => s >= HERO_MIN_STATEMENT)
    .sort((a, b) => b.s - a.s || (a.i.id < b.i.id ? -1 : 1));

  let heroes: FitItem[] = [];
  const seenTypes = new Set<string>();
  for (const { i } of ranked) {
    if (seenTypes.has(i.typeName)) continue; // ≤ 1 hero per type — diversify the feature
    heroes.push(i);
    seenTypes.add(i.typeName);
    if (heroes.length >= HERO_CAP) break;
  }

  // Fallback: nothing clears the threshold → feature the single highest-scoring
  // eligible item, but only when it is non-neutral OR architectural (a flat
  // all-neutral basics wardrobe doesn't benefit from a hero → [] avoids a no-op).
  if (heroes.length === 0) {
    const best = eligible
      .map(i => ({ i, s: heroScore(i, palette, favouriteIds) + mBoost(i) }))
      .sort((a, b) => b.s - a.s || (a.i.id < b.i.id ? -1 : 1))[0];
    if (best && (best.i.colorProfile.undertone !== 'neutral' || structuralPresence(best.i) >= 1.0)) {
      heroes = [best.i];
    } else {
      return []; // fully neutral basics wardrobe — no hero treatment needed
    }
  }

  const cats = categorize(items);
  const allCandidates: FormulaCandidate[] = [];

  for (const hero of heroes) {
    const hid = hero.id;

    // Build each pool from the full wardrobe, explicitly excluding the hero
    // from whichever category it belongs to so it can't slip into an optional
    // slot it's already anchoring as the fixed piece.
    // The OPTIONAL flair slots (accessory / non-hero outerwear) stay QUIET — a
    // loud accessory or statement jacket would fight the hero, not support it —
    // so statement pieces (>= HERO_MIN_STATEMENT) are excluded from them. The
    // core slots are left unfiltered; the hero already anchors the look.
    const isQuiet = (i: FitItem) => i.statementStrength < HERO_MIN_STATEMENT;
    const topsAll    = shuffle(cats.top    .filter(i => i.id !== hid), rand).map(i => i.id);
    const bottomsAll = shuffle(cats.bottom .filter(i => i.id !== hid), rand).map(i => i.id);
    const shoesAll   = shuffle(cats.shoes,                              rand).map(i => i.id);
    const outwearAll = shuffle(cats.outwear.filter(i => i.id !== hid && isQuiet(i)), rand).map(i => i.id);
    const accsAll    = shuffle(cats.accessory.filter(isQuiet),                        rand).map(i => i.id);

    // Fix the hero into its own slot; leave the remaining core slots to the
    // wardrobe (same contract as generatePinnedCandidates for a resident item).
    let topPool    = topsAll;
    let bottomPool = bottomsAll;
    let shoePool   = shoesAll;
    let fixedOutwear: string | undefined;
    // fixedAccessory is always undefined — accessories are not eligible heroes.

    switch (hero.category) {
      case 'top':      topPool      = [hid]; break;
      case 'bottom':   bottomPool   = [hid]; break;
      case 'outwear':  fixedOutwear = hid;   break;
      case 'onepiece': topPool = [hid]; bottomPool = [hid]; break;
      default:         break; // unreachable: eligible filter blocks shoes/accessory
    }

    // If the wardrobe can't complete an outfit around this hero, skip it.
    if (topPool.length === 0 || bottomPool.length === 0 || shoePool.length === 0) continue;

    allCandidates.push(...buildAroundFixed(
      topPool, bottomPool, shoePool,
      outwearAll, accsAll,
      fixedOutwear, undefined,
      HERO_PER_CAP, rand,
    ));
  }

  return allCandidates;
}

export function generateCandidates(
  items: FitItem[], preferredFormulas?: FormulaId[], seed?: string, target?: TargetSilhouette,
): FormulaCandidate[] {
  const rand = seed ? mulberry32(hashStr(seed)) : Math.random;
  const pools = getFormulaPools(items, preferredFormulas);
  const onepieceCandidates = generateOnepieceCandidates(items, rand);

  if (pools.length === 0) {
    const fallback = generateFallback(items, rand);
    return [...onepieceCandidates, ...fallback].slice(0, GENERATION_CAP);
  }

  const allCandidates: FormulaCandidate[] = [...onepieceCandidates];
  for (const pool of pools) {
    allCandidates.push(...generateFromPool(pool, rand, target));
    if (allCandidates.length >= GENERATION_CAP) break;
  }
  return allCandidates.slice(0, GENERATION_CAP);
}

function generateFallback(items: FitItem[], rand: () => number): FormulaCandidate[] {
  const byCategory = (cat: ItemCategory) => items.filter(i => i.category === cat);
  const tops    = shuffle(byCategory('top'), rand);
  const bottoms = shuffle(byCategory('bottom'), rand);
  const shoes   = shuffle(byCategory('shoes'), rand);
  const outwear = shuffle(byCategory('outwear'), rand);
  const accs    = shuffle(byCategory('accessory'), rand);
  if (tops.length === 0 || bottoms.length === 0 || shoes.length === 0) return [];

  const pick = (arr: FitItem[]) => arr[Math.floor(rand() * arr.length)];
  const candidates: FormulaCandidate[] = [];
  const defaultFormula: FormulaId = 'one_two_three';
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {
        const slots: OutfitSlots = { top: top.id, bottom: bottom.id, shoes: shoe.id };
        if (outwear.length > 0 && rand() < 0.5)  slots.outwear   = pick(outwear).id;
        if (accs.length > 0    && rand() < 0.55) slots.accessory = pick(accs).id;
        candidates.push({ slots, formula: defaultFormula });
        if (candidates.length >= GENERATION_CAP) return candidates;
      }
    }
  }
  return candidates;
}
