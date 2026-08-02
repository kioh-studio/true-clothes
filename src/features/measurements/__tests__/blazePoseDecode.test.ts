// Unit tests for BlazePose Heavy output decoding — pure math, no native deps,
// no device/TF Lite runtime required.
import {
  sigmoid,
  decodeBlazePoseLandmarks,
  findOutputIndexByLength,
  BLAZEPOSE_LANDMARK_MAP,
  BLAZEPOSE_LANDMARKS_LENGTH,
} from '../blazePoseDecode';

/** A synthetic 195-float landmark tensor, all zeros except the entries set. */
function makeLandmarks(overrides: Record<number, { x?: number; y?: number; z?: number; visibility?: number; presence?: number }>): number[] {
  const arr = new Array(BLAZEPOSE_LANDMARKS_LENGTH).fill(0);
  for (const [idxStr, v] of Object.entries(overrides)) {
    const idx = Number(idxStr);
    const base = idx * 5;
    if (v.x != null) arr[base] = v.x;
    if (v.y != null) arr[base + 1] = v.y;
    if (v.z != null) arr[base + 2] = v.z;
    if (v.visibility != null) arr[base + 3] = v.visibility;
    if (v.presence != null) arr[base + 4] = v.presence;
  }
  return arr;
}

describe('sigmoid', () => {
  test('sigmoid(0) === 0.5', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 10);
  });
  test('large positive logit approaches 1', () => {
    expect(sigmoid(10)).toBeGreaterThan(0.999);
  });
  test('large negative logit approaches 0', () => {
    expect(sigmoid(-10)).toBeLessThan(0.001);
  });
});

describe('findOutputIndexByLength', () => {
  test('finds the tensor with the matching length', () => {
    const outputs = [new Float32Array(1), new Float32Array(195), new Float32Array(65536)];
    expect(findOutputIndexByLength(outputs, 195)).toBe(1);
    expect(findOutputIndexByLength(outputs, 1)).toBe(0);
    expect(findOutputIndexByLength(outputs, 65536)).toBe(2);
  });

  test('returns -1 when nothing matches', () => {
    const outputs = [new Float32Array(4), new Float32Array(8)];
    expect(findOutputIndexByLength(outputs, 195)).toBe(-1);
  });
});

describe('BLAZEPOSE_LANDMARK_MAP', () => {
  test('has exactly 21 entries (17 shared COCO names + 4 new heel/toe names)', () => {
    expect(BLAZEPOSE_LANDMARK_MAP).toHaveLength(21);
  });

  test('includes the 4 new heel/toe landmarks at BlazePose indices 29-32', () => {
    const byName: Record<string, number> = {};
    for (const { idx, name } of BLAZEPOSE_LANDMARK_MAP) byName[name] = idx;
    expect(byName['leftHeel']).toBe(29);
    expect(byName['rightHeel']).toBe(30);
    expect(byName['leftFootIndex']).toBe(31);
    expect(byName['rightFootIndex']).toBe(32);
  });

  test('maps the shared COCO names to BlazePose\'s topology indices', () => {
    const byName: Record<string, number> = {};
    for (const { idx, name } of BLAZEPOSE_LANDMARK_MAP) byName[name] = idx;
    expect(byName['nose']).toBe(0);
    expect(byName['leftShoulder']).toBe(11);
    expect(byName['rightShoulder']).toBe(12);
    expect(byName['leftHip']).toBe(23);
    expect(byName['rightHip']).toBe(24);
    expect(byName['leftAnkle']).toBe(27);
    expect(byName['rightAnkle']).toBe(28);
  });

  test('no duplicate names and no duplicate indices', () => {
    const names = BLAZEPOSE_LANDMARK_MAP.map((e) => e.name);
    const idxs = BLAZEPOSE_LANDMARK_MAP.map((e) => e.idx);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(idxs).size).toBe(idxs.length);
  });
});

describe('decodeBlazePoseLandmarks', () => {
  const MODEL_SIZE = 256;

  test('poseflag below 0.5 (sigmoid) → null regardless of landmark content', () => {
    const landmarks = makeLandmarks({ 0: { x: 128, y: 128, visibility: 5 } });
    // sigmoid(-2) ≈ 0.119 < 0.5
    expect(decodeBlazePoseLandmarks(landmarks, -2, MODEL_SIZE)).toBeNull();
  });

  test('poseflag at or above 0.5 (sigmoid) → decodes all 21 named keypoints', () => {
    const landmarks = makeLandmarks({ 0: { x: 128, y: 64, visibility: 2 } });
    // sigmoid(2) ≈ 0.881 >= 0.5
    const kps = decodeBlazePoseLandmarks(landmarks, 2, MODEL_SIZE);
    expect(kps).not.toBeNull();
    expect(kps).toHaveLength(21);
  });

  test('poseflag exactly at the sigmoid(0)=0.5 boundary is NOT below 0.5 → decodes', () => {
    const landmarks = makeLandmarks({ 0: { x: 0, y: 0, visibility: 0 } });
    expect(decodeBlazePoseLandmarks(landmarks, 0, MODEL_SIZE)).not.toBeNull();
  });

  test('x/y are normalised by dividing by modelSize (pixel/256 convention)', () => {
    const landmarks = makeLandmarks({
      0:  { x: 128, y: 64,  visibility: 0 },  // nose
      11: { x: 200, y: 100, visibility: 3 },  // leftShoulder
    });
    const kps = decodeBlazePoseLandmarks(landmarks, 5, MODEL_SIZE)!;
    const nose = kps.find((k) => k.name === 'nose')!;
    const leftShoulder = kps.find((k) => k.name === 'leftShoulder')!;

    expect(nose.x).toBeCloseTo(128 / 256, 10);
    expect(nose.y).toBeCloseTo(64 / 256, 10);
    expect(leftShoulder.x).toBeCloseTo(200 / 256, 10);
    expect(leftShoulder.y).toBeCloseTo(100 / 256, 10);
  });

  test('score is sigmoid(visibility), not the raw logit', () => {
    const landmarks = makeLandmarks({ 0: { x: 0, y: 0, visibility: 1.5 } });
    const kps = decodeBlazePoseLandmarks(landmarks, 5, MODEL_SIZE)!;
    const nose = kps.find((k) => k.name === 'nose')!;
    expect(nose.score).toBeCloseTo(sigmoid(1.5), 10);
    expect(nose.score).not.toBe(1.5); // must be squashed, not the raw logit
  });

  test('new heel/toe landmarks decode with the same convention as the shared ones', () => {
    const landmarks = makeLandmarks({
      29: { x: 64,  y: 240, visibility: 4 }, // leftHeel
      31: { x: 70,  y: 230, visibility: 4 }, // leftFootIndex
    });
    const kps = decodeBlazePoseLandmarks(landmarks, 5, MODEL_SIZE)!;
    const leftHeel = kps.find((k) => k.name === 'leftHeel')!;
    const leftFootIndex = kps.find((k) => k.name === 'leftFootIndex')!;
    expect(leftHeel).toBeDefined();
    expect(leftHeel.x).toBeCloseTo(64 / 256, 10);
    expect(leftHeel.y).toBeCloseTo(240 / 256, 10);
    expect(leftHeel.score).toBeCloseTo(sigmoid(4), 10);
    expect(leftFootIndex).toBeDefined();
  });

  test('respects an arbitrary modelSize (not hardcoded to 256)', () => {
    const landmarks = makeLandmarks({ 0: { x: 60, y: 30, visibility: 0 } });
    const kps = decodeBlazePoseLandmarks(landmarks, 5, 120)!;
    const nose = kps.find((k) => k.name === 'nose')!;
    expect(nose.x).toBeCloseTo(60 / 120, 10);
    expect(nose.y).toBeCloseTo(30 / 120, 10);
  });
});
