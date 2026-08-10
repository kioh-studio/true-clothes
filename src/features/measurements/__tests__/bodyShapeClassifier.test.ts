// Unit tests for the 2026-08-03 FFIT/Simmons-style body-shape classifier
// rewrite (computeBodyShape), the legacy classifier kept for read-repair
// (computeBodyShapeLegacy), and the noise-resistant hysteresis wrapper
// (stabilizeBodyShape). Table mirrors the 14 archetypes verified in
// scripts/sim/body-shape-sim.ts Section A.

import {
  computeBodyShape, computeBodyShapeLegacy, stabilizeBodyShape,
  type BodyMeasurements, type BodyShape,
} from '../../../types/measurements';

// ─── computeBodyShape — 14-archetype table (mirrors body-shape-sim.ts) ───────

interface Archetype {
  name: string;
  bust?: number;
  waist?: number;
  hip?: number;
  expected: BodyShape | null;
}

const ARCHETYPES: Archetype[] = [
  { name: 'female_hourglass',              bust: 90,  waist: 66, hip: 92,  expected: 'hourglass' },
  { name: 'female_pear_triangle',          bust: 86,  waist: 70, hip: 100, expected: 'triangle' },
  { name: 'female_apple',                  bust: 96,  waist: 88, hip: 96,  expected: 'apple' },
  { name: 'female_rectangle',              bust: 88,  waist: 74, hip: 90,  expected: 'rectangle' },
  { name: 'female_inverted_triangle',      bust: 98,  waist: 76, hip: 88,  expected: 'inverted_triangle' },
  { name: 'male_average',                  bust: 100, waist: 88, hip: 98,  expected: 'rectangle' },
  { name: 'male_athletic_v',               bust: 104, waist: 82, hip: 96,  expected: 'inverted_triangle' },
  { name: 'male_dadbod',                   bust: 104, waist: 100, hip: 102, expected: 'apple' },
  { name: 'slim_male',                     bust: 92,  waist: 78, hip: 94,  expected: 'rectangle' },
  { name: 'petite_hourglass',              bust: 82,  waist: 58, hip: 84,  expected: 'hourglass' },
  { name: 'BOUNDARY_hip_eq_bust_plus5',    bust: 90,  waist: 70, hip: 95,  expected: 'triangle' },
  { name: 'BOUNDARY_waist_eq_0.85bust',    bust: 100, waist: 85, hip: 100, expected: 'rectangle' },
  { name: 'BOUNDARY_waist_eq_0.75bust',    bust: 100, waist: 75, hip: 100, expected: 'hourglass' },
  { name: 'MISSING_waist',                 bust: 90,  hip: 95,             expected: null },
];

function toMeasurements(a: Archetype): BodyMeasurements {
  const m: BodyMeasurements = {};
  if (a.bust !== undefined) m.body_bust = a.bust;
  if (a.waist !== undefined) m.body_waist = a.waist;
  if (a.hip !== undefined) m.body_hip = a.hip;
  return m;
}

describe('computeBodyShape — 14 archetype table', () => {
  test.each(ARCHETYPES)('$name -> $expected', (a) => {
    expect(computeBodyShape(toMeasurements(a))).toBe(a.expected);
  });
});

describe('computeBodyShape — missing measurements', () => {
  test('missing bust -> null', () => {
    expect(computeBodyShape({ body_waist: 70, body_hip: 95 })).toBeNull();
  });
  test('missing hip -> null', () => {
    expect(computeBodyShape({ body_bust: 90, body_waist: 70 })).toBeNull();
  });
  test('all missing -> null', () => {
    expect(computeBodyShape({})).toBeNull();
  });
});

// ─── computeBodyShapeLegacy — pre-2026-08-03 ratio-based rules ──────────────

describe('computeBodyShapeLegacy', () => {
  test('the old apple over-capture: straight column + only mildly-thick waist still reads apple', () => {
    // male_average: bust≈hip, waist only ~12% under bust/hip — the legacy
    // rule's `W >= 0.85*B && W >= 0.85*H` fires with no bust/hip comparison,
    // so it collapses to 'apple' even though the new classifier (and human
    // judgment) reads this as 'rectangle'. This asymmetry is the whole reason
    // computeBodyShapeLegacy exists — to recognise exactly this stale value.
    const m: BodyMeasurements = { body_bust: 100, body_waist: 88, body_hip: 98 };
    expect(computeBodyShapeLegacy(m)).toBe('apple');
    expect(computeBodyShape(m)).toBe('rectangle');
  });

  test('the old strict H > B + 5 boundary excludes an exactly-5cm-bigger hip', () => {
    const m: BodyMeasurements = { body_bust: 90, body_waist: 70, body_hip: 95 };
    // Legacy: strict `>`, so exactly +5 does NOT trigger triangle -> falls to rectangle.
    expect(computeBodyShapeLegacy(m)).toBe('rectangle');
    // New: inclusive `>=`, so it does trigger triangle.
    expect(computeBodyShape(m)).toBe('triangle');
  });

  test('missing measurement -> null, same as the current classifier', () => {
    expect(computeBodyShapeLegacy({ body_bust: 90, body_hip: 95 })).toBeNull();
  });
});

// ─── stabilizeBodyShape — hysteresis ────────────────────────────────────────

describe('stabilizeBodyShape', () => {
  test('passes through the freshly-derived shape when prev is null', () => {
    const m: BodyMeasurements = { body_bust: 90, body_waist: 66, body_hip: 92 }; // hourglass
    expect(stabilizeBodyShape(null, m)).toBe('hourglass');
  });

  test('passes through when next is null (a required measurement is missing)', () => {
    const m: BodyMeasurements = { body_bust: 90, body_hip: 95 }; // waist missing
    expect(stabilizeBodyShape('triangle', m)).toBeNull();
  });

  test('passes through immediately when next matches prev (no ambiguity to resolve)', () => {
    const m: BodyMeasurements = { body_bust: 90, body_waist: 66, body_hip: 92 }; // hourglass
    expect(stabilizeBodyShape('hourglass', m)).toBe('hourglass');
  });

  test('holds prev on a sub-margin flip: hourglass -> apple on a +2cm waist bump is noise', () => {
    // Sim finding (Section B sensitivity): female_hourglass flips to apple at
    // exactly +2cm waist. With prev='hourglass', a ±2cm probe on the waist
    // should still re-derive 'hourglass', so the flip is held back.
    const prev: BodyShape = 'hourglass';
    const bumped: BodyMeasurements = { body_bust: 90, body_waist: 68, body_hip: 92 };
    expect(computeBodyShape(bumped)).not.toBe('hourglass'); // confirms the flip actually happened
    expect(stabilizeBodyShape(prev, bumped)).toBe('hourglass');
  });

  test('accepts a decisive change: a large, unambiguous waist increase is not held back', () => {
    const prev: BodyShape = 'hourglass';
    // +30cm waist is decisively past hourglass under any ±2cm probe.
    const decisive: BodyMeasurements = { body_bust: 90, body_waist: 96, body_hip: 92 };
    const next = computeBodyShape(decisive);
    expect(next).not.toBe('hourglass');
    expect(stabilizeBodyShape(prev, decisive)).toBe(next);
  });

  test('a custom marginCm widens or narrows the noise window', () => {
    const prev: BodyShape = 'hourglass';
    const bumped: BodyMeasurements = { body_bust: 90, body_waist: 68, body_hip: 92 }; // +2cm flip
    // With margin 0, no probing happens beyond the exact values -> next wins immediately.
    expect(stabilizeBodyShape(prev, bumped, 0)).toBe(computeBodyShape(bumped));
  });
});
