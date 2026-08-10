// Unit tests for wardrobeFit.ts
// Mirrors the style of src/stores/__tests__/tryOnStore.test.ts.
// Only totalScore matters for computeWardrobeFit — other ScoredOutfit fields
// are filled via a minimal factory so we don't import the fit engine.

import type { ScoredOutfit } from '../../../types/fitEngine';
import {
  computeWardrobeFit,
  HIGH_MATCH_SCORE,
  TARGET_HIGH_MATCHES,
} from '../wardrobeFit';

// Minimal factory — only totalScore matters for the function under test.
function makeOutfit(totalScore: number): ScoredOutfit {
  return {
    slots: { top: 'top-id', bottom: 'bottom-id', shoes: 'shoe-id' },
    formula: 'test-formula',
    tier: 1,
    styleCoherence: 0,
    colorHarmony: 0,
    fitScore: 0,
    proportionBalance: 0,
    formalityConsistency: 0,
    seasonMatch: 0,
    textureInterest: 0,
    totalScore,
  };
}

describe('computeWardrobeFit', () => {
  it('returns band "none" and barPct 0 for an empty array', () => {
    const result = computeWardrobeFit([]);
    expect(result.band).toBe('none');
    expect(result.barPct).toBe(0);
    expect(result.total).toBe(0);
    expect(result.highCount).toBe(0);
  });

  it('returns band "weak" when all outfits are below HIGH_MATCH_SCORE', () => {
    const outfits = [makeOutfit(0.50), makeOutfit(0.60), makeOutfit(0.69)];
    const result = computeWardrobeFit(outfits);
    expect(result.band).toBe('weak');
    expect(result.total).toBe(3);
    expect(result.highCount).toBe(0);
    expect(result.barPct).toBe(0);
  });

  it('returns band "ok" when exactly 1 outfit meets HIGH_MATCH_SCORE', () => {
    const outfits = [makeOutfit(0.70), makeOutfit(0.60), makeOutfit(0.55)];
    const result = computeWardrobeFit(outfits);
    expect(result.band).toBe('ok');
    expect(result.highCount).toBe(1);
  });

  it('returns band "ok" when 2 outfits meet HIGH_MATCH_SCORE (below TARGET)', () => {
    const outfits = [makeOutfit(0.80), makeOutfit(0.75), makeOutfit(0.55)];
    const result = computeWardrobeFit(outfits);
    expect(result.band).toBe('ok');
    expect(result.highCount).toBe(2);
  });

  it('returns band "great" when highCount >= TARGET_HIGH_MATCHES', () => {
    const outfits = [makeOutfit(0.90), makeOutfit(0.80), makeOutfit(0.70), makeOutfit(0.60)];
    const result = computeWardrobeFit(outfits);
    expect(result.band).toBe('great');
    expect(result.highCount).toBe(3);
    expect(result.barPct).toBe(100);
  });

  it('caps barPct at 100 when highCount exceeds TARGET_HIGH_MATCHES', () => {
    const outfits = [makeOutfit(0.90), makeOutfit(0.85), makeOutfit(0.80), makeOutfit(0.75)];
    const result = computeWardrobeFit(outfits);
    expect(result.highCount).toBe(4);
    expect(result.barPct).toBe(100);
  });

  it('computes barPct as 33 when highCount is 1 (1 / 3 rounded)', () => {
    const outfits = [makeOutfit(0.70), makeOutfit(0.50)];
    const result = computeWardrobeFit(outfits);
    expect(result.highCount).toBe(1);
    expect(result.barPct).toBe(Math.round((1 / TARGET_HIGH_MATCHES) * 100));
    expect(result.barPct).toBe(33);
  });

  it('computes barPct as 67 when highCount is 2 (2 / 3 rounded)', () => {
    const outfits = [makeOutfit(0.75), makeOutfit(0.72), makeOutfit(0.50)];
    const result = computeWardrobeFit(outfits);
    expect(result.highCount).toBe(2);
    expect(result.barPct).toBe(Math.round((2 / TARGET_HIGH_MATCHES) * 100));
    expect(result.barPct).toBe(67);
  });

  it('counts an outfit at exactly HIGH_MATCH_SCORE as a high match', () => {
    const outfits = [makeOutfit(HIGH_MATCH_SCORE)];
    const result = computeWardrobeFit(outfits);
    expect(result.highCount).toBe(1);
    expect(result.band).toBe('ok');
  });

  it('does NOT count an outfit just below HIGH_MATCH_SCORE', () => {
    const outfits = [makeOutfit(HIGH_MATCH_SCORE - 0.001)];
    const result = computeWardrobeFit(outfits);
    expect(result.highCount).toBe(0);
    expect(result.band).toBe('weak');
  });

  it('"ok" explanationParams carries no pluralization suffix when highCount is 1', () => {
    const result = computeWardrobeFit([makeOutfit(0.70), makeOutfit(0.55)]);
    expect(result.band).toBe('ok');
    expect(result.explanationKey).toBe('wardrobeFitRow_ok_explanation');
    expect(result.explanationParams).toEqual({ count: 1, suffix: '' });
  });

  it('"ok" explanationParams carries the pluralization suffix when highCount is 2', () => {
    const result = computeWardrobeFit([makeOutfit(0.75), makeOutfit(0.72), makeOutfit(0.55)]);
    expect(result.band).toBe('ok');
    expect(result.explanationParams).toEqual({ count: 2, suffix: 's' });
  });

  it('exposes i18n keys (not raw English text) for label/explanation per band', () => {
    expect(computeWardrobeFit([]).labelKey).toBe('wardrobeFitRow_none_label');
    expect(computeWardrobeFit([]).explanationKey).toBe('wardrobeFitRow_none_explanation');
    expect(computeWardrobeFit([makeOutfit(0.90), makeOutfit(0.80), makeOutfit(0.70)]).labelKey)
      .toBe('wardrobeFitRow_great_label');
    expect(computeWardrobeFit([makeOutfit(0.50)]).labelKey).toBe('wardrobeFitRow_weak_label');
  });
});
