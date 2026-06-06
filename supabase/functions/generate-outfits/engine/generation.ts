// Formula pools + candidate generation.
// Merges formulaCatalog.ts + outfitCompositor.ts.

import { FitItem, ItemCategory, PrimaryColor, ColorLightness, OutfitCandidate } from './types.ts';

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

const TYPE_FORMALITY: Record<string, number> = {
  top: 2.5, bottom: 3.0, outwear: 3.5, shoes: 3.0, accessory: 2.5,
};

function estimateFormality(item: FitItem): number {
  let base = TYPE_FORMALITY[item.category] ?? 2.5;
  if (item.fabric.fabricWeight === 'heavy') base += 0.5;
  if (item.fabric.pattern !== 'solid') base -= 0.5;
  if (item.styleTags.includes('oldmoney') || item.styleTags.includes('preppy')) base += 0.5;
  if (item.styleTags.includes('streetwear') || item.styleTags.includes('athleisure')) base -= 0.5;
  return Math.max(1, Math.min(5, base));
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
  const formalTops = cats.top.filter(i => estimateFormality(i) >= 3.5);
  const casualTops = cats.top.filter(i => estimateFormality(i) <= 2.5);
  const formalBottoms = cats.bottom.filter(i => estimateFormality(i) >= 3.5);
  const casualBottoms = cats.bottom.filter(i => estimateFormality(i) <= 2.5);
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface FormulaCandidate extends OutfitCandidate {
  formula: FormulaId;
}

function generateFromPool(pool: FormulaPool): FormulaCandidate[] {
  const tops    = shuffle(pool.tops);
  const bottoms = shuffle(pool.bottoms);
  const shoes   = shuffle(pool.shoes);
  const outwear = shuffle(pool.outwear);
  const accs    = shuffle(pool.accessory);

  if (tops.length === 0 || bottoms.length === 0 || shoes.length === 0) return [];

  const candidates: FormulaCandidate[] = [];
  outer:
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {
        candidates.push({ slots: { top: top.id, bottom: bottom.id, shoes: shoe.id }, formula: pool.formula });
        for (const outer of outwear) {
          candidates.push({ slots: { top: top.id, bottom: bottom.id, shoes: shoe.id, outwear: outer.id }, formula: pool.formula });
          if (candidates.length >= PER_FORMULA_CAP) break outer;
        }
        for (const acc of accs) {
          candidates.push({ slots: { top: top.id, bottom: bottom.id, shoes: shoe.id, accessory: acc.id }, formula: pool.formula });
          if (candidates.length >= PER_FORMULA_CAP) break outer;
        }
        for (const outer of outwear) {
          for (const acc of accs) {
            candidates.push({ slots: { top: top.id, bottom: bottom.id, shoes: shoe.id, outwear: outer.id, accessory: acc.id }, formula: pool.formula });
            if (candidates.length >= PER_FORMULA_CAP) break outer;
          }
        }
        if (candidates.length >= PER_FORMULA_CAP) break outer;
      }
    }
  }
  return candidates;
}

export function generateCandidates(items: FitItem[], preferredFormulas?: FormulaId[]): FormulaCandidate[] {
  const pools = getFormulaPools(items, preferredFormulas);

  if (pools.length === 0) return generateFallback(items);

  const allCandidates: FormulaCandidate[] = [];
  for (const pool of pools) {
    allCandidates.push(...generateFromPool(pool));
    if (allCandidates.length >= GENERATION_CAP) break;
  }
  return allCandidates.slice(0, GENERATION_CAP);
}

function generateFallback(items: FitItem[]): FormulaCandidate[] {
  const byCategory = (cat: ItemCategory) => items.filter(i => i.category === cat);
  const tops    = shuffle(byCategory('top'));
  const bottoms = shuffle(byCategory('bottom'));
  const shoes   = shuffle(byCategory('shoes'));
  if (tops.length === 0 || bottoms.length === 0 || shoes.length === 0) return [];

  const candidates: FormulaCandidate[] = [];
  const defaultFormula: FormulaId = 'one_two_three';
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {
        candidates.push({ slots: { top: top.id, bottom: bottom.id, shoes: shoe.id }, formula: defaultFormula });
        if (candidates.length >= GENERATION_CAP) return candidates;
      }
    }
  }
  return candidates;
}
