// Try On (feature 008) — Wardrobe-fit signal.
// Pure module, no React. Consumes the outfits returned by fetchMixMatchOutfits
// and derives a human-readable quality band plus display values for the UI.
// NOT folded into the server's /100 verdict score — this is a client-side signal.

import type { ScoredOutfit } from '../../types/fitEngine';

/** The engine already drops outfits below 0.50; "high" means a confidently good
 *  pairing between the scanned item and the user's existing wardrobe. */
export const HIGH_MATCH_SCORE = 0.70;

/** How many high-quality outfits we treat as "fits your wardrobe well". */
export const TARGET_HIGH_MATCHES = 3;

export type WardrobeFitBand = 'great' | 'ok' | 'weak' | 'none';

export interface WardrobeFitInfo {
  /** Total outfits the engine could build around the item (all scored >= 0.50). */
  total: number;
  /** Of those, the count with totalScore >= HIGH_MATCH_SCORE (0.70). */
  highCount: number;
  band: WardrobeFitBand;
  /** 0..100; proportional to highCount / TARGET_HIGH_MATCHES, capped at 100. */
  barPct: number;
  /** Short headline for the row. */
  label: string;
  /** One-line supporting reason. */
  explanation: string;
}

export function computeWardrobeFit(outfits: ScoredOutfit[]): WardrobeFitInfo {
  const total = outfits.length;
  const highCount = outfits.filter((o) => o.totalScore >= HIGH_MATCH_SCORE).length;

  let band: WardrobeFitBand;
  if (highCount >= TARGET_HIGH_MATCHES) {
    band = 'great';
  } else if (highCount >= 1) {
    band = 'ok';
  } else if (total > 0) {
    band = 'weak';
  } else {
    band = 'none';
  }

  const barPct = Math.round(Math.min(1, highCount / TARGET_HIGH_MATCHES) * 100);

  let label: string;
  let explanation: string;

  switch (band) {
    case 'great':
      label = 'Pairs beautifully';
      explanation = `Builds ${highCount} strong outfits with what you already own.`;
      break;
    case 'ok':
      label = 'Works with your closet';
      explanation = `Builds ${highCount} solid outfit${highCount === 1 ? '' : 's'} from your wardrobe.`;
      break;
    case 'weak':
      label = 'A bit of a stretch';
      explanation = 'We can pair it, but nothing stands out from your current wardrobe.';
      break;
    case 'none':
    default:
      label = 'Hard to pair';
      explanation = "Your wardrobe doesn't have enough to build an outfit around this yet.";
      break;
  }

  return { total, highCount, band, barPct, label, explanation };
}
