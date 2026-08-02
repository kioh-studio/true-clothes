// Unit tests for assessPose — pure framing/quality gate, no native deps.
import { assessPose, assessSidePose, Q } from '../poseQuality';
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

  test('turned sideways (level shoulders, but a foreshortened x-span) → straighten', () => {
    // Shoulders stay perfectly level (y unchanged) but nearly coincide on x —
    // the classic "angled away from the camera" silhouette.
    const kps = goodPose({ leftShoulder: { x: 0.51 }, rightShoulder: { x: 0.49 } });
    const q = assessPose(kps);
    expect(q.ok).toBe(false);
    expect(q.hint).toBe('straighten');
  });

  test('Q.goodFramesToCapture is a small positive integer', () => {
    expect(Q.goodFramesToCapture).toBeGreaterThanOrEqual(1);
  });
});

// ── assessSidePose (2026-07, side-view/profile capture pass) ───────────────
// Unlike assessPose, a profile view only ever shows ONE side of the body
// clearly — the far shoulder/hip/ankle being occluded is expected, not a
// defect — so these fixtures deliberately DROP the far side's confidence
// rather than mirroring goodPose()'s "both sides visible" convention.

/** A well-framed, genuine PROFILE pose: only the near (left) side confident,
 *  shoulder/hip nearly coincident on x (foreshortened — the profile itself). */
function sideProfilePose(over: Partial<Record<string, Partial<Keypoint>>> = {}): Keypoint[] {
  const base: Record<string, Keypoint> = {
    nose:          { name: 'nose',          x: 0.50, y: 0.08, score: 0.9 },
    leftShoulder:  { name: 'leftShoulder',  x: 0.51, y: 0.22, score: 0.9 },
    rightShoulder: { name: 'rightShoulder', x: 0.50, y: 0.22, score: 0.05 }, // occluded — expected
    leftHip:       { name: 'leftHip',       x: 0.50, y: 0.55, score: 0.88 },
    rightHip:      { name: 'rightHip',      x: 0.49, y: 0.55, score: 0.05 }, // occluded — expected
    leftAnkle:     { name: 'leftAnkle',     x: 0.49, y: 0.92, score: 0.85 },
    rightAnkle:    { name: 'rightAnkle',    x: 0.48, y: 0.92, score: 0.05 }, // occluded — expected
  };
  for (const [k, v] of Object.entries(over)) base[k] = { ...base[k], ...v } as Keypoint;
  return Object.values(base);
}

describe('assessSidePose', () => {
  test('a genuine well-framed profile pose is OK', () => {
    const q = assessSidePose(sideProfilePose());
    expect(q.ok).toBe(true);
    expect(q.hint).toBe('ok');
  });

  test('a front-on (not turned) pose → turn_side', () => {
    // Both shoulders AND both hips fully confident with a wide x-span — the
    // classic "hasn't turned yet" frame straight out of the front capture.
    const kps = sideProfilePose({
      rightShoulder: { score: 0.9, x: 0.34 },
      rightHip: { score: 0.88, x: 0.40 },
      rightAnkle: { score: 0.85, x: 0.45 },
      leftShoulder: { x: 0.66 },
      leftHip: { x: 0.60 },
      leftAnkle: { x: 0.55 },
    });
    const q = assessSidePose(kps);
    expect(q.ok).toBe(false);
    expect(q.hint).toBe('turn_side');
  });

  test('missing/low-confidence ankles (both sides) → show_feet', () => {
    const kps = sideProfilePose({ leftAnkle: { score: 0.1 } }); // rightAnkle already low
    const q = assessSidePose(kps);
    expect(q.ok).toBe(false);
    expect(q.hint).toBe('show_feet');
  });

  test('missing nose and torso → no_person', () => {
    const kps = sideProfilePose({
      nose: { score: 0.1 },
      leftShoulder: { score: 0.1 }, rightShoulder: { score: 0.05 },
      leftHip: { score: 0.1 }, rightHip: { score: 0.05 },
    });
    expect(assessSidePose(kps).hint).toBe('no_person');
  });

  test('person too small in frame → step_closer', () => {
    const kps = sideProfilePose({
      nose: { y: 0.45 }, leftAnkle: { y: 0.55 }, leftHip: { y: 0.50 },
    });
    expect(assessSidePose(kps).hint).toBe('step_closer');
  });

  test('a single confident joint per pair (real occlusion) passes the profile check automatically', () => {
    // Already the default fixture shape — re-assert explicitly that this is
    // NOT rejected as "not turned enough", since there's no far-side span to
    // measure at all.
    const q = assessSidePose(sideProfilePose());
    expect(q.hint).not.toBe('turn_side');
  });
});
