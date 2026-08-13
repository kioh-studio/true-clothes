import {
  estimateSimilarity, applySim, invertSim, similarityScaleRot, isAlignmentPlausible,
  ellipseAlpha, channelStats, colorTransfer, bilinearSample, faceMaskRadii, failureToReason,
  type Pt, type Similarity,
} from '../faceCompositeMath';

// Build a synthetic point set + the transform applied to it, so
// estimateSimilarity can be checked against a KNOWN ground truth.
function makeGroundTruth(scale: number, rotDeg: number, tx: number, ty: number): {
  src: Pt[]; dst: Pt[]; truth: Similarity;
} {
  const rad = (rotDeg * Math.PI) / 180;
  const truth: Similarity = {
    a: scale * Math.cos(rad),
    b: scale * Math.sin(rad),
    tx, ty,
  };
  // Four non-collinear points resembling eyes/nose/mouth layout.
  const src: Pt[] = [
    { x: -30, y: -10 }, // right eye
    { x: 30, y: -10 },  // left eye
    { x: 0, y: 10 },    // nose
    { x: 0, y: 35 },    // mouth
  ];
  const dst = src.map((p) => applySim(p, truth));
  return { src, dst, truth };
}

describe('estimateSimilarity', () => {
  test('recovers a known scale+rotation+translation from synthetic correspondences', () => {
    const { src, dst, truth } = makeGroundTruth(1.4, 15, 50, -20);
    const est = estimateSimilarity(src, dst);
    expect(est.a).toBeCloseTo(truth.a, 5);
    expect(est.b).toBeCloseTo(truth.b, 5);
    expect(est.tx).toBeCloseTo(truth.tx, 5);
    expect(est.ty).toBeCloseTo(truth.ty, 5);
  });

  test('round trip: apply(src, estimated) ≈ dst', () => {
    const { src, dst } = makeGroundTruth(0.8, -25, 12, 40);
    const est = estimateSimilarity(src, dst);
    for (let i = 0; i < src.length; i++) {
      const p = applySim(src[i], est);
      expect(p.x).toBeCloseTo(dst[i].x, 4);
      expect(p.y).toBeCloseTo(dst[i].y, 4);
    }
  });

  test('degenerate (identical points) yields a stable finite transform', () => {
    const pts: Pt[] = [{ x: 5, y: 5 }, { x: 5, y: 5 }];
    const est = estimateSimilarity(pts, pts);
    expect(isFinite(est.a)).toBe(true);
    expect(isFinite(est.b)).toBe(true);
  });
});

describe('invertSim', () => {
  test('invertSim(s) ∘ applySim(s) ≈ identity', () => {
    const s: Similarity = { a: 1.2 * Math.cos(0.3), b: 1.2 * Math.sin(0.3), tx: 17, ty: -9 };
    const inv = invertSim(s);
    const p: Pt = { x: 40, y: -12 };
    const forward = applySim(p, s);
    const back = applySim(forward, inv);
    expect(back.x).toBeCloseTo(p.x, 4);
    expect(back.y).toBeCloseTo(p.y, 4);
  });
});

describe('similarityScaleRot', () => {
  test('extracts the correct scale and rotation angle', () => {
    const scale = 2.3;
    const rotDeg = 22;
    const rad = (rotDeg * Math.PI) / 180;
    const s: Similarity = { a: scale * Math.cos(rad), b: scale * Math.sin(rad), tx: 0, ty: 0 };
    const { scale: outScale, rotDeg: outRot } = similarityScaleRot(s);
    expect(outScale).toBeCloseTo(scale, 5);
    expect(outRot).toBeCloseTo(rotDeg, 4);
  });
});

describe('isAlignmentPlausible', () => {
  test('rejects a 4x scale / 60deg rotation mismatch', () => {
    const rad = (60 * Math.PI) / 180;
    const s: Similarity = { a: 4 * Math.cos(rad), b: 4 * Math.sin(rad), tx: 0, ty: 0 };
    expect(isAlignmentPlausible(s)).toBe(false);
  });

  test('accepts a 1.1x scale / 10deg rotation as plausible', () => {
    const rad = (10 * Math.PI) / 180;
    const s: Similarity = { a: 1.1 * Math.cos(rad), b: 1.1 * Math.sin(rad), tx: 0, ty: 0 };
    expect(isAlignmentPlausible(s)).toBe(true);
  });
});

describe('ellipseAlpha', () => {
  test('is 1 at the centre', () => {
    expect(ellipseAlpha(50, 50, 50, 50, 20, 30, 0.25)).toBe(1);
  });

  test('is ~0.5 mid-feather', () => {
    // feather 0.25 → inner edge at d=0.75; midpoint of the ramp is d≈0.875.
    const rx = 20;
    const d = 0.875;
    const x = 50 + d * rx;
    const alpha = ellipseAlpha(x, 50, 50, 50, rx, rx, 0.25);
    expect(alpha).toBeGreaterThan(0.3);
    expect(alpha).toBeLessThan(0.7);
  });

  test('is 0 outside the ellipse', () => {
    expect(ellipseAlpha(200, 200, 50, 50, 20, 30, 0.25)).toBe(0);
  });
});

describe('channelStats + colorTransfer', () => {
  test('colorTransfer maps srcMean -> dstMean', () => {
    const src = channelStats([100, 110, 90, 105, 95]);
    const dst = channelStats([180, 190, 170, 185, 175]);
    const mapped = colorTransfer(src.mean, src.mean, src.std, dst.mean, dst.std);
    expect(mapped).toBeCloseTo(dst.mean, 5);
  });

  test('preserves relative spread direction (value above srcMean maps above dstMean)', () => {
    const src = channelStats([100, 110, 90, 105, 95]);
    const dst = channelStats([180, 190, 170, 185, 175]);
    const mapped = colorTransfer(src.mean + src.std, src.mean, src.std, dst.mean, dst.std);
    expect(mapped).toBeGreaterThan(dst.mean);
  });

  test('clamps to the 0..255 range', () => {
    expect(colorTransfer(300, 100, 10, 400, 10)).toBeLessThanOrEqual(255);
    expect(colorTransfer(-50, 100, 10, -400, 10)).toBeGreaterThanOrEqual(0);
  });
});

describe('faceMaskRadii', () => {
  const interEye = 20;

  test('ear-span path: rx derives from earSpan*0.62 when within the clamp range', () => {
    const earSpan = 60; // raw = 60*0.62 = 37.2, within [interEye*1.4=28, interEye*2.6=52]
    const { rx, ry } = faceMaskRadii(interEye, earSpan);
    expect(rx).toBeCloseTo(37.2, 5);
    expect(ry).toBeCloseTo(37.2 * 1.28, 5);
  });

  test('clamps to the lower bound (interEye * 1.4) when the ear-span-derived rx is too small', () => {
    const earSpan = 10; // raw = 6.2, below the 28 lower bound
    const { rx, ry } = faceMaskRadii(interEye, earSpan);
    expect(rx).toBeCloseTo(interEye * 1.4, 5);
    expect(ry).toBeCloseTo(rx * 1.28, 5);
  });

  test('clamps to the upper bound (interEye * 2.6) when the ear-span-derived rx is too large', () => {
    const earSpan = 200; // raw = 124, above the 52 upper bound
    const { rx, ry } = faceMaskRadii(interEye, earSpan);
    expect(rx).toBeCloseTo(interEye * 2.6, 5);
    expect(ry).toBeCloseTo(rx * 1.28, 5);
  });

  test('falls back to interEye * 1.9 when earSpanPx is null', () => {
    const { rx, ry } = faceMaskRadii(interEye, null);
    expect(rx).toBeCloseTo(interEye * 1.9, 5);
    expect(ry).toBeCloseTo(rx * 1.28, 5);
  });

  test('returns zero radii for a degenerate/non-finite interEyePx', () => {
    expect(faceMaskRadii(0, 40)).toEqual({ rx: 0, ry: 0 });
    expect(faceMaskRadii(-5, 40)).toEqual({ rx: 0, ry: 0 });
    expect(faceMaskRadii(NaN, 40)).toEqual({ rx: 0, ry: 0 });
    expect(faceMaskRadii(Infinity, 40)).toEqual({ rx: 0, ry: 0 });
  });
});

describe('bilinearSample', () => {
  test('interpolates a known 2x2 gradient', () => {
    // 2x2 RGBA image, red channel: (0,0)=0, (1,0)=100, (0,1)=200, (1,1)=300(clamped irrelevant, use raw math)
    const w = 2, h = 2;
    const data = new Uint8Array(w * h * 4);
    const setR = (x: number, y: number, v: number) => { data[(y * w + x) * 4 + 0] = v; };
    setR(0, 0, 0);
    setR(1, 0, 100);
    setR(0, 1, 200);
    setR(1, 1, 300 > 255 ? 255 : 300); // stays in Uint8 domain

    // At exact pixel centres, sample should equal the stored value.
    expect(bilinearSample(data, w, h, 0, 0, 0)).toBeCloseTo(0, 5);
    expect(bilinearSample(data, w, h, 1, 0, 0)).toBeCloseTo(100, 5);

    // Midpoint between (0,0) and (1,0) averages to 50.
    expect(bilinearSample(data, w, h, 0.5, 0, 0)).toBeCloseTo(50, 5);

    // Centre of the 2x2 block averages all four corners.
    const expected = (0 + 100 + 200 + 255) / 4;
    expect(bilinearSample(data, w, h, 0.5, 0.5, 0)).toBeCloseTo(expected, 5);
  });

  test('clamps out-of-range coordinates to the edge', () => {
    const w = 2, h = 2;
    const data = new Uint8Array(w * h * 4);
    data[0] = 42; // (0,0) red
    expect(bilinearSample(data, w, h, -5, -5, 0)).toBeCloseTo(42, 5);
  });
});

describe('failureToReason', () => {
  test('model_unavailable always becomes detector_unavailable, regardless of which image', () => {
    expect(failureToReason('model_unavailable', 'no_face_source')).toBe('detector_unavailable');
    expect(failureToReason('model_unavailable', 'no_face_generated')).toBe('detector_unavailable');
  });

  test('decode_failed passes through unchanged, regardless of which image', () => {
    expect(failureToReason('decode_failed', 'no_face_source')).toBe('decode_failed');
    expect(failureToReason('decode_failed', 'no_face_generated')).toBe('decode_failed');
  });

  test('no_face defers to the caller-supplied reason (which image was being detected)', () => {
    expect(failureToReason('no_face', 'no_face_source')).toBe('no_face_source');
    expect(failureToReason('no_face', 'no_face_generated')).toBe('no_face_generated');
  });
});
