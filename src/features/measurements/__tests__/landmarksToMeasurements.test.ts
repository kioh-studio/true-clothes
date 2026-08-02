// Unit tests for keypointsToMeasurements — pure function, no native deps.
// Verifies: plausible output for a 170 cm person with good-quality keypoints;
// missing / low-score landmarks → null; zero/negative height → null;
// out-of-range estimates are omitted (undefined) rather than returned.

import { keypointsToMeasurements, superellipsePerimeter, estimatePersonUnitH, K } from '../landmarksToMeasurements';
import type { Keypoint } from '../poseEstimate';

// ── Synthetic keypoint factory ────────────────────────────────────────────────
// Builds a minimal realistic front-body pose at 170 cm.
// Normalized coordinates represent a person occupying ~80% of a 192×192 square
// image height (top of head near y=0.05, ankles near y=0.95).
//
// Measurements for reference (what we roughly expect from the math):
//   Shoulder span ~ 0.32 units → 170 * 0.32/0.79 ≈ 69 cm → bust ~112 cm (range 60-160 ✓)
//   (exact values depend on K constants; we only assert plausible ranges)

function makeKeypoints(overrides: Partial<Record<string, Partial<Keypoint>>> = {}): Keypoint[] {
  const base: Record<string, Keypoint> = {
    nose:          { name: 'nose',          x: 0.50, y: 0.08, score: 0.92 },
    leftEye:       { name: 'leftEye',       x: 0.53, y: 0.07, score: 0.90 },
    rightEye:      { name: 'rightEye',      x: 0.47, y: 0.07, score: 0.90 },
    leftEar:       { name: 'leftEar',       x: 0.56, y: 0.09, score: 0.85 },
    rightEar:      { name: 'rightEar',      x: 0.44, y: 0.09, score: 0.85 },
    leftShoulder:  { name: 'leftShoulder',  x: 0.66, y: 0.22, score: 0.91 },
    rightShoulder: { name: 'rightShoulder', x: 0.34, y: 0.22, score: 0.91 },
    leftElbow:     { name: 'leftElbow',     x: 0.70, y: 0.42, score: 0.88 },
    rightElbow:    { name: 'rightElbow',    x: 0.30, y: 0.42, score: 0.88 },
    leftWrist:     { name: 'leftWrist',     x: 0.69, y: 0.60, score: 0.83 },
    rightWrist:    { name: 'rightWrist',    x: 0.31, y: 0.60, score: 0.83 },
    leftHip:       { name: 'leftHip',       x: 0.60, y: 0.55, score: 0.90 },
    rightHip:      { name: 'rightHip',      x: 0.40, y: 0.55, score: 0.90 },
    leftKnee:      { name: 'leftKnee',      x: 0.58, y: 0.74, score: 0.87 },
    rightKnee:     { name: 'rightKnee',     x: 0.42, y: 0.74, score: 0.87 },
    leftAnkle:     { name: 'leftAnkle',     x: 0.56, y: 0.93, score: 0.86 },
    rightAnkle:    { name: 'rightAnkle',    x: 0.44, y: 0.93, score: 0.86 },
  };

  for (const [name, patch] of Object.entries(overrides)) {
    if (base[name]) {
      base[name] = { ...base[name], ...patch };
    }
  }

  return Object.values(base);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('keypointsToMeasurements', () => {
  describe('happy path — 170 cm person, all landmarks high-confidence', () => {
    const kps = makeKeypoints();
    const result = keypointsToMeasurements(kps, 170);

    test('returns a non-null result', () => {
      expect(result).not.toBeNull();
    });

    test('bust is in [60, 160] cm', () => {
      expect(result?.body_bust).toBeDefined();
      expect(result!.body_bust!).toBeGreaterThanOrEqual(60);
      expect(result!.body_bust!).toBeLessThanOrEqual(160);
    });

    test('waist is in [50, 150] cm', () => {
      expect(result?.body_waist).toBeDefined();
      expect(result!.body_waist!).toBeGreaterThanOrEqual(50);
      expect(result!.body_waist!).toBeLessThanOrEqual(150);
    });

    test('hip is in [60, 170] cm', () => {
      expect(result?.body_hip).toBeDefined();
      expect(result!.body_hip!).toBeGreaterThanOrEqual(60);
      expect(result!.body_hip!).toBeLessThanOrEqual(170);
    });

    test('inseam is in [60, 100] cm', () => {
      expect(result?.body_inseam).toBeDefined();
      expect(result!.body_inseam!).toBeGreaterThanOrEqual(60);
      expect(result!.body_inseam!).toBeLessThanOrEqual(100);
    });

    test('confidence is between 0 and 1', () => {
      expect(result!.confidence).toBeGreaterThan(0);
      expect(result!.confidence).toBeLessThanOrEqual(1);
    });

    test('all numeric fields are integers (rounded)', () => {
      const { body_bust, body_waist, body_hip, body_inseam } = result!;
      if (body_bust   != null) expect(body_bust   % 1).toBe(0);
      if (body_waist  != null) expect(body_waist  % 1).toBe(0);
      if (body_hip    != null) expect(body_hip    % 1).toBe(0);
      if (body_inseam != null) expect(body_inseam % 1).toBe(0);
    });

    test('waist is less than bust (typical body proportion)', () => {
      expect(result!.body_waist!).toBeLessThan(result!.body_bust!);
    });
  });

  describe('length fields (shoulder width, sleeve, torso)', () => {
    const result = keypointsToMeasurements(makeKeypoints(), 170);

    test('shoulder width is defined and in [30, 65] cm', () => {
      // Upper bound 65, not 60 — widened alongside the shoulder blend's
      // kpShoulderFactor (1.09), which corrects the old systematic narrow
      // bias (see the clamp's doc comment in landmarksToMeasurements.ts).
      expect(result!.body_shoulder_width).toBeDefined();
      expect(result!.body_shoulder_width!).toBeGreaterThanOrEqual(30);
      expect(result!.body_shoulder_width!).toBeLessThanOrEqual(65);
    });

    test('sleeve length is defined and in [40, 85] cm', () => {
      expect(result!.body_sleeve_length).toBeDefined();
      expect(result!.body_sleeve_length!).toBeGreaterThanOrEqual(40);
      expect(result!.body_sleeve_length!).toBeLessThanOrEqual(85);
    });

    test('torso length is defined and in [30, 70] cm', () => {
      expect(result!.body_upper_body_length).toBeDefined();
      expect(result!.body_upper_body_length!).toBeGreaterThanOrEqual(30);
      expect(result!.body_upper_body_length!).toBeLessThanOrEqual(70);
    });

    test('occluded arms (low elbow/wrist score) leave sleeve blank but keep the rest', () => {
      const kps = makeKeypoints({
        leftElbow:  { score: 0.1 }, rightElbow: { score: 0.1 },
        leftWrist:  { score: 0.1 }, rightWrist: { score: 0.1 },
      });
      const r = keypointsToMeasurements(kps, 170);
      expect(r).not.toBeNull();
      expect(r!.body_sleeve_length).toBeUndefined();
      // Core fields still come through (arms are optional).
      expect(r!.body_bust).toBeDefined();
      expect(r!.body_shoulder_width).toBeDefined();
    });
  });

  describe('missing height → null', () => {
    test('returns null for heightCm = 0', () => {
      expect(keypointsToMeasurements(makeKeypoints(), 0)).toBeNull();
    });

    test('returns null for heightCm < 0', () => {
      expect(keypointsToMeasurements(makeKeypoints(), -5)).toBeNull();
    });
  });

  describe('low-confidence required landmarks → null', () => {
    test('low-confidence nose → null', () => {
      const kps = makeKeypoints({ nose: { score: 0.1 } });
      expect(keypointsToMeasurements(kps, 170)).toBeNull();
    });

    test('low-confidence leftShoulder → null', () => {
      const kps = makeKeypoints({ leftShoulder: { score: 0.05 } });
      expect(keypointsToMeasurements(kps, 170)).toBeNull();
    });

    test('low-confidence rightHip → null', () => {
      const kps = makeKeypoints({ rightHip: { score: 0.2 } });
      expect(keypointsToMeasurements(kps, 170)).toBeNull();
    });

    test('low-confidence leftAnkle → null', () => {
      const kps = makeKeypoints({ leftAnkle: { score: 0.0 } });
      expect(keypointsToMeasurements(kps, 170)).toBeNull();
    });
  });

  describe('person barely visible (small normalised height) → null', () => {
    test('nose and ankles too close together → null', () => {
      // Simulates a partial shot: person occupies < 1% of frame vertically
      const kps = makeKeypoints({
        nose:       { y: 0.49 },
        leftAnkle:  { y: 0.50 },
        rightAnkle: { y: 0.50 },
        leftHip:    { y: 0.495 },
        rightHip:   { y: 0.495 },
      });
      expect(keypointsToMeasurements(kps, 170)).toBeNull();
    });
  });

  describe('scale linearity — taller person produces proportionally larger estimates', () => {
    test('180 cm bust > 160 cm bust', () => {
      const kps = makeKeypoints();
      const r160 = keypointsToMeasurements(kps, 160);
      const r180 = keypointsToMeasurements(kps, 180);
      if (r160?.body_bust != null && r180?.body_bust != null) {
        expect(r180.body_bust).toBeGreaterThan(r160.body_bust);
      }
    });
  });

  describe('empty keypoints array → null', () => {
    test('returns null when no keypoints provided', () => {
      expect(keypointsToMeasurements([], 170)).toBeNull();
    });
  });

  describe('BMI depth refinement (optional weight)', () => {
    const kps = makeKeypoints();

    test('omitting weight leaves the average-build estimate unchanged', () => {
      const a = keypointsToMeasurements(kps, 170);
      const b = keypointsToMeasurements(kps, 170, {});
      expect(b).toEqual(a);
    });

    test('heavier build (higher BMI) yields larger circumferences than a leaner one', () => {
      const heavy = keypointsToMeasurements(kps, 170, { weightKg: 95 }); // BMI ~32.9
      const lean  = keypointsToMeasurements(kps, 170, { weightKg: 50 }); // BMI ~17.3
      expect(heavy!.body_bust!).toBeGreaterThan(lean!.body_bust!);
      expect(heavy!.body_waist!).toBeGreaterThan(lean!.body_waist!);
      expect(heavy!.body_hip!).toBeGreaterThan(lean!.body_hip!);
    });

    test('BMI-adjusted estimates stay within the sane ranges', () => {
      const r = keypointsToMeasurements(kps, 170, { weightKg: 95 });
      expect(r!.body_bust!).toBeLessThanOrEqual(160);
      expect(r!.body_waist!).toBeLessThanOrEqual(150);
      expect(r!.body_hip!).toBeLessThanOrEqual(170);
    });

    test('inseam is independent of weight (depth model does not touch length)', () => {
      const a = keypointsToMeasurements(kps, 170, { weightKg: 95 });
      const b = keypointsToMeasurements(kps, 170, { weightKg: 50 });
      expect(a!.body_inseam).toBe(b!.body_inseam);
    });
  });

  describe('sex-specific tunables', () => {
    const kps = makeKeypoints();

    test('no sex == neutral (regression: behaviour unchanged when unknown)', () => {
      const neutral = keypointsToMeasurements(kps, 170);
      const nb      = keypointsToMeasurements(kps, 170, { sex: undefined });
      expect(nb).toEqual(neutral);
    });

    test('female hips read larger than male hips for the same skeleton', () => {
      const f = keypointsToMeasurements(kps, 170, { sex: 'female' });
      const m = keypointsToMeasurements(kps, 170, { sex: 'male' });
      expect(f!.body_hip!).toBeGreaterThan(m!.body_hip!);
    });

    test('male waist reads larger than female waist for the same skeleton', () => {
      const f = keypointsToMeasurements(kps, 170, { sex: 'female' });
      const m = keypointsToMeasurements(kps, 170, { sex: 'male' });
      expect(m!.body_waist!).toBeGreaterThan(f!.body_waist!);
    });

    test('sex-adjusted estimates stay within the sane ranges', () => {
      for (const sex of ['male', 'female'] as const) {
        const r = keypointsToMeasurements(kps, 170, { sex, weightKg: 90 });
        expect(r!.body_bust!).toBeLessThanOrEqual(160);
        expect(r!.body_waist!).toBeLessThanOrEqual(150);
        expect(r!.body_hip!).toBeLessThanOrEqual(170);
      }
    });
  });

  describe('age waist refinement', () => {
    const kps = makeKeypoints();

    test('older subject reads a larger waist than a younger one (visceral fat)', () => {
      const young = keypointsToMeasurements(kps, 170, { ageYears: 25 });
      const older = keypointsToMeasurements(kps, 170, { ageYears: 65 });
      expect(older!.body_waist!).toBeGreaterThan(young!.body_waist!);
    });

    test('age affects waist only, not bust / hip / inseam', () => {
      const young = keypointsToMeasurements(kps, 170, { ageYears: 25 });
      const older = keypointsToMeasurements(kps, 170, { ageYears: 65 });
      expect(older!.body_bust).toBe(young!.body_bust);
      expect(older!.body_hip).toBe(young!.body_hip);
      expect(older!.body_inseam).toBe(young!.body_inseam);
    });

    test('age at or below the threshold has no effect', () => {
      const base = keypointsToMeasurements(kps, 170);
      const at30 = keypointsToMeasurements(kps, 170, { ageYears: 30 });
      expect(at30).toEqual(base);
    });
  });
});

// ── Silhouette-width integration ─────────────────────────────────────────────
// When contour widths are provided they replace the keypoint-span heuristics.

describe('silhouette widths override keypoint heuristics', () => {
  const kps = makeKeypoints();
  // cmPerUnit for this fixture: person spans nose 0.08 → ankles 0.93 = 0.85
  // units / 0.88 → 170 / 0.9659 ≈ 176.0 cm per unit.
  const cmPerUnit = 170 / ((0.93 - 0.08) / 0.88);

  test('shoulder blends the contour term with the keypoint term (shoulderBlendContour default 0.5)', () => {
    // Fixture joint span is 0.32 units (leftShoulder x=0.66, rightShoulder
    // x=0.34, same y). Absent silhouette → the blend degenerates to the
    // keypoint term alone (× kpShoulderFactor, default 1.09).
    const base = keypointsToMeasurements(kps, 170)!;
    const kpTermCm = 0.32 * cmPerUnit * 1.09;
    expect(base.body_shoulder_width).toBe(Math.round(kpTermCm));

    // With a contour reading, the estimate is the 50/50 blend of the contour
    // term (× contourShoulderInset, default 0.96) and the keypoint term above
    // — NOT the contour term alone (the old either/or this replaced).
    const withSil = keypointsToMeasurements(kps, 170, {
      silhouette: { shoulderU: 0.34 },
    })!;
    const contourTermCm = 0.34 * cmPerUnit * 0.96;
    const expectedBlend = Math.round(0.5 * contourTermCm + 0.5 * kpTermCm);
    expect(withSil.body_shoulder_width).toBe(expectedBlend);
  });

  test('a wider contour reading pulls the blended shoulder estimate up', () => {
    // 0.45 deliberately avoided here — for this fixture's cmPerUnit it blends
    // to just past the 65 cm sane-range clamp (undefined), which would make
    // this a bad "wide" fixture value regardless of the direction it's
    // meant to demonstrate.
    const narrow = keypointsToMeasurements(kps, 170, { silhouette: { shoulderU: 0.28 } })!;
    const wide   = keypointsToMeasurements(kps, 170, { silhouette: { shoulderU: 0.38 } })!;
    expect(wide.body_shoulder_width!).toBeGreaterThan(narrow.body_shoulder_width!);
  });

  test('waist girth follows the contour waist width, not the blend guess', () => {
    const narrow = keypointsToMeasurements(kps, 170, { silhouette: { waistU: 0.14 } })!;
    const wide   = keypointsToMeasurements(kps, 170, { silhouette: { waistU: 0.20 } })!;
    expect(narrow.body_waist!).toBeLessThan(wide.body_waist!);
  });

  test('absent silhouette fields fall back to the heuristic values', () => {
    const base = keypointsToMeasurements(kps, 170)!;
    const partial = keypointsToMeasurements(kps, 170, { silhouette: { waistU: 0.16 } })!;
    expect(partial.body_shoulder_width).toBe(base.body_shoulder_width);
    expect(partial.body_hip).toBe(base.body_hip);
  });
});

// ── Mask-extent scale reference (maskExtentU) ────────────────────────────────
// hKp for this fixture: nose y=0.08, avg ankle y=0.93 →
// (0.93-0.08)/0.88 ≈ 0.965909 units.

describe('maskExtentU — scale-blend against the mask-based height estimate', () => {
  const kps = makeKeypoints();
  const hKp = (0.93 - 0.08) / 0.88;

  test('absent maskExtentU leaves behaviour unchanged', () => {
    const base = keypointsToMeasurements(kps, 170);
    const withoutMask = keypointsToMeasurements(kps, 170, {});
    expect(withoutMask).toEqual(base);
  });

  test('in-band agreement blends the mask estimate in and shifts every cm value', () => {
    // hMask ≈ hKp × ~1.05 — a mask that reads somewhat taller than the
    // keypoint span, well inside the disagreement band (8%). Large enough
    // that the shift survives the final integer-cm rounding on every field,
    // not just the larger circumference ones — but not so large that the
    // shift pushes the (already border-adjacent) fixture's inseam under the
    // 60 cm sane-range floor: with only {legacy, mask} candidates present
    // (no heel here), the new survivor-weight scheme renormalises to
    // legacy 0.15/(0.15+0.6)=0.2 vs mask 0.8 — a BIGGER pull toward hMask
    // than the old two-way blend (0.4/0.6) gave for the same raw ratio, so
    // this fixture needed a smaller ratio than the pre-BlazePose version of
    // this test used to stay clear of the clamp.
    const maskExtentU = hKp * 1.02 * 1.05; // × maskExtentFudge default (1.02), then an agreeing bump
    const base = keypointsToMeasurements(kps, 170)!;
    const blended = keypointsToMeasurements(kps, 170, { maskExtentU })!;

    // personUnitH increases slightly (mask agrees the person is a bit taller
    // per unit) → cmPerUnit decreases → every derived cm value shrinks a
    // little relative to the keypoint-only baseline.
    expect(blended.body_bust!).toBeLessThan(base.body_bust!);
    expect(blended.body_shoulder_width!).toBeLessThan(base.body_shoulder_width!);
    expect(blended.body_inseam!).toBeLessThan(base.body_inseam!);
  });

  test('out-of-band disagreement is ignored — falls back to hKp alone', () => {
    // hMask wildly larger than hKp (ratio far above maskExtentAgreeMax) — a
    // leaked/truncated mask must never poison the scale.
    const maskExtentU = hKp * 1.02 * 3;
    const base = keypointsToMeasurements(kps, 170);
    const withBadMask = keypointsToMeasurements(kps, 170, { maskExtentU });
    expect(withBadMask).toEqual(base);
  });

  test('out-of-band disagreement (too small) is also ignored', () => {
    const maskExtentU = hKp * 1.02 * 0.5;
    const base = keypointsToMeasurements(kps, 170);
    const withBadMask = keypointsToMeasurements(kps, 170, { maskExtentU });
    expect(withBadMask).toEqual(base);
  });
});

// ── Heel/toe floor-line scale reference + heel-based inseam (BlazePose) ──────
// hKp for this fixture (unchanged): (0.93-0.08)/0.88 ≈ 0.965909 units.
// The four new landmarks (leftHeel/rightHeel/leftFootIndex/rightFootIndex)
// only ever come from a successful BlazePose refine pass — a pass-1-only
// (17-keypoint) frame simply never has them, which is exactly what every
// OTHER test in this file (using the plain `makeKeypoints()` 17-array)
// already exercises. These tests append the 4 new keypoints explicitly.

describe('heel/toe floor line — survivor-median blend + heel-based inseam', () => {
  const hKp = (0.93 - 0.08) / 0.88;
  const noseCrownFraction = 0.936;

  /** Append heel + toe keypoints (all at the same y, for simplicity) to a
   *  base 17-array — mirrors what a successful BlazePose refine adds. */
  function withFeet(y: number, score = 0.9): Keypoint[] {
    return [
      ...makeKeypoints(),
      { name: 'leftHeel',       x: 0.56, y, score },
      { name: 'rightHeel',      x: 0.44, y, score },
      { name: 'leftFootIndex',  x: 0.58, y, score },
      { name: 'rightFootIndex', x: 0.42, y, score },
    ];
  }

  test('confident heel keypoints shift the inseam even when the scale reference is unaffected', () => {
    // floorY chosen so hHeel == hKp EXACTLY (up to float rounding): the
    // survivor-median blend of {legacy=hKp, heel=hKp} is hKp itself, so
    // personUnitH — and therefore every OTHER field's cm-per-unit scale —
    // is identical to the no-feet baseline. Isolates the inseam-specific
    // "prefer heel over ankle" change from the scale-blend change.
    const floorY = 0.08 + hKp * noseCrownFraction;
    const base = keypointsToMeasurements(makeKeypoints(), 170)!;
    const withHeel = keypointsToMeasurements(withFeet(floorY), 170)!;

    // Scale-driven fields unchanged (personUnitH identical).
    expect(withHeel.body_bust).toBe(base.body_bust);
    expect(withHeel.body_shoulder_width).toBe(base.body_shoulder_width);

    // Inseam differs: heel (floorY, well below the ankle at y=0.93) replaces
    // the ankle as the lower anchor, so hip→heel > hip→ankle.
    const cmPerUnit = 170 / hKp;
    const expectedHeelInseam = Math.round(Math.abs(floorY - 0.55) * cmPerUnit * 0.95);
    expect(withHeel.body_inseam).toBe(expectedHeelInseam);
    expect(withHeel.body_inseam!).toBeGreaterThan(base.body_inseam!);
  });

  test('a heel estimate that disagrees past the band is dropped from the SCALE blend (falls back to hKp)', () => {
    // Deliberately implausible floorY (analogous to the existing out-of-band
    // mask tests' ×3/×0.5 multipliers) so hHeel disagrees with hKp by far
    // more than heightEstimateDisagreementBand (8%) — with only two
    // candidates present, a median-relative disagreement check means BOTH
    // drop together (see blendPersonUnitH's doc comment), falling back to
    // hKp alone for the SCALE reference.
    const floorY = 0.08 + hKp * 0.5 * noseCrownFraction; // hHeel ≈ 0.5×hKp
    const base = keypointsToMeasurements(makeKeypoints(), 170)!;
    const withBadHeel = keypointsToMeasurements(withFeet(floorY), 170)!;

    // Scale unaffected — identical to the no-feet baseline for every
    // scale-driven field.
    expect(withBadHeel.body_bust).toBe(base.body_bust);
    expect(withBadHeel.body_waist).toBe(base.body_waist);
    expect(withBadHeel.body_hip).toBe(base.body_hip);
    expect(withBadHeel.body_shoulder_width).toBe(base.body_shoulder_width);

    // Inseam is a SEPARATE gate (heel score ≥ minScore, independent of
    // whether the scale blend accepted hHeel) — it still switches to the
    // (here, implausible) heel anchor.
    expect(withBadHeel.body_inseam).not.toBe(base.body_inseam);
  });

  test('mask + heel + legacy all agreeing blend with the documented 0.15/0.6/0.25 weights', () => {
    // hMask and hHeel both read ~5% taller than hKp — comfortably within the
    // 8% disagreement band against the 3-value median, so all three survive
    // and blend with maskExtentWeight=0.6, heelWeight=0.25, legacy=0.15
    // (sums to exactly 1 when nothing is dropped).
    const hHeel = hKp * 1.05;
    const floorY = 0.08 + hHeel * noseCrownFraction;
    const maskExtentU = hKp * 1.05 * 1.02; // × maskExtentFudge default (1.02) so hMask = hKp×1.05

    const blended = keypointsToMeasurements(withFeet(floorY), 170, { maskExtentU })!;
    const base = keypointsToMeasurements(makeKeypoints(), 170)!;

    // personUnitH = 0.15×hKp + 0.6×hMask + 0.25×hHeel, all three surviving
    // (weights sum to exactly 1, no renormalisation needed) — bigger than
    // hKp alone, so cmPerUnit (height/personUnitH) is smaller, so every
    // scale-driven field reads smaller than the no-feet/no-mask baseline.
    const expectedPersonUnitH = 0.15 * hKp + 0.6 * hHeel + 0.25 * hHeel;
    expect(expectedPersonUnitH).toBeGreaterThan(hKp);
    expect(blended.body_bust!).toBeLessThan(base.body_bust!);
  });
});

// ── sideDepthsCm — measured side-view depth (2026-07 side-view capture) ────
// Widths (no silhouette override, so the keypoint-heuristic widths apply)
// for this fixture are roughly: chest ~52 cm, waist ~32 cm, hip ~37 cm — the
// chosen sideDepthsCm values below (35/24/28) sit comfortably inside
// sideDepthWidthRatioMin..Max (0.45..1.35) against those widths.

describe('sideDepthsCm — measured side-view depth overrides the BMI-guessed path', () => {
  const kps = makeKeypoints();

  test('a plausible measured depth changes bust/waist/hip vs. the guessed-depth baseline', () => {
    const base = keypointsToMeasurements(kps, 170)!;
    const withSide = keypointsToMeasurements(kps, 170, {
      sideDepthsCm: { chestCm: 35, waistCm: 24, hipCm: 28 },
    })!;
    expect(withSide.body_bust).not.toBe(base.body_bust);
    expect(withSide.body_waist).not.toBe(base.body_waist);
    expect(withSide.body_hip).not.toBe(base.body_hip);
  });

  test('an implausibly THIN measured depth (ratio below sideDepthWidthRatioMin) falls back unchanged', () => {
    const base = keypointsToMeasurements(kps, 170)!;
    const withBadSide = keypointsToMeasurements(kps, 170, {
      sideDepthsCm: { chestCm: 1, waistCm: 1, hipCm: 1 },
    })!;
    expect(withBadSide.body_bust).toBe(base.body_bust);
    expect(withBadSide.body_waist).toBe(base.body_waist);
    expect(withBadSide.body_hip).toBe(base.body_hip);
  });

  test('an implausibly THICK measured depth (ratio above sideDepthWidthRatioMax) also falls back unchanged', () => {
    const base = keypointsToMeasurements(kps, 170)!;
    const withBadSide = keypointsToMeasurements(kps, 170, {
      sideDepthsCm: { chestCm: 200, waistCm: 200, hipCm: 200 },
    })!;
    expect(withBadSide.body_bust).toBe(base.body_bust);
  });

  test('BMI (weight) does NOT affect a field using the measured-depth path', () => {
    const lean = keypointsToMeasurements(kps, 170, {
      weightKg: 50, sideDepthsCm: { chestCm: 35, waistCm: 24, hipCm: 28 },
    })!;
    const heavy = keypointsToMeasurements(kps, 170, {
      weightKg: 95, sideDepthsCm: { chestCm: 35, waistCm: 24, hipCm: 28 },
    })!;
    expect(heavy.body_bust).toBe(lean.body_bust);
    expect(heavy.body_waist).toBe(lean.body_waist);
    expect(heavy.body_hip).toBe(lean.body_hip);
  });

  test('age does NOT affect waist when using the measured-depth path', () => {
    const young = keypointsToMeasurements(kps, 170, { ageYears: 25, sideDepthsCm: { waistCm: 24 } })!;
    const older = keypointsToMeasurements(kps, 170, { ageYears: 65, sideDepthsCm: { waistCm: 24 } })!;
    expect(older.body_waist).toBe(young.body_waist);
  });

  test('per-field fallback: a field with no measured depth still uses the guessed path', () => {
    const base = keypointsToMeasurements(kps, 170)!;
    const partial = keypointsToMeasurements(kps, 170, { sideDepthsCm: { chestCm: 35 } })!;
    expect(partial.body_bust).not.toBe(base.body_bust);
    expect(partial.body_waist).toBe(base.body_waist); // untouched — no waistCm supplied
    expect(partial.body_hip).toBe(base.body_hip);
  });
});

// ── superellipsePerimeter (2026-07) ──────────────────────────────────────────

describe('superellipsePerimeter', () => {
  test('at n=2, the quadrature matches the Ramanujan ellipse-perimeter approximation within 0.2%', () => {
    const a = 30, b = 22; // body-proportioned aspect ratio, not near-degenerate
    // Reference: the SAME Ramanujan formula the module's n=2 fast path uses
    // internally, replicated here (module-private, not imported) purely as
    // independent ground truth for this quadrature correctness check.
    const h = ((a - b) ** 2) / ((a + b) ** 2);
    const ramanujan = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
    const quad = superellipsePerimeter(a, b, 2, 64);
    const relErr = Math.abs(quad - ramanujan) / ramanujan;
    expect(relErr).toBeLessThan(0.002);
  });

  test('a squarer cross-section (n > 2) has a LARGER perimeter than the n=2 ellipse for the same box', () => {
    // Monotonic property of Lamé curves: perimeter increases with n for a
    // fixed bounding box (diamond n=1 < ellipse n=2 < ... < rectangle n→∞).
    const a = 30, b = 22;
    const ellipseLike = superellipsePerimeter(a, b, 2, 64);
    const squarer = superellipsePerimeter(a, b, 2.4, 64);
    expect(squarer).toBeGreaterThan(ellipseLike);
  });
});

// ── estimatePersonUnitH (2026-07, factored out for the side-view scale) ────

describe('estimatePersonUnitH', () => {
  test('matches the legacy nose→ankle span when only that reference is available', () => {
    const kps = makeKeypoints();
    const h = estimatePersonUnitH(kps, undefined, K);
    const expected = Math.abs(0.93 - 0.08) / K.noseAnkleHeightFraction;
    expect(h).toBeCloseTo(expected, 6);
  });

  test('works with only ONE confident ankle — the profile-view case (front gate requires both, this does not)', () => {
    const kps = makeKeypoints({ rightAnkle: { score: 0.05 } });
    const h = estimatePersonUnitH(kps, undefined, K);
    expect(h).not.toBeNull();
    const expected = Math.abs(0.93 - 0.08) / K.noseAnkleHeightFraction; // same y as rightAnkle — identical either way
    expect(h).toBeCloseTo(expected, 6);
  });

  test('null when neither ankle is confident', () => {
    const kps = makeKeypoints({ leftAnkle: { score: 0.05 }, rightAnkle: { score: 0.05 } });
    expect(estimatePersonUnitH(kps, undefined, K)).toBeNull();
  });

  test('null when nose is not confident', () => {
    const kps = makeKeypoints({ nose: { score: 0.05 } });
    expect(estimatePersonUnitH(kps, undefined, K)).toBeNull();
  });
});
