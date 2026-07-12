// Unit tests for the pure silhouette geometry — synthetic masks, no native deps.
import {
  runWidthAt, bandExtremeWidth, extractWidths, S,
  type SilhouetteMask,
} from '../silhouetteMath';
import type { Keypoint } from '../poseEstimate';

const SIZE = 64;

/** Build a mask from row specs: for each row index, a list of [x0, x1] runs. */
function makeMask(rows: Record<number, Array<[number, number]>>): SilhouetteMask {
  const data = new Float32Array(SIZE * SIZE);
  for (const [rowStr, runs] of Object.entries(rows)) {
    const row = Number(rowStr);
    for (const [x0, x1] of runs) {
      for (let x = x0; x <= x1; x++) data[row * SIZE + x] = 1;
    }
  }
  return { data, size: SIZE };
}

/** A simple standing "person": torso rows 10..40, hips flare 41..50, legs below. */
function personMask(): SilhouetteMask {
  const rows: Record<number, Array<[number, number]>> = {};
  for (let r = 10; r <= 15; r++) rows[r] = [[20, 43]];   // shoulders (wide)
  for (let r = 16; r <= 30; r++) rows[r] = [[24, 39]];   // chest → mid torso
  for (let r = 31; r <= 36; r++) rows[r] = [[26, 37]];   // waist (narrowest)
  for (let r = 37; r <= 50; r++) rows[r] = [[22, 41]];   // hips/seat (flare)
  for (let r = 51; r <= 60; r++) rows[r] = [[25, 30], [33, 38]]; // two legs
  return makeMask(rows);
}

const yOf = (row: number) => row / (SIZE - 1);

describe('runWidthAt', () => {
  test('measures the centreline run only — detached blob excluded', () => {
    // Torso run 20..40 plus a detached "arm" 50..55 separated by a gap.
    const mask = makeMask({ 32: [[20, 40], [50, 55]] });
    const w = runWidthAt(mask, yOf(32), 30 / (SIZE - 1));
    expect(w).toBeCloseTo(21 / SIZE, 5);
  });

  test('returns null when no person pixel near the centreline', () => {
    const mask = makeMask({ 32: [[50, 55]] });
    expect(runWidthAt(mask, yOf(32), 10 / (SIZE - 1))).toBeNull();
  });

  test('nudges onto the run when the centreline lands on a small hole', () => {
    const mask = makeMask({ 32: [[20, 28], [31, 40]] }); // hole at 29-30
    const w = runWidthAt(mask, yOf(32), 30 / (SIZE - 1));
    expect(w).not.toBeNull(); // nudged into one of the adjacent runs
  });
});

describe('bandExtremeWidth', () => {
  test('min finds the narrowest row, max the widest', () => {
    const mask = personMask();
    const cx = 31 / (SIZE - 1);
    const min = bandExtremeWidth(mask, yOf(16), yOf(40), cx, 'min');
    const max = bandExtremeWidth(mask, yOf(10), yOf(50), cx, 'max');
    expect(min).toBeCloseTo(12 / SIZE, 5); // waist rows 26..37
    expect(max).toBeCloseTo(24 / SIZE, 5); // shoulder rows 20..43
  });

  test('null when fewer than minBandRows valid rows', () => {
    const mask = makeMask({ 32: [[20, 40]] }); // single row only
    expect(bandExtremeWidth(mask, yOf(31), yOf(33), 30 / (SIZE - 1), 'min')).toBeNull();
    expect(S.minBandRows).toBeGreaterThan(1);
  });
});

describe('extractWidths', () => {
  const kp = (name: string, x: number, yRow: number, score = 0.9): Keypoint =>
    ({ name, x, y: yOf(yRow), score });

  function poseKps(): Keypoint[] {
    return [
      kp('leftShoulder', 40 / SIZE, 12), kp('rightShoulder', 23 / SIZE, 12),
      kp('leftHip', 38 / SIZE, 42), kp('rightHip', 25 / SIZE, 42),
      kp('leftAnkle', 36 / SIZE, 60), kp('rightAnkle', 27 / SIZE, 60),
    ];
  }

  test('fuses pose heights with contour widths: waist < chest < shoulder ≤ hip band max', () => {
    const w = extractWidths(personMask(), poseKps());
    expect(w).not.toBeNull();
    expect(w!.waistU).toBeCloseTo(12 / SIZE, 5);      // narrowest mid-torso row
    expect(w!.shoulderU).toBeCloseTo(24 / SIZE, 5);   // widest shoulder row
    expect(w!.hipU).toBeCloseTo(20 / SIZE, 5);        // widest seat row
    expect(w!.waistU!).toBeLessThan(w!.chestU!);
  });

  test('null without confident shoulders/hips', () => {
    const kps = poseKps().map((k) =>
      k.name === 'leftHip' ? { ...k, score: 0.1 } : k);
    expect(extractWidths(personMask(), kps)).toBeNull();
  });
});
