import { FitItem, OutfitCandidate, ItemCategory } from '../../types/fitEngine';
import { FormulaId, FormulaPool, getFormulaPools } from './formulaCatalog';

const TOP_N = 24;
// Per-formula cap to ensure diversity across formulas
const PER_FORMULA_CAP = 80;
// Total cap across all formulas — ranker trims to TOP_N
const GENERATION_CAP = 500;

// Fisher-Yates shuffle
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

// Generate candidates from a single formula pool
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
        // Bare minimum
        candidates.push({ slots: { top: top.id, bottom: bottom.id, shoes: shoe.id }, formula: pool.formula });

        // + outerwear
        for (const outer of outwear) {
          candidates.push({
            slots: { top: top.id, bottom: bottom.id, shoes: shoe.id, outwear: outer.id },
            formula: pool.formula,
          });
          if (candidates.length >= PER_FORMULA_CAP) break outer;
        }

        // + accessory
        for (const acc of accs) {
          candidates.push({
            slots: { top: top.id, bottom: bottom.id, shoes: shoe.id, accessory: acc.id },
            formula: pool.formula,
          });
          if (candidates.length >= PER_FORMULA_CAP) break outer;
        }

        // + both
        for (const outer of outwear) {
          for (const acc of accs) {
            candidates.push({
              slots: { top: top.id, bottom: bottom.id, shoes: shoe.id, outwear: outer.id, accessory: acc.id },
              formula: pool.formula,
            });
            if (candidates.length >= PER_FORMULA_CAP) break outer;
          }
        }

        if (candidates.length >= PER_FORMULA_CAP) break outer;
      }
    }
  }

  return candidates;
}

// Main entry: formula-based candidate generation
// Each candidate is tagged with the formula that generated it.
export function generateCandidates(
  items: FitItem[],
  preferredFormulas?: FormulaId[],
): FormulaCandidate[] {
  const pools = getFormulaPools(items, preferredFormulas);

  if (pools.length === 0) {
    // Fallback: if no formulas produce pools (tiny wardrobe), do basic combos
    return generateFallback(items);
  }

  const allCandidates: FormulaCandidate[] = [];

  for (const pool of pools) {
    const poolCandidates = generateFromPool(pool);
    allCandidates.push(...poolCandidates);
    if (allCandidates.length >= GENERATION_CAP) break;
  }

  return allCandidates.slice(0, GENERATION_CAP);
}

// Fallback: minimal brute-force for very small wardrobes that match no formula
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
        candidates.push({
          slots: { top: top.id, bottom: bottom.id, shoes: shoe.id },
          formula: defaultFormula,
        });
        if (candidates.length >= GENERATION_CAP) return candidates;
      }
    }
  }

  return candidates;
}
