// Formula pools + candidate generation.
// Merges formulaCatalog.ts + outfitCompositor.ts.

import { FitItem, ItemCategory, PrimaryColor, ColorLightness, OutfitCandidate, OutfitSlots } from './types.ts';

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

function getColorFamily(color: PrimaryColor): string {
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
  const baseTops = cats.top.filter(i => i.fabric.layerRole === 'base');
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
const GENERATION_CAP = 500;

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

function generateFromPool(pool: FormulaPool, rand: () => number): FormulaCandidate[] {
  const tops    = shuffle(pool.tops, rand);
  const bottoms = shuffle(pool.bottoms, rand);
  const shoes   = shuffle(pool.shoes, rand);
  const outwear = shuffle(pool.outwear, rand);
  const accs    = shuffle(pool.accessory, rand);

  if (tops.length === 0 || bottoms.length === 0 || shoes.length === 0) return [];

  // Enumerate distinct core triples (top + bottom + shoes).
  const cores: Array<{ top: FitItem; bottom: FitItem; shoe: FitItem }> = [];
  coreLoop:
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {
        cores.push({ top, bottom, shoe });
        if (cores.length >= PER_FORMULA_CAP) break coreLoop;
      }
    }
  }

  // For each core, precompute its DISTINCT full-outfit variants (bare core,
  // +accessory, +outerwear, +both — whichever the pool supports), shuffled.
  // Emitting round-robin (every core's 1st variant before any core's 2nd) keeps
  // core diversity up front while still surfacing multiple distinct MIXES of the
  // same items: duplicate items across outfits are fine, duplicate full outfits
  // are not. Round 0 already yields a natural mix of 3-/4-/5-item outfits.
  const pick = (arr: FitItem[]) => arr[Math.floor(rand() * arr.length)];
  const variantsFor = (c: { top: FitItem; bottom: FitItem; shoe: FitItem }): OutfitSlots[] => {
    const base: OutfitSlots = { top: c.top.id, bottom: c.bottom.id, shoes: c.shoe.id };
    const vs: OutfitSlots[] = [{ ...base }];
    if (accs.length > 0)                       vs.push({ ...base, accessory: pick(accs).id });
    if (outwear.length > 0)                    vs.push({ ...base, outwear: pick(outwear).id });
    if (outwear.length > 0 && accs.length > 0) vs.push({ ...base, outwear: pick(outwear).id, accessory: pick(accs).id });
    return shuffle(vs, rand);
  };
  const coreVariants = cores.map(variantsFor);
  const maxRounds = coreVariants.reduce((m, v) => Math.max(m, v.length), 0);

  const candidates: FormulaCandidate[] = [];
  for (let round = 0; round < maxRounds; round++) {
    for (const vs of coreVariants) {
      if (round >= vs.length) continue;
      candidates.push({ slots: vs[round], formula: pool.formula });
      if (candidates.length >= PER_FORMULA_CAP) return candidates;
    }
  }
  return candidates;
}

// One-piece garments (dress/jumpsuit) fill both core slots themselves (Q29):
// the candidate is onepiece + shoes, optionally layered with outerwear.
// slots.top === slots.bottom === the one-piece id; ranking dedupes item lists.
const ONEPIECE_CAP = 60;

function generateOnepieceCandidates(items: FitItem[], rand: () => number): FormulaCandidate[] {
  const onepieces = shuffle(items.filter(i => i.category === 'onepiece'), rand);
  const shoes     = shuffle(items.filter(i => i.category === 'shoes'), rand);
  const outwear   = shuffle(items.filter(i => i.category === 'outwear'), rand);
  if (onepieces.length === 0 || shoes.length === 0) return [];

  const candidates: FormulaCandidate[] = [];
  for (const op of onepieces) {
    for (const shoe of shoes) {
      candidates.push({ slots: { top: op.id, bottom: op.id, shoes: shoe.id }, formula: 'one_two_three' });
      if (candidates.length >= ONEPIECE_CAP) return candidates;
    }
  }
  for (let i = 0; i < onepieces.length && outwear.length > 0; i++) {
    const op = onepieces[i];
    const shoe = shoes[i % shoes.length];
    candidates.push({
      slots: { top: op.id, bottom: op.id, shoes: shoe.id, outwear: outwear[i % outwear.length].id },
      formula: 'layering_stack',
    });
    if (candidates.length >= ONEPIECE_CAP) break;
  }
  return candidates;
}

export function generateCandidates(items: FitItem[], preferredFormulas?: FormulaId[], seed?: string): FormulaCandidate[] {
  const rand = seed ? mulberry32(hashStr(seed)) : Math.random;
  const pools = getFormulaPools(items, preferredFormulas);
  const onepieceCandidates = generateOnepieceCandidates(items, rand);

  if (pools.length === 0) {
    const fallback = generateFallback(items, rand);
    return [...onepieceCandidates, ...fallback].slice(0, GENERATION_CAP);
  }

  const allCandidates: FormulaCandidate[] = [...onepieceCandidates];
  for (const pool of pools) {
    allCandidates.push(...generateFromPool(pool, rand));
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
