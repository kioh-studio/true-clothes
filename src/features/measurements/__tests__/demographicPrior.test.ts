import { demographicPrior, fuseWithPrior } from '../demographicPrior';
import type { EstimatedMeasurements } from '../../../types/measurements';

const est = (over: Partial<EstimatedMeasurements>): EstimatedMeasurements => ({ confidence: 1, ...over });

describe('demographicPrior', () => {
  test('170 cm / 65 kg / 30 y male gives plausible means', () => {
    const p = demographicPrior('male', 170, 65, 30)!;
    expect(p.waist.mean).toBeGreaterThanOrEqual(70);
    expect(p.waist.mean).toBeLessThanOrEqual(85);
    expect(p.hip.mean).toBeGreaterThanOrEqual(88);
    expect(p.hip.mean).toBeLessThanOrEqual(98);
    expect(p.bust.mean).toBeGreaterThanOrEqual(88);
    expect(p.bust.mean).toBeLessThanOrEqual(100);
  });

  test('undefined sex or missing weight/height → null', () => {
    expect(demographicPrior(undefined, 170, 65, 30)).toBeNull();
    expect(demographicPrior('male', 170, undefined, 30)).toBeNull();
    expect(demographicPrior('female', undefined, 60, 30)).toBeNull();
  });

  test('missing age defaults to 30', () => {
    expect(demographicPrior('female', 160, 55)).toEqual(demographicPrior('female', 160, 55, 30));
  });
});

describe('fuseWithPrior', () => {
  const prior = {
    bust: { mean: 90, sd: 4 }, waist: { mean: 80, sd: 4 }, hip: { mean: 100, sd: 4 },
  };

  test('equal SDs → midpoint', () => {
    const r = fuseWithPrior(est({ body_bust: 94, depthSource: { bust: 'guess' } }), prior);
    expect(r.body_bust).toBe(92); // sdScan(guess)=4 == prior sd 4
  });

  test('side source weights the scan more than guess', () => {
    const side = fuseWithPrior(est({ body_bust: 98, depthSource: { bust: 'side' } }), prior);
    const guess = fuseWithPrior(est({ body_bust: 98, depthSource: { bust: 'guess' } }), prior);
    expect(side.body_bust!).toBeGreaterThan(guess.body_bust!);
  });

  test('outlier is flagged and the raw scan kept', () => {
    const e = est({ body_hip: 140, depthSource: { hip: 'side' } });
    const r = fuseWithPrior(e, prior);
    expect(r.body_hip).toBe(140);
    expect(r.outliers).toEqual(['body_hip']);
  });

  test('missing scan field stays undefined, input not mutated', () => {
    const e = est({ body_bust: 94 });
    const r = fuseWithPrior(e, prior);
    expect(r.body_waist).toBeUndefined();
    expect(r.body_hip).toBeUndefined();
    expect(r).not.toBe(e);
    expect(e.body_bust).toBe(94);
  });

  test('null prior returns the estimate unchanged', () => {
    const e = est({ body_bust: 94 });
    expect(fuseWithPrior(e, null)).toEqual(e);
  });
});
