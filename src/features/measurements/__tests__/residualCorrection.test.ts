import { applyResidualCorrection, MAX_CORRECTION_CM, type ResidualCoeffs } from '../residualCorrection';
import type { EstimatedMeasurements } from '../../../types/measurements';

const zero = { app: 0, h: 0, w: 0, bmi: 0, side: 0 };
const coeffs: ResidualCoeffs = {
  male: {
    body_bust: { ...zero, b0: 100 },  // huge -> clamped
    body_waist: { ...zero, b0: 2 },
    body_hip: { ...zero, b0: 2 },
  },
};
const inp = { sex: 'male' as const, heightCm: 175, weightKg: 70 };
const est = (o: Partial<EstimatedMeasurements>): EstimatedMeasurements => ({ confidence: 1, ...o });

describe('applyResidualCorrection', () => {
  test('clamps to +-MAX_CORRECTION_CM', () => {
    expect(applyResidualCorrection(est({ body_bust: 90 }), inp, coeffs).body_bust).toBe(90 + MAX_CORRECTION_CM);
  });
  test('missing field stays missing', () => {
    expect(applyResidualCorrection(est({ body_bust: 90 }), inp, coeffs).body_waist).toBeUndefined();
  });
  test('outlier field untouched, others corrected', () => {
    const r = applyResidualCorrection(est({ body_waist: 80, body_hip: 95, outliers: ['body_waist'] }), inp, coeffs);
    expect(r.body_waist).toBe(80);
    expect(r.body_hip).toBe(97);
  });
  test('no coefficients / missing inputs -> unchanged', () => {
    const e = est({ body_bust: 90 });
    expect(applyResidualCorrection(e, inp, {})).toEqual(e);
    expect(applyResidualCorrection(e, { sex: 'male' }, coeffs)).toBe(e);
  });
});
