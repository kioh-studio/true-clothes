// Unit tests for assessPose — pure framing/quality gate, no native deps.
import { assessPose, Q } from '../poseQuality';
import type { Keypoint } from '../poseEstimate';

// A well-framed, square-on standing pose (square-space normalised coords).
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

describe('assessPose', () => {
  test('well-framed square-on pose is OK', () => {
    const q = assessPose(goodPose());
    expect(q.ok).toBe(true);
    expect(q.hint).toBe('ok');
  });

  test('missing/low-confidence required landmark → not ok', () => {
    expect(assessPose(goodPose({ leftHip: { score: 0.1 } })).ok).toBe(false);
  });

  test('only ankles missing → show_feet (classic selfie crop)', () => {
    const q = assessPose(goodPose({ leftAnkle: { score: 0.1 }, rightAnkle: { score: 0.1 } }));
    expect(q.ok).toBe(false);
    expect(q.hint).toBe('show_feet');
    expect(q.missing.sort()).toEqual(['leftAnkle', 'rightAnkle']);
  });

  test('one ankle missing → still show_feet', () => {
    expect(assessPose(goodPose({ rightAnkle: { score: 0.1 } })).hint).toBe('show_feet');
  });

  test('almost nobody detected → no_person', () => {
    const kps = goodPose({
      leftShoulder: { score: 0.1 }, rightShoulder: { score: 0.1 },
      leftHip: { score: 0.1 }, rightHip: { score: 0.1 },
      leftAnkle: { score: 0.1 }, rightAnkle: { score: 0.1 },
    });
    expect(assessPose(kps).hint).toBe('no_person');
  });

  test('person too small in frame → step_closer', () => {
    // nose↔ankle span tiny → frameFill below fillMin
    const kps = goodPose({
      nose: { y: 0.45 }, leftAnkle: { y: 0.55 }, rightAnkle: { y: 0.55 },
      leftHip: { y: 0.50 }, rightHip: { y: 0.50 },
    });
    expect(assessPose(kps).hint).toBe('step_closer');
  });

  test('tilted shoulders → straighten', () => {
    const kps = goodPose({ leftShoulder: { y: 0.22 }, rightShoulder: { y: 0.32 } });
    const q = assessPose(kps);
    expect(q.ok).toBe(false);
    expect(q.hint).toBe('straighten');
  });

  test('Q.goodFramesToCapture is a small positive integer', () => {
    expect(Q.goodFramesToCapture).toBeGreaterThanOrEqual(1);
  });
});
