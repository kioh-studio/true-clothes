// Five professional-style comparative drape rounds for DrapeSession — modeled
// on the actual pro draping sequence documented in
// docs/personal-color-v3-research.md §2 (same-hue comparative pairs: tomato
// vs cherry red, mustard vs lemon; a light-vs-deep pair; a clear-vs-soft
// pair; a gold-vs-silver lamé metal-confirmation round). Pure data module —
// no React/native imports — so it's directly Jest-importable; `DrapeSession`
// consumes this list instead of an inline table.
//
// All hexes are CALIBRATION-PENDING draft swatches (matches the
// TONE12_PALETTES/TONE12_BOARDS disclaimer in tone12.ts) — not yet
// colourist-reviewed.
import type { DrapeAxis } from './tone12';

export interface DrapeRound {
  axis: DrapeAxis;
  /** Backing panel colour for the left card — picking it applies direction +1. */
  left: string;
  /** Backing panel colour for the right card — picking it applies direction -1. */
  right: string;
  /** Metal side-effect (round 5 only) — reported alongside the axis pick via
   *  DrapeSession's `onMetal` callback. The hook guards this so it never
   *  clobbers an existing manual metal answer. */
  leftMetal?: 'gold' | 'silver';
  rightMetal?: 'gold' | 'silver';
}

export const DRAPE_ROUNDS: DrapeRound[] = [
  // 1 — warmth: tomato red (warm) vs cherry red (cool)
  { axis: 'warmth', left: '#D9472B', right: '#B01B45' },
  // 2 — warmth: mustard (warm) vs lemon (cool)
  { axis: 'warmth', left: '#D6A319', right: '#EDE43B' },
  // 3 — value: light ivory vs deep charcoal
  { axis: 'value', left: '#E8DCC8', right: '#2E2A3A' },
  // 4 — chroma: clear bright vs soft mauve
  { axis: 'chroma', left: '#C2185B', right: '#A89AA4' },
  // 5 — metal: gold lamé (warm + gold) vs silver lamé (cool + silver)
  { axis: 'warmth', left: '#D4AF37', right: '#C6C9D2', leftMetal: 'gold', rightMetal: 'silver' },
];
