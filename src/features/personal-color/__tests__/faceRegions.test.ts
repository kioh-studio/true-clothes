// Pure face-region geometry tests — no native deps, synthetic keypoint
// fixture only (no real BlazeFace/model involved).
import { computeFaceRegions, type FaceBox, type FaceKeypoints, type PixelRect } from '../faceRegions';

// A plausible frontal-face fixture in a 300×400 (portrait) image: eyes level
// at y=150, ~60px apart, nose/mouth below, ears out to the sides, box roughly
// bounding the whole head.
const IMG_W = 300;
const IMG_H = 400;
const KP: FaceKeypoints = {
  rightEye: { x: 110 / IMG_W, y: 150 / IMG_H },
  leftEye:  { x: 170 / IMG_W, y: 150 / IMG_H },
  nose:     { x: 140 / IMG_W, y: 190 / IMG_H },
  mouth:    { x: 140 / IMG_W, y: 230 / IMG_H },
  rightEar: { x: 70 / IMG_W,  y: 160 / IMG_H },
  leftEar:  { x: 210 / IMG_W, y: 160 / IMG_H },
};
const BOX: FaceBox = { x: 60 / IMG_W, y: 80 / IMG_H, width: 180 / IMG_W, height: 260 / IMG_H };

function rectContains(outer: PixelRect, inner: { x: number; y: number }): boolean {
  return inner.x >= outer.x && inner.x <= outer.x + outer.width
    && inner.y >= outer.y && inner.y <= outer.y + outer.height;
}

function withinImageBounds(r: PixelRect): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.width <= IMG_W + 1e-6 && r.y + r.height <= IMG_H + 1e-6
    && r.width >= 0 && r.height >= 0;
}

describe('computeFaceRegions', () => {
  const regions = computeFaceRegions(IMG_W, IMG_H, BOX, KP);

  test('all regions are clamped within the image bounds', () => {
    withinImageBounds(regions.cheekRegions[0]);
    withinImageBounds(regions.cheekRegions[1]);
    withinImageBounds(regions.foreheadRegion);
    withinImageBounds(regions.eyeRegions[0]);
    withinImageBounds(regions.eyeRegions[1]);
    for (const r of [
      regions.cheekRegions[0], regions.cheekRegions[1],
      regions.foreheadRegion, regions.eyeRegions[0], regions.eyeRegions[1],
    ]) {
      expect(withinImageBounds(r)).toBe(true);
    }
    if (regions.hairBand) expect(withinImageBounds(regions.hairBand)).toBe(true);
  });

  test('cheek regions sit laterally between eye and mouth, pushed toward the ear side', () => {
    const [rightCheek, leftCheek] = regions.cheekRegions;
    const rightCenterX = rightCheek.x + rightCheek.width / 2;
    const leftCenterX = leftCheek.x + leftCheek.width / 2;
    // Right cheek (near right eye/ear, smaller x) should sit left of the
    // left cheek (near left eye/ear, larger x) in this fixture's layout.
    expect(rightCenterX).toBeLessThan(leftCenterX);
    // Pushed toward the ear: right cheek center should be closer to the
    // right ear x than the raw eye-mouth midpoint x (140) would be.
    const rightMidX = (KP.rightEye.x * IMG_W + KP.mouth.x * IMG_W) / 2;
    expect(Math.abs(rightCenterX - KP.rightEar.x * IMG_W)).toBeLessThan(Math.abs(rightMidX - KP.rightEar.x * IMG_W));
  });

  test('cheek region size scales with inter-ocular distance', () => {
    const iod = 60; // rightEye/leftEye are 60px apart in the fixture
    const [rightCheek] = regions.cheekRegions;
    expect(rightCheek.width).toBeCloseTo(0.22 * iod, 1);
    expect(rightCheek.height).toBeCloseTo(0.18 * iod, 1);
  });

  test('forehead region sits above the eye line, spanning between the eyes', () => {
    const eyeLineY = 150;
    expect(regions.foreheadRegion.y + regions.foreheadRegion.height).toBeLessThanOrEqual(eyeLineY);
    // Roughly centred between the two eyes horizontally.
    const foreheadCenterX = regions.foreheadRegion.x + regions.foreheadRegion.width / 2;
    expect(foreheadCenterX).toBeCloseTo(140, 0);
  });

  test('eye regions are centred on each eye keypoint', () => {
    const [rightEyeRegion, leftEyeRegion] = regions.eyeRegions;
    expect(rectContains(rightEyeRegion, { x: 110, y: 150 })).toBe(true);
    expect(rectContains(leftEyeRegion, { x: 170, y: 150 })).toBe(true);
    const iod = 60;
    expect(rightEyeRegion.width).toBeCloseTo(0.30 * iod, 1);
    expect(rightEyeRegion.height).toBeCloseTo(0.16 * iod, 1);
  });

  test('hair band spans the full image width above the face box top edge', () => {
    expect(regions.hairBand).not.toBeNull();
    expect(regions.hairBand!.x).toBe(0);
    expect(regions.hairBand!.y).toBe(0);
    expect(regions.hairBand!.width).toBe(IMG_W);
    expect(regions.hairBand!.height).toBeCloseTo(BOX.y * IMG_H, 1);
  });

  test('hair band is null when the face box touches the top of the frame', () => {
    const touchingTopBox: FaceBox = { ...BOX, y: 0 };
    const r = computeFaceRegions(IMG_W, IMG_H, touchingTopBox, KP);
    expect(r.hairBand).toBeNull();
  });

  test('hair band is null when the box top is within the 8px minimum', () => {
    const nearTopBox: FaceBox = { ...BOX, y: 5 / IMG_H };
    const r = computeFaceRegions(IMG_W, IMG_H, nearTopBox, KP);
    expect(r.hairBand).toBeNull();
  });

  test('degenerate (zero inter-ocular distance) input does not throw and stays in-bounds', () => {
    const degenerateKp: FaceKeypoints = { ...KP, leftEye: KP.rightEye };
    expect(() => computeFaceRegions(IMG_W, IMG_H, BOX, degenerateKp)).not.toThrow();
    const r = computeFaceRegions(IMG_W, IMG_H, BOX, degenerateKp);
    for (const rect of [r.cheekRegions[0], r.cheekRegions[1], r.foreheadRegion, r.eyeRegions[0], r.eyeRegions[1]]) {
      expect(withinImageBounds(rect)).toBe(true);
    }
  });

  test('a keypoint near the image edge still produces a clamped, in-bounds region', () => {
    const edgeKp: FaceKeypoints = {
      ...KP,
      rightEye: { x: 1 / IMG_W, y: 1 / IMG_H },
    };
    const r = computeFaceRegions(IMG_W, IMG_H, BOX, edgeKp);
    expect(withinImageBounds(r.eyeRegions[0])).toBe(true);
  });
});
