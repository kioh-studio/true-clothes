// Unit tests for the pure crop/letterbox geometry — no native deps.
import {
  letterboxParams, sourceToSquare, squareToSource, longSideResize,
  personCropRect, cropSquareToFullSquare, fullSquareToCropSquare,
  cropSquareLengthToFullSquare, C, type CropRect,
} from '../cropMath';
import type { Keypoint } from '../poseEstimate';

const kp = (name: string, x: number, y: number, score = 0.9): Keypoint => ({ name, x, y, score });

describe('letterboxParams', () => {
  test('portrait: pads left/right', () => {
    const { L, ox, oy } = letterboxParams(1080, 1920);
    expect(L).toBe(1920);
    expect(ox).toBe(420);
    expect(oy).toBe(0);
  });

  test('landscape: pads top/bottom', () => {
    const { L, ox, oy } = letterboxParams(1920, 1080);
    expect(L).toBe(1920);
    expect(ox).toBe(0);
    expect(oy).toBe(420);
  });

  test('square: no padding', () => {
    const { L, ox, oy } = letterboxParams(1000, 1000);
    expect(L).toBe(1000);
    expect(ox).toBe(0);
    expect(oy).toBe(0);
  });
});

describe('sourceToSquare / squareToSource round-trip', () => {
  const cases: [number, number][] = [[1080, 1920], [1920, 1080], [1000, 1000]];
  for (const [w, h] of cases) {
    test(`identity holds for ${w}x${h}`, () => {
      const px = w * 0.37, py = h * 0.62;
      const { u, v } = sourceToSquare(px, py, w, h);
      const back = squareToSource(u, v, w, h);
      expect(back.px).toBeCloseTo(px, 6);
      expect(back.py).toBeCloseTo(py, 6);
    });
  }

  test('a source pixel at the origin maps inside the square, not negative', () => {
    const { u, v } = sourceToSquare(0, 0, 1080, 1920);
    expect(u).toBeGreaterThanOrEqual(0);
    expect(v).toBeGreaterThanOrEqual(0);
  });
});

describe('longSideResize', () => {
  test('portrait long side maps to target, short side proportional', () => {
    const { width, height } = longSideResize(1080, 1920, 192);
    expect(height).toBe(192);
    expect(width).toBeLessThan(192);
    expect(width).toBeGreaterThan(0);
  });

  test('square maps both sides to target', () => {
    const { width, height } = longSideResize(500, 500, 256);
    expect(width).toBe(256);
    expect(height).toBe(256);
  });
});

describe('personCropRect', () => {
  // A simple standing pose roughly centred in a 1080x1920 portrait frame.
  function standingPose(): Keypoint[] {
    return [
      kp('nose', 0.50, 0.10),
      kp('leftShoulder', 0.62, 0.22), kp('rightShoulder', 0.38, 0.22),
      kp('leftHip', 0.58, 0.55), kp('rightHip', 0.42, 0.55),
      kp('leftAnkle', 0.55, 0.90), kp('rightAnkle', 0.45, 0.90),
    ];
  }

  test('produces a crop smaller than the frame, with margins applied', () => {
    const sW = 1080, sH = 1920;
    const rect = personCropRect(standingPose(), sW, sH)!;
    expect(rect).not.toBeNull();

    // Raw bbox (before margins) in source pixels from the square-space kps.
    const xs = standingPose().map((k) => squareToSource(k.x, k.y, sW, sH).px);
    const ys = standingPose().map((k) => squareToSource(k.x, k.y, sW, sH).py);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const bw = maxX - minX, bh = maxY - minY;

    // Expected (pre-clamp) edges per the documented margins.
    const expLeft = minX - C.marginSide * bw;
    const expTop = minY - C.marginTop * bh;
    const expBottom = maxY + C.marginBottom * bh;

    expect(rect.originX).toBeCloseTo(Math.round(Math.max(0, expLeft)), 0);
    expect(rect.originY).toBeCloseTo(Math.round(Math.max(0, expTop)), 0);
    expect(rect.originY + rect.height).toBeCloseTo(Math.round(Math.min(sH, expBottom)), 0);

    // Crop must be strictly smaller than the full frame (margins didn't blow
    // past the 75% area cap for this well-centred pose).
    expect(rect.width * rect.height).toBeLessThan(sW * sH);
  });

  test('clamps to image bounds when margins would overflow', () => {
    // Pose hugging the very top-left corner — margins would push negative.
    const kps: Keypoint[] = [
      kp('nose', 0.02, 0.02),
      kp('leftShoulder', 0.06, 0.05), kp('rightShoulder', 0.01, 0.05),
      kp('leftHip', 0.05, 0.20), kp('rightHip', 0.02, 0.20),
      kp('leftAnkle', 0.05, 0.35), kp('rightAnkle', 0.02, 0.35),
    ];
    const rect = personCropRect(kps, 1080, 1920);
    // Either clamped to a valid in-bounds rect, or rejected as too small —
    // both are acceptable, but it must never be null due to a crash and
    // must never extend past the frame.
    if (rect) {
      expect(rect.originX).toBeGreaterThanOrEqual(0);
      expect(rect.originY).toBeGreaterThanOrEqual(0);
      expect(rect.originX + rect.width).toBeLessThanOrEqual(1080);
      expect(rect.originY + rect.height).toBeLessThanOrEqual(1920);
    }
  });

  test('null when no keypoint clears the score floor', () => {
    const kps = standingPose().map((k) => ({ ...k, score: 0.1 }));
    expect(personCropRect(kps, 1080, 1920)).toBeNull();
  });

  test('null for a degenerate (single-point) bbox', () => {
    const kps: Keypoint[] = [kp('nose', 0.5, 0.5), kp('leftShoulder', 0.5, 0.5)];
    expect(personCropRect(kps, 1080, 1920)).toBeNull();
  });

  test('null when the margined crop would still be nearly the whole frame', () => {
    // Keypoints already spanning almost the entire frame — margins push it
    // over the 75% area cap, so refining wouldn't meaningfully help.
    const kps: Keypoint[] = [
      kp('nose', 0.50, 0.02),
      kp('leftShoulder', 0.90, 0.10), kp('rightShoulder', 0.10, 0.10),
      kp('leftHip', 0.85, 0.55), kp('rightHip', 0.15, 0.55),
      kp('leftAnkle', 0.80, 0.98), kp('rightAnkle', 0.20, 0.98),
    ];
    expect(personCropRect(kps, 1080, 1920)).toBeNull();
  });

  test('null when the crop would be smaller than the minimum side', () => {
    // A tiny cluster of keypoints near the centre — even with margins the
    // crop stays below C.minCropSide.
    const kps: Keypoint[] = [
      kp('nose', 0.500, 0.500),
      kp('leftShoulder', 0.501, 0.501), kp('rightShoulder', 0.499, 0.501),
    ];
    expect(personCropRect(kps, 4000, 4000)).toBeNull();
  });
});

describe('cropSquareToFullSquare / fullSquareToCropSquare round-trip', () => {
  const sW = 1080, sH = 1920;
  const cropRect: CropRect = { originX: 200, originY: 300, width: 500, height: 900 };

  test('crop-square → full-square → crop-square is the identity', () => {
    const u0 = 0.42, v0 = 0.61;
    const full = cropSquareToFullSquare(u0, v0, cropRect, sW, sH);
    const back = fullSquareToCropSquare(full.u, full.v, cropRect, sW, sH);
    expect(back.u).toBeCloseTo(u0, 6);
    expect(back.v).toBeCloseTo(v0, 6);
  });

  test('agrees with a direct source-pixel computation', () => {
    // Pick a point inside the crop, compute its full-square coords two ways:
    // (a) directly from its source pixel, (b) via the crop-square round trip.
    const cropPx = 120, cropPy = 400; // a source pixel inside the crop rect
    const sourcePx = cropPx + cropRect.originX;
    const sourcePy = cropPy + cropRect.originY;
    const direct = sourceToSquare(sourcePx, sourcePy, sW, sH);

    const cropSquare = sourceToSquare(cropPx, cropPy, cropRect.width, cropRect.height);
    const viaCrop = cropSquareToFullSquare(cropSquare.u, cropSquare.v, cropRect, sW, sH);

    expect(viaCrop.u).toBeCloseTo(direct.u, 6);
    expect(viaCrop.v).toBeCloseTo(direct.v, 6);
  });
});

describe('cropSquareLengthToFullSquare', () => {
  test('scales by Lc/L, independent of position', () => {
    const sW = 1080, sH = 1920; // L = 1920
    const cropRect: CropRect = { originX: 0, originY: 0, width: 500, height: 900 }; // Lc = 900
    const lengthInCrop = 0.10;
    const expected = lengthInCrop * (900 / 1920);
    expect(cropSquareLengthToFullSquare(lengthInCrop, cropRect, sW, sH)).toBeCloseTo(expected, 6);
  });

  test('a full-frame "crop" (no actual cropping) is the identity scale', () => {
    const sW = 800, sH = 800;
    const cropRect: CropRect = { originX: 0, originY: 0, width: 800, height: 800 };
    expect(cropSquareLengthToFullSquare(0.25, cropRect, sW, sH)).toBeCloseTo(0.25, 6);
  });
});
