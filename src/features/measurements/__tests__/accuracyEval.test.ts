// Unit tests for the offline accuracy/calibration harness — pure logic, no
// fs/native deps. Mirrors the synthetic-keypoint style of
// landmarksToMeasurements.test.ts (its own local factory, not imported, to
// keep each test file self-contained).

import {
  evaluateFixture, aggregate, suggestCalibration,
  type Fixture,
} from '../accuracyEval';
import { keypointsToMeasurements, K } from '../landmarksToMeasurements';
import { computeBodyShape } from '../../../types/measurements';
import type { Keypoint } from '../poseEstimate';

// ── Synthetic keypoint factory (same 170 cm pose as landmarksToMeasurements.test.ts) ──

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
    if (base[name]) base[name] = { ...base[name], ...patch };
  }
  return Object.values(base);
}

const HEIGHT_CM = 170;

describe('evaluateFixture — perfect prediction', () => {
  test('groundTruth == predicted → all absError ≈ 0, mae ≈ 0', () => {
    const kps = makeKeypoints();
    const silhouette = { shoulderU: 0.34, chestU: 0.30, waistU: 0.20, hipU: 0.31 };
    const predicted = keypointsToMeasurements(kps, HEIGHT_CM, { silhouette })!;
    expect(predicted).not.toBeNull();

    const fx: Fixture = {
      subjectId: 'perfect-1',
      inputs: { heightCm: HEIGHT_CM },
      keypoints: kps,
      silhouette,
      groundTruth: {
        body_bust: predicted.body_bust,
        body_waist: predicted.body_waist,
        body_hip: predicted.body_hip,
        body_inseam: predicted.body_inseam,
        body_shoulder_width: predicted.body_shoulder_width,
        body_sleeve_length: predicted.body_sleeve_length,
        body_upper_body_length: predicted.body_upper_body_length,
      },
    };

    const result = evaluateFixture(fx);
    expect(result.fields.length).toBeGreaterThan(0);
    for (const fe of result.fields) {
      expect(fe.absError).toBeCloseTo(0, 6);
      expect(fe.signedError).toBeCloseTo(0, 6);
    }

    const agg = aggregate([result]);
    for (const field of Object.keys(agg.perField)) {
      expect(agg.perField[field].mae).toBeCloseTo(0, 6);
      expect(agg.perField[field].bias).toBeCloseTo(0, 6);
      expect(agg.perField[field].rmse).toBeCloseTo(0, 6);
    }
  });
});

describe('aggregate — biased fixture', () => {
  test('groundTruth = predicted × 1.15 on shoulder → suggestMultiplier ≈ 1.15', () => {
    const kps = makeKeypoints();
    const predicted = keypointsToMeasurements(kps, HEIGHT_CM)!;
    const truthShoulder = predicted.body_shoulder_width! * 1.15;

    const fx: Fixture = {
      subjectId: 'biased-1',
      inputs: { heightCm: HEIGHT_CM },
      keypoints: kps,
      groundTruth: { body_shoulder_width: truthShoulder },
    };

    const result = evaluateFixture(fx);
    const agg = aggregate([result]);
    expect(agg.perField.body_shoulder_width.suggestMultiplier).toBeCloseTo(1.15, 2);
  });
});

describe('aggregate — body-shape accuracy', () => {
  test('one matching fixture + one mismatching fixture → shapeAccuracy == 0.5', () => {
    const kps = makeKeypoints();
    const predicted = keypointsToMeasurements(kps, HEIGHT_CM)!;
    const predictedShape = computeBodyShape(predicted);
    expect(predictedShape).not.toBeNull();

    const matching: Fixture = {
      subjectId: 'match-1',
      inputs: { heightCm: HEIGHT_CM },
      keypoints: kps,
      groundTruth: {
        body_bust: predicted.body_bust,
        body_waist: predicted.body_waist,
        body_hip: predicted.body_hip,
      },
    };

    // Force a DIFFERENT shape bucket than whatever predictedShape actually is,
    // so this test never depends on the exact numbers the model produces.
    const mismatchBWH = predictedShape !== 'apple'
      ? { body_bust: 100, body_waist: 95, body_hip: 100 } // apple: W >= 0.85*B && W >= 0.85*H
      : { body_bust: 100, body_waist: 70, body_hip: 100 }; // hourglass: |B-H|<=5 && W <= 0.75*B
    expect(computeBodyShape(mismatchBWH)).not.toBe(predictedShape);

    const mismatching: Fixture = {
      subjectId: 'mismatch-1',
      inputs: { heightCm: HEIGHT_CM },
      keypoints: kps,
      groundTruth: mismatchBWH,
    };

    const results = [evaluateFixture(matching), evaluateFixture(mismatching)];
    expect(results[0].shapeCorrect).toBe(true);
    expect(results[1].shapeCorrect).toBe(false);

    const agg = aggregate(results);
    expect(agg.shapeAccuracy).toBeCloseTo(0.5, 6);
  });
});

describe('suggestCalibration', () => {
  test('recovers an injected shoulder-width bias via contourShoulderInset', () => {
    const kps = makeKeypoints();
    const silhouette = { shoulderU: 0.34 };
    const baseline = keypointsToMeasurements(kps, HEIGHT_CM, { silhouette })!;
    const targetFactor = 1.1;
    const truthShoulder = Math.round(baseline.body_shoulder_width! * targetFactor);

    const fixture: Fixture = {
      subjectId: 'calib-1',
      inputs: { heightCm: HEIGHT_CM },
      keypoints: kps,
      silhouette,
      groundTruth: { body_shoulder_width: truthShoulder },
    };

    const { tunables, beforeMae, afterMae } = suggestCalibration([fixture], ['contourShoulderInset']);

    expect(afterMae).toBeLessThan(beforeMae);
    // Grid step spacing is (1.3-0.7)/12 = 0.05, so "moved toward 1.1" means
    // landing within one grid step of it (rounding of the cm ground-truth
    // value can tie-break to the neighbouring grid point).
    const foundFactor = tunables.contourShoulderInset! / K.contourShoulderInset;
    expect(Math.abs(foundFactor - targetFactor)).toBeLessThanOrEqual(0.06);
  });
});
