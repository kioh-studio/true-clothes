import {
  interEyeDistancePx, isWeakDetection, mapPointCropToFull, mapLandmarksCropToFull,
  selectFaceDetection, combineFailureKinds, WEAK_INTER_EYE_FRACTION, FACE_CROP_REGION,
  type FaceLandmarks, type CropRegion,
} from '../faceDetectMath';

// Builds a minimal FaceLandmarks fixture. Eyes are placed symmetrically
// around x=0.5 so `interEyeDistancePx` is driven purely by `eyeGapNorm`.
function makeLandmarks(eyeGapNorm: number, score = 0.9): FaceLandmarks {
  return {
    rightEye: { x: 0.5 - eyeGapNorm / 2, y: 0.4 },
    leftEye: { x: 0.5 + eyeGapNorm / 2, y: 0.4 },
    nose: { x: 0.5, y: 0.45 },
    mouth: { x: 0.5, y: 0.5 },
    rightEar: { x: 0.4, y: 0.4 },
    leftEar: { x: 0.6, y: 0.4 },
    box: { x: 0.4, y: 0.3, width: 0.2, height: 0.25 },
    score,
  };
}

describe('interEyeDistancePx', () => {
  test('computes the pixel distance from normalised eye coords', () => {
    const landmarks = makeLandmarks(0.1); // eyes 0.1 apart, normalised
    const srcW = 1000, srcH = 1000;
    // Eyes differ only in x here → distance ≈ 0.1 * srcW = 100px.
    expect(interEyeDistancePx(landmarks, srcW, srcH)).toBeCloseTo(100, 5);
  });
});

describe('isWeakDetection', () => {
  const srcW = 1000, srcH = 2000; // larger dimension = 2000

  test('null landmarks are always weak', () => {
    expect(isWeakDetection(null, srcW, srcH)).toBe(true);
  });

  test('a small inter-eye distance (below the fraction of the larger dimension) is weak', () => {
    // threshold = 0.04 * 2000 = 80px. eyeGapNorm*srcW must be < 80 → eyeGapNorm < 0.08.
    const landmarks = makeLandmarks(0.05); // 50px, well under threshold
    expect(isWeakDetection(landmarks, srcW, srcH)).toBe(true);
  });

  test('a large inter-eye distance is NOT weak', () => {
    const landmarks = makeLandmarks(0.2); // 200px, well over the 80px threshold
    expect(isWeakDetection(landmarks, srcW, srcH)).toBe(false);
  });

  test('threshold is a fraction of the LARGER source dimension', () => {
    // Confirms the calibration constant is actually used (not hardcoded).
    const threshold = WEAK_INTER_EYE_FRACTION * Math.max(srcW, srcH);
    const justBelow = makeLandmarks((threshold - 1) / srcW);
    const justAbove = makeLandmarks((threshold + 1) / srcW);
    expect(isWeakDetection(justBelow, srcW, srcH)).toBe(true);
    expect(isWeakDetection(justAbove, srcW, srcH)).toBe(false);
  });

  test('degenerate source dimensions are treated as weak (never divide by zero)', () => {
    expect(isWeakDetection(makeLandmarks(0.2), 0, 0)).toBe(true);
    expect(isWeakDetection(makeLandmarks(0.2), NaN, 100)).toBe(true);
  });
});

describe('mapPointCropToFull', () => {
  test('identity crop (full image) leaves points unchanged', () => {
    const identity: CropRegion = { xNorm: 0, yNorm: 0, widthNorm: 1, heightNorm: 1 };
    const p = { x: 0.3, y: 0.7 };
    expect(mapPointCropToFull(p, identity)).toEqual(p);
  });

  test('maps a crop-local point into the full image using FACE_CROP_REGION', () => {
    // FACE_CROP_REGION: upper 40% of the image, full width.
    const p = { x: 0.5, y: 1.0 }; // bottom-centre of the crop
    const mapped = mapPointCropToFull(p, FACE_CROP_REGION);
    expect(mapped.x).toBeCloseTo(0.5, 6);
    expect(mapped.y).toBeCloseTo(0.4, 6); // 0 + 1.0 * 0.4
  });

  test('a general crop offsets and scales correctly', () => {
    const crop: CropRegion = { xNorm: 0.1, yNorm: 0.2, widthNorm: 0.5, heightNorm: 0.3 };
    const mapped = mapPointCropToFull({ x: 0.5, y: 0.5 }, crop);
    expect(mapped.x).toBeCloseTo(0.1 + 0.5 * 0.5, 6);
    expect(mapped.y).toBeCloseTo(0.2 + 0.5 * 0.3, 6);
  });
});

describe('mapLandmarksCropToFull', () => {
  test('maps every keypoint and the box using the same crop transform', () => {
    const crop: CropRegion = { xNorm: 0, yNorm: 0, widthNorm: 1, heightNorm: 0.4 };
    const landmarks = makeLandmarks(0.1);
    const mapped = mapLandmarksCropToFull(landmarks, crop);

    expect(mapped.rightEye.y).toBeCloseTo(landmarks.rightEye.y * 0.4, 6);
    expect(mapped.rightEye.x).toBeCloseTo(landmarks.rightEye.x, 6); // widthNorm=1, xNorm=0
    expect(mapped.leftEye.y).toBeCloseTo(landmarks.leftEye.y * 0.4, 6);
    expect(mapped.nose.y).toBeCloseTo(landmarks.nose.y * 0.4, 6);
    expect(mapped.mouth.y).toBeCloseTo(landmarks.mouth.y * 0.4, 6);

    expect(mapped.box.y).toBeCloseTo(landmarks.box.y * 0.4, 6);
    expect(mapped.box.height).toBeCloseTo(landmarks.box.height * 0.4, 6);
    expect(mapped.box.x).toBeCloseTo(landmarks.box.x, 6);
    expect(mapped.box.width).toBeCloseTo(landmarks.box.width, 6);

    // Score passes through unchanged.
    expect(mapped.score).toBe(landmarks.score);
  });
});

describe('selectFaceDetection', () => {
  const srcW = 1000, srcH = 2000;

  test('a confident first-pass hit wins even when a second-pass hit exists', () => {
    const first = makeLandmarks(0.2, 0.6); // confident
    const second = makeLandmarks(0.3, 0.99); // also confident, higher score — irrelevant
    expect(selectFaceDetection(first, second, srcW, srcH)).toBe(first);
  });

  test('a confident second-pass hit rescues a weak first-pass hit', () => {
    const first = makeLandmarks(0.01, 0.9); // weak (tiny inter-eye distance)
    const second = makeLandmarks(0.2, 0.5); // confident
    expect(selectFaceDetection(first, second, srcW, srcH)).toBe(second);
  });

  test('a confident second-pass hit rescues a missing first-pass hit', () => {
    const second = makeLandmarks(0.2, 0.5);
    expect(selectFaceDetection(null, second, srcW, srcH)).toBe(second);
  });

  test('both weak: falls back to the higher-scoring one', () => {
    const first = makeLandmarks(0.01, 0.9);
    const second = makeLandmarks(0.01, 0.4);
    expect(selectFaceDetection(first, second, srcW, srcH)).toBe(first);
  });

  test('both miss entirely: returns null', () => {
    expect(selectFaceDetection(null, null, srcW, srcH)).toBeNull();
  });

  test('only the weak first pass exists (second pass also missed): keeps first rather than discarding it', () => {
    const first = makeLandmarks(0.01, 0.9);
    expect(selectFaceDetection(first, null, srcW, srcH)).toBe(first);
  });
});

describe('combineFailureKinds', () => {
  test('model_unavailable on either pass always wins, regardless of order', () => {
    expect(combineFailureKinds('model_unavailable', 'no_face')).toBe('model_unavailable');
    expect(combineFailureKinds('no_face', 'model_unavailable')).toBe('model_unavailable');
    expect(combineFailureKinds('model_unavailable', 'decode_failed')).toBe('model_unavailable');
    expect(combineFailureKinds('decode_failed', 'model_unavailable')).toBe('model_unavailable');
  });

  test('decode_failed wins over no_face when model_unavailable is absent', () => {
    expect(combineFailureKinds('decode_failed', 'no_face')).toBe('decode_failed');
    expect(combineFailureKinds('no_face', 'decode_failed')).toBe('decode_failed');
  });

  test('both no_face: reports no_face', () => {
    expect(combineFailureKinds('no_face', 'no_face')).toBe('no_face');
  });

  test('a null argument (pass did not fail) does not override a real failure on the other pass', () => {
    expect(combineFailureKinds('model_unavailable', null)).toBe('model_unavailable');
    expect(combineFailureKinds(null, 'model_unavailable')).toBe('model_unavailable');
    expect(combineFailureKinds('decode_failed', null)).toBe('decode_failed');
    expect(combineFailureKinds(null, 'decode_failed')).toBe('decode_failed');
  });

  test('both null: defaults to no_face', () => {
    expect(combineFailureKinds(null, null)).toBe('no_face');
  });
});
