import { FitItem } from '../../types/fitEngine';

// Formality consistency scoring using STORED formality values (1.0–5.0).
//
// Items within 1 formality level = natural pairing (score 1.0)
// Items 1.5–2 levels apart = slight mismatch (score 0.6)
// Items 2+ levels apart = clash (score 0.2)
//
// Uses max gap between any two items, not average, because one bad
// mismatch (blazer + gym shorts) ruins the whole outfit.
export function scoreFormalityConsistency(items: FitItem[]): number {
  if (items.length <= 1) return 0.8; // can't evaluate

  const formalities = items.map(i => i.formality);
  const min = Math.min(...formalities);
  const max = Math.max(...formalities);
  const gap = max - min;

  if (gap <= 1.0) return 1.0;   // natural pairing
  if (gap <= 1.5) return 0.8;   // slight stretch — still works
  if (gap <= 2.0) return 0.55;  // noticeable mismatch
  if (gap <= 2.5) return 0.3;   // significant clash
  return 0.15;                    // extreme mismatch (blazer + gym shorts)
}
