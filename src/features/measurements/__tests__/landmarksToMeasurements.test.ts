// Unit tests for keypointsToMeasurements — pure function, no native deps.
// Verifies: plausible output for a 170 cm person with good-quality keypoints;
// missing / low-score landmarks → null; zero/negative height → null;
// out-of-range estimates are omitted (undefined) rather than returned.

import { keypointsToMeasurements } from '../landmarksToMeasurements';
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

    test('shoulder width is defined and in [30, 60] cm', () => {
      expect(result!.body_shoulder_width).toBeDefined();
      expect(result!.body_shoulder_width!).toBeGreaterThanOrEqual(30);
      expect(result!.body_shoulder_width!).toBeLessThanOrEqual(60);
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

  test('shoulder comes from the contour (× inset), wider than the joint span', () => {
    const base = keypointsToMeasurements(kps, 170)!;
    // Fixture joint span is already 0.32 units; a realistic outer contour is wider.
    const withSil = keypointsToMeasurements(kps, 170, {
      silhouette: { shoulderU: 0.34 },
    })!;
    const expected = Math.round(0.34 * cmPerUnit * 0.96);
    expect(withSil.body_shoulder_width).toBe(expected);
    expect(withSil.body_shoulder_width!).toBeGreaterThan(base.body_shoulder_width!);
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
