// Unit tests for the pure side-view (profile) depth extraction — synthetic
// masks, no native deps. Mirrors silhouetteMath.test.ts's style.
import { extractSideDepths } from '../sideViewMath';
import type { SilhouetteMask } from '../silhouetteMath';
import type { Keypoint } from '../poseEstimate';

const SIZE = 64;
const CX = 32;

/** Paint one row with a run of `width` centred on column CX. */
function paintRow(data: Float32Array, size: number, row: number, width: number) {
  const half = Math.floor(width / 2);
  const x0 = CX - half;
  for (let x = x0; x < x0 + width; x++) data[row * size + x] = 1;
}

const yOf = (row: number) => row / (SIZE - 1);
const kp = (name: string, yRow: number, x = CX / (SIZE - 1), score = 0.9): Keypoint =>
  ({ name, x, y: yOf(yRow), score });

/**
 * A synthetic "profile" mask: shoulder at row 10, hip at row 50 (torso 40
 * rows, matching landmarksToMeasurements.test.ts's conventions), ankle at
 * row 60. Depth (front-to-back, in a real profile photo) is just the run
 * width here since this is a flat 2D synthetic mask — the math doesn't care
 * which physical axis a "width" represents, only that the row/band scan is
 * the same either way.
 */
function profileMask(): SilhouetteMask {
  const data = new Float32Array(SIZE * SIZE);
  // Chest region (rows 15-25): depth 20, except a narrower neighbourhood so
  // a max-scan has something to beat.
  for (let r = 15; r <= 25; r++) paintRow(data, SIZE, r, 20);
  // Waist region (rows 26-45): narrowest at row 35 (depth 10), wider (18)
  // elsewhere in the band — a min-scan should land on row 35.
  for (let r = 26; r <= 45; r++) paintRow(data, SIZE, r, r === 35 ? 10 : 18);
  // Hip/seat region (rows 46-58): widest at row 51 (depth 24), narrower (14)
  // elsewhere — a max-scan should land on row 51.
  for (let r = 46; r <= 58; r++) paintRow(data, SIZE, r, r === 51 ? 24 : 14);
  return { data, size: SIZE };
}

function profileKps(overrides: Partial<Record<string, Partial<Keypoint>>> = {}): Keypoint[] {
  const base: Record<string, Keypoint> = {
    // Profile shot: only ONE side confidently visible (the other occluded by
    // the torso) — this is the expected, non-defect case extractSideDepths
    // is built for. leftShoulder/leftHip carry the visible side.
    leftShoulder:  kp('leftShoulder', 10),
    rightShoulder: { ...kp('rightShoulder', 10), score: 0.05 },
    leftHip:       kp('leftHip', 50),
    rightHip:      { ...kp('rightHip', 50), score: 0.05 },
    leftAnkle:     kp('leftAnkle', 60),
    rightAnkle:    { ...kp('rightAnkle', 60), score: 0.05 },
  };
  for (const [name, patch] of Object.entries(overrides)) {
    if (base[name]) base[name] = { ...base[name], ...patch };
  }
  return Object.values(base);
}

describe('extractSideDepths', () => {
  test('registers the front-view row fractions and measures chest(max)/waist(min)/hip(max)', () => {
    // Row fractions as if the FRONT scan found them at exactly rows 20/35/51
    // (torso = 40 rows: shoulder row 10, hip row 50).
    const rowFracs = {
      chestRowFrac: (20 - 10) / 40,
      waistRowFrac: (35 - 10) / 40,
      hipRowFrac:   (51 - 10) / 40,
    };
    const depths = extractSideDepths(profileMask(), profileKps(), rowFracs);
    expect(depths.chestU).toBeCloseTo(20 / SIZE, 5);
    expect(depths.waistU).toBeCloseTo(10 / SIZE, 5);
    expect(depths.hipU).toBeCloseTo(24 / SIZE, 5);
  });

  test('missing rowFracs fall back to fixed anatomical defaults, not a crash/null', () => {
    const depths = extractSideDepths(profileMask(), profileKps(), {});
    // Defaults land somewhere inside the painted regions (chest default 0.25
    // of torso ⇒ row 10+0.25*40=20 — exactly the chest region here), so this
    // should still produce a usable (if not row-perfect) reading rather than
    // nothing at all.
    expect(depths.chestU).not.toBeUndefined();
  });

  test('one-sided confidence (profile occlusion) is sufficient — does not require both shoulders/hips', () => {
    const rowFracs = { chestRowFrac: (20 - 10) / 40, waistRowFrac: (35 - 10) / 40, hipRowFrac: (51 - 10) / 40 };
    const bothConfident = extractSideDepths(profileMask(), profileKps({
      rightShoulder: { score: 0.9 }, rightHip: { score: 0.9 }, rightAnkle: { score: 0.9 },
    }), rowFracs);
    const oneSided = extractSideDepths(profileMask(), profileKps(), rowFracs);
    expect(oneSided.chestU).toBeCloseTo(bothConfident.chestU!, 5);
    expect(oneSided.waistU).toBeCloseTo(bothConfident.waistU!, 5);
    expect(oneSided.hipU).toBeCloseTo(bothConfident.hipU!, 5);
  });

  test('returns {} when neither shoulder nor hip is confident', () => {
    const kps = profileKps({ leftShoulder: { score: 0.1 }, leftHip: { score: 0.1 } });
    expect(extractSideDepths(profileMask(), kps, {})).toEqual({});
  });

  test('returns {} when the torso span collapses (hip not below shoulder)', () => {
    const kps = profileKps({ leftHip: { y: 0 } }); // hip above shoulder → torso <= 0
    expect(extractSideDepths(profileMask(), kps, {})).toEqual({});
  });

  test('a region whose band scan finds nothing is simply omitted, not a failure', () => {
    // Empty mask — every band scan fails, but the function must not throw.
    const empty: SilhouetteMask = { data: new Float32Array(SIZE * SIZE), size: SIZE };
    const depths = extractSideDepths(empty, profileKps(), {
      chestRowFrac: 0.25, waistRowFrac: 0.6, hipRowFrac: 1.0,
    });
    expect(depths).toEqual({});
  });
});
