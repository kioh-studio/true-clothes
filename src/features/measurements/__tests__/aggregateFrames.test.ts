// Unit tests for multi-frame aggregation — pure math, no native deps.
import {
  medianKeypoints, medianWidths, medianExtent, scaleAgreement, rejectOutlierFrames,
} from '../aggregateFrames';
import type { Keypoint } from '../poseEstimate';
import type { SilhouetteWidths } from '../silhouetteMath';

/** A well-framed, square-on standing pose (same shape used in poseQuality tests). */
function goodPose(over: Partial<Record<string, Partial<Keypoint>>> = {}): Keypoint[] {
  const base: Record<string, Keypoint> = {
    nose:          { name: 'nose',          x: 0.50, y: 0.08, score: 0.95 },
    leftShoulder:  { name: 'leftShoulder',  x: 0.62, y: 0.22, score: 0.93 },
    rightShoulder: { name: 'rightShoulder', x: 0.38, y: 0.22, score: 0.93 },
    leftHip:       { name: 'leftHip',       x: 0.58, y: 0.55, score: 0.90 },
    rightHip:      { name: 'rightHip',      x: 0.42, y: 0.55, score: 0.90 },
    leftAnkle:     { name: 'leftAnkle',     x: 0.55, y: 0.92, score: 0.88 },
    rightAnkle:    { name: 'rightAnkle',    x: 0.45, y: 0.92, score: 0.88 },
  };
  for (const [k, v] of Object.entries(over)) base[k] = { ...base[k], ...v } as Keypoint;
  return Object.values(base);
}

describe('medianKeypoints', () => {
  test('median of 3 frames returns the middle value per axis', () => {
    const frames = [
      goodPose({ nose: { x: 0.40, y: 0.06, score: 0.90 } }),
      goodPose({ nose: { x: 0.50, y: 0.08, score: 0.95 } }),
      goodPose({ nose: { x: 0.60, y: 0.10, score: 0.99 } }),
    ];
    const agg = medianKeypoints(frames);
    const nose = agg.find((k) => k.name === 'nose')!;
    expect(nose.x).toBeCloseTo(0.50, 5);
    expect(nose.y).toBeCloseTo(0.08, 5);
    expect(nose.score).toBeCloseTo(0.95, 5);
  });

  test('a single wild outlier frame does not move the median', () => {
    const frames = [
      goodPose({ nose: { x: 0.50 } }),
      goodPose({ nose: { x: 0.51 } }),
      goodPose({ nose: { x: 0.02 } }), // wild outlier — e.g. a mis-detection
    ];
    const agg = medianKeypoints(frames);
    const nose = agg.find((k) => k.name === 'nose')!;
    // Median of [0.02, 0.50, 0.51] is 0.50 — the outlier is ignored, not blended in.
    expect(nose.x).toBeCloseTo(0.50, 5);
  });

  test('keypoint never clearing minScore falls back to the median over all frames', () => {
    const frames = [
      goodPose({ leftAnkle: { score: 0.1, y: 0.80 } }),
      goodPose({ leftAnkle: { score: 0.2, y: 0.82 } }),
      goodPose({ leftAnkle: { score: 0.15, y: 0.84 } }),
    ];
    const agg = medianKeypoints(frames);
    const ankle = agg.find((k) => k.name === 'leftAnkle')!;
    // None clear 0.3 → falls back to the median over all 3 (not dropped/zeroed).
    expect(ankle.y).toBeCloseTo(0.82, 5);
    expect(ankle.score).toBeCloseTo(0.15, 5);
  });

  test('empty input returns empty output', () => {
    expect(medianKeypoints([])).toEqual([]);
  });
});

describe('medianWidths', () => {
  test('per-field median over non-null values', () => {
    const widths: (SilhouetteWidths | null)[] = [
      { shoulderU: 0.40, waistU: 0.30 },
      { shoulderU: 0.42, waistU: 0.32 },
      { shoulderU: 0.44, waistU: 0.34 },
    ];
    const agg = medianWidths(widths);
    expect(agg.shoulderU).toBeCloseTo(0.42, 5);
    expect(agg.waistU).toBeCloseTo(0.32, 5);
    expect(agg.chestU).toBeUndefined();
    expect(agg.hipU).toBeUndefined();
  });

  test('handles nulls and partial fields', () => {
    const widths: (SilhouetteWidths | null)[] = [
      null,
      { chestU: 0.35 },
      { chestU: 0.37, hipU: 0.50 },
    ];
    const agg = medianWidths(widths);
    expect(agg.chestU).toBeCloseTo(0.36, 5);
    expect(agg.hipU).toBeCloseTo(0.50, 5);
    expect(agg.shoulderU).toBeUndefined();
    expect(agg.waistU).toBeUndefined();
  });

  test('all-null input returns an empty object', () => {
    expect(medianWidths([null, null])).toEqual({});
  });
});

describe('medianExtent', () => {
  test('median of present values', () => {
    expect(medianExtent([0.90, 0.92, 0.94])).toBeCloseTo(0.92, 6);
  });

  test('drops nulls/undefined and medians the rest', () => {
    expect(medianExtent([null, 0.80, undefined, 0.84])).toBeCloseTo(0.82, 6);
  });

  test('undefined when nothing is present', () => {
    expect(medianExtent([null, undefined])).toBeUndefined();
    expect(medianExtent([])).toBeUndefined();
  });
});

describe('scaleAgreement', () => {
  test('returns ~0 for identical frames', () => {
    const frames = [goodPose(), goodPose(), goodPose()];
    expect(scaleAgreement(frames)).toBeCloseTo(0, 6);
  });

  test('returns higher CV for divergent frames', () => {
    const identical = [goodPose(), goodPose(), goodPose()];
    const divergent = [
      goodPose(),
      goodPose({ leftAnkle: { y: 0.70 }, rightAnkle: { y: 0.70 } }), // much shorter apparent span
      goodPose({ nose: { y: 0.20 } }), // much shorter apparent span
    ];
    expect(scaleAgreement(divergent)).toBeGreaterThan(scaleAgreement(identical));
  });

  test('returns 0 for fewer than 2 frames', () => {
    expect(scaleAgreement([])).toBe(0);
    expect(scaleAgreement([goodPose()])).toBe(0);
  });
});

describe('rejectOutlierFrames', () => {
  test('drops the foreshortened frame, keeps the consistent ones', () => {
    const consistentA = goodPose();
    const consistentB = goodPose({ nose: { y: 0.09 } }); // near-identical span
    const foreshortened = goodPose({ nose: { y: 0.40 }, leftAnkle: { y: 0.60 }, rightAnkle: { y: 0.60 } }); // span collapses
    const frames = [consistentA, consistentB, foreshortened];

    const kept = rejectOutlierFrames(frames, 0.08);
    expect(kept).toHaveLength(2);
    expect(kept).toContain(consistentA);
    expect(kept).toContain(consistentB);
    expect(kept).not.toContain(foreshortened);
  });

  test('always keeps at least the frame closest to the median span', () => {
    // Three frames all somewhat different — none within maxCV=0 of each other,
    // but the closest-to-median must survive regardless.
    const frames = [
      goodPose({ nose: { y: 0.06 } }),
      goodPose({ nose: { y: 0.08 } }),
      goodPose({ nose: { y: 0.11 } }),
    ];
    const kept = rejectOutlierFrames(frames, 0);
    expect(kept.length).toBeGreaterThanOrEqual(1);
  });

  test('single frame or empty input passes through unchanged', () => {
    const one = [goodPose()];
    expect(rejectOutlierFrames(one)).toBe(one);
    expect(rejectOutlierFrames([])).toEqual([]);
  });
});
