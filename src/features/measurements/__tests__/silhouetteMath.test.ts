// Unit tests for the pure silhouette geometry — synthetic masks, no native deps.
import {
  runWidthAt, bandExtremeWidth, bandExtremeWidthRow, extractWidths, maskVerticalExtent,
  fillNCHWFloat, eraseDisk, S,
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

describe('bandExtremeWidthRow', () => {
  test('reports WHICH row won each extreme, not just the width', () => {
    const mask = personMask();
    const cx = 31 / (SIZE - 1);
    // Scanning rows 16..40: chest (16-30, width16) then waist (31-36, width12)
    // then hip flare starts (37-40, width20) — narrowest is the waist rows,
    // and the scan hits row 31 first (ties at 32..36 don't overwrite it).
    const min = bandExtremeWidthRow(mask, yOf(16), yOf(40), cx, 'min');
    expect(min?.width).toBeCloseTo(12 / SIZE, 5);
    expect(min?.row).toBe(31);
    // Scanning rows 10..50: shoulders (10-15, width24) are the widest, and
    // the scan hits row 10 first (ties at 11..15 don't overwrite it).
    const max = bandExtremeWidthRow(mask, yOf(10), yOf(50), cx, 'max');
    expect(max?.width).toBeCloseTo(24 / SIZE, 5);
    expect(max?.row).toBe(10);
  });

  test('bandExtremeWidth is a thin width-only wrapper over the same result', () => {
    const mask = personMask();
    const cx = 31 / (SIZE - 1);
    const row = bandExtremeWidthRow(mask, yOf(16), yOf(40), cx, 'min');
    const width = bandExtremeWidth(mask, yOf(16), yOf(40), cx, 'min');
    expect(width).toBe(row?.width);
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

// ── Sub-pixel edge refinement ──────────────────────────────────────────────
// Binary (0/1) masks — used everywhere above — can't exercise the sub-pixel
// interpolation itself: a hard 0→1 step crosses threshold=0.5 exactly
// halfway between the two pixels, so it reduces to the same result as the
// old whole-pixel-run count (see the `runWidthAt` doc comment). These tests
// use GRADED probability values (a soft edge, as a real segmentation mask
// would produce) to show the fractional result actually shifts.

/** A row with an explicit probability at each x (defaults to 0 elsewhere). */
function gradedRowMask(row: number, values: Record<number, number>): SilhouetteMask {
  const data = new Float32Array(SIZE * SIZE);
  for (const [xStr, v] of Object.entries(values)) data[row * SIZE + Number(xStr)] = v;
  return { data, size: SIZE };
}

describe('runWidthAt — sub-pixel edge refinement', () => {
  test('a soft edge interpolates the sub-pixel crossing position', () => {
    // Run interior 22..38 solid; left edge graded 0.2 at x=20 (below
    // threshold, so the per-pixel scan stops there) and 0.7 at x=21 (above
    // threshold, the last in-run pixel) — the true 0.5 crossing sits between
    // them, at x = 20 + (0.5-0.2)/(0.7-0.2) = 20.6 (closer to 21 than to 20,
    // since 0.7 is only just above threshold). Right edge is a clean binary
    // step (1 → 0) so its crossing is the flat x=38.5 as before.
    const values: Record<number, number> = { 20: 0.2, 21: 0.7 };
    for (let x = 22; x <= 38; x++) values[x] = 1;
    values[39] = 0;
    const mask = gradedRowMask(32, values);
    const w = runWidthAt(mask, yOf(32), 30 / (SIZE - 1));
    expect(w).not.toBeNull();
    const expected = (38.5 - 20.6) / SIZE;
    expect(w!).toBeCloseTo(expected, 6);
    // And it genuinely differs from the naive whole-pixel-run width (21..38)
    // a pre-subpixel implementation would have reported.
    const naiveWholePixelWidth = (38 - 21 + 1) / SIZE;
    expect(w!).not.toBeCloseTo(naiveWholePixelWidth, 3);
  });

  test('a run touching the image border extends by a flat half-pixel', () => {
    const mask = gradedRowMask(32, { 0: 1, 1: 1, 2: 1 });
    const w = runWidthAt(mask, yOf(32), 1 / (SIZE - 1));
    // No left neighbour (x=-1 doesn't exist) → left edge falls back to -0.5;
    // right edge (x=3, value 0 < threshold) interpolates normally to 2.5.
    expect(w).toBeCloseTo(3 / SIZE, 5);
  });

  test('binary masks (as used elsewhere in this file) are unaffected — threshold=0.5 crosses exactly halfway', () => {
    const mask = makeMask({ 32: [[20, 40]] });
    const w = runWidthAt(mask, yOf(32), 30 / (SIZE - 1));
    expect(w).toBeCloseTo(21 / SIZE, 6); // byte-identical to the old integer-run formula
  });
});

describe('maskVerticalExtent', () => {
  test('finds the top and bottom rows of a standing person mask', () => {
    // NOTE: personMask()'s leg gap is only 2px (31..32) — within runWidthAt's
    // ±4px nudge — so even the single torso-centre probe reaches the feet
    // here. The wide-gap case below is what actually needs multiple probes.
    const mask = personMask();
    const cx = 31 / (SIZE - 1);
    const extent = maskVerticalExtent(mask, [cx]);
    expect(extent).not.toBeNull();
    expect(extent!.topV).toBeCloseTo(yOf(10), 5);  // shoulders start at row 10
    expect(extent!.botV).toBeCloseTo(yOf(60), 5);  // legs end at row 60
  });

  test('multi-probe scan reaches the feet when the leg gap defeats the centreline probe', () => {
    // Standing person with legs spread WIDE below the crotch (rows 51..60):
    // gap 26..37 (12px) — far beyond runWidthAt's ±4px sideways nudge from
    // the torso centre x=31. This is the real-world "feet slightly apart"
    // case the multi-probe signature exists for: a single-centreline scan
    // stops at the crotch and reports roughly half the true extent.
    const rows: Record<number, Array<[number, number]>> = {};
    for (let r = 10; r <= 15; r++) rows[r] = [[20, 43]];           // shoulders
    for (let r = 16; r <= 50; r++) rows[r] = [[24, 39]];           // torso → hips
    for (let r = 51; r <= 60; r++) rows[r] = [[20, 25], [38, 43]]; // legs, wide gap
    const mask = makeMask(rows);
    const torsoCx = 31 / (SIZE - 1);
    const leftAnkleX = 22 / (SIZE - 1);
    const rightAnkleX = 40 / (SIZE - 1);

    // Single torso-centre probe: stops at the crotch (row 50) — the defect.
    const single = maskVerticalExtent(mask, [torsoCx]);
    expect(single).not.toBeNull();
    expect(single!.botV).toBeCloseTo(yOf(50), 5);

    // Multi-probe (torso centre + both ankles): reaches the feet rows.
    const multi = maskVerticalExtent(mask, [torsoCx, leftAnkleX, rightAnkleX]);
    expect(multi).not.toBeNull();
    expect(multi!.topV).toBeCloseTo(yOf(10), 5);
    expect(multi!.botV).toBeCloseTo(yOf(60), 5);
  });

  test('rejects a sub-2px speck as noise', () => {
    // A single stray pixel far above the body — must not extend topV up there.
    const mask = personMask();
    mask.data[2 * SIZE + 31] = 1; // isolated speck at row 2, width 1px
    const extent = maskVerticalExtent(mask, [31 / (SIZE - 1)]);
    expect(extent).not.toBeNull();
    expect(extent!.topV).toBeCloseTo(yOf(10), 5); // still starts at the real shoulders, not the speck
  });

  test('null when fewer than minBandRows rows have a valid run', () => {
    const mask = makeMask({ 32: [[20, 40]] }); // a single populated row
    expect(maskVerticalExtent(mask, [30 / (SIZE - 1)])).toBeNull();
  });

  test('null for an empty mask or an empty probe list', () => {
    const mask: SilhouetteMask = { data: new Float32Array(SIZE * SIZE), size: SIZE };
    expect(maskVerticalExtent(mask, [0.5])).toBeNull();
    expect(maskVerticalExtent(personMask(), [])).toBeNull();
  });
});

// ── fillNCHWFloat — MODNet's channel-planar input fill ───────────────────────
// Fills a tiny synthetic 2×2 image into a 3×2×2 (channel, row, col) NCHW
// buffer and asserts the exact plane/row/col arithmetic — this layout is
// completely different from the HWC (interleaved) fill every other model in
// this feature uses, so it needs its own dedicated correctness test.

describe('fillNCHWFloat', () => {
  const norm = (p: number) => (p / 255 - 0.5) / 0.5;

  /** A 2×2 RGBA image with distinct, easily-traceable channel values per pixel. */
  function tinyImage(): Uint8Array {
    // Row-major (y, then x): (0,0) (1,0) (0,1) (1,1)
    return new Uint8Array([
      10, 20, 30, 255,     // pixel (0,0): R=10 G=20 B=30
      40, 50, 60, 255,     // pixel (1,0): R=40 G=50 B=60
      70, 80, 90, 255,     // pixel (0,1): R=70 G=80 B=90
      100, 110, 120, 255,  // pixel (1,1): R=100 G=110 B=120
    ]);
  }

  test('no letterbox padding: fills a 2×2 image into a 2×2 NCHW buffer, R/G/B planes in order', () => {
    const out = fillNCHWFloat(tinyImage(), 2, 2, 2, 0, 0);
    expect(out).toHaveLength(2 * 2 * 3);

    // Precision 6 (not tighter): `out` is a Float32Array, whose ~7-digit
    // precision doesn't exactly reproduce a float64 `norm()` computation.

    // Plane 0 (R), row-major: pixelIdx 0=(0,0) 1=(1,0) 2=(0,1) 3=(1,1).
    expect(out[0]).toBeCloseTo(norm(10), 6);
    expect(out[1]).toBeCloseTo(norm(40), 6);
    expect(out[2]).toBeCloseTo(norm(70), 6);
    expect(out[3]).toBeCloseTo(norm(100), 6);

    // Plane 1 (G) starts at offset pixelCount=4, SAME pixel order.
    expect(out[4]).toBeCloseTo(norm(20), 6);
    expect(out[5]).toBeCloseTo(norm(50), 6);
    expect(out[6]).toBeCloseTo(norm(80), 6);
    expect(out[7]).toBeCloseTo(norm(110), 6);

    // Plane 2 (B) starts at offset 2×pixelCount=8.
    expect(out[8]).toBeCloseTo(norm(30), 6);
    expect(out[9]).toBeCloseTo(norm(60), 6);
    expect(out[10]).toBeCloseTo(norm(90), 6);
    expect(out[11]).toBeCloseTo(norm(120), 6);
  });

  test('letterbox padding is pre-filled with -1 (black in MODNet\'s [-1,1] convention), not left at 0', () => {
    // 2×2 image centred into a 4×4 buffer (offX=offY=1) — the outer ring is
    // padding. MODNet's normalisation means the buffer's raw-zero default
    // would be MID-GRAY, not black (unlike every other model in this
    // feature) — fillNCHWFloat must pre-fill with -1 explicitly.
    const out = fillNCHWFloat(tinyImage(), 2, 2, 4, 1, 1);
    const pixelCount = 16;

    // A padding pixel, e.g. (0,0) in dest space (outside the centred 2×2).
    const paddingIdx = 0 * 4 + 0;
    expect(out[0 * pixelCount + paddingIdx]).toBeCloseTo(-1, 10);
    expect(out[1 * pixelCount + paddingIdx]).toBeCloseTo(-1, 10);
    expect(out[2 * pixelCount + paddingIdx]).toBeCloseTo(-1, 10);

    // The centred real pixel (0,0) of the source lands at dest (1,1) →
    // pixelIdx = 1*4+1 = 5.
    const centredIdx = 1 * 4 + 1;
    expect(out[0 * pixelCount + centredIdx]).toBeCloseTo(norm(10), 6);
    expect(out[1 * pixelCount + centredIdx]).toBeCloseTo(norm(20), 6);
    expect(out[2 * pixelCount + centredIdx]).toBeCloseTo(norm(30), 6);
  });

  test('output length is always 3 × destSize²', () => {
    const out = fillNCHWFloat(tinyImage(), 2, 2, 8, 3, 3);
    expect(out).toHaveLength(3 * 8 * 8);
  });
});

// ── runWidthAt's centreline nudge — size-relative (2026-07-12) ──────────────
// MODNet's 512-sized mask made a FIXED 4px nudge proportionally half as wide
// as it was for the 256-sized masks this module originally shipped with —
// the nudge is now max(4, round(size*0.02)) so it covers the same fraction
// of the body regardless of mask size.

describe('runWidthAt — size-relative centreline nudge', () => {
  test('at size 64 (existing tests\' size), the nudge is still exactly 4px', () => {
    // max(4, round(64*0.02)) = max(4, 1) = 4 — byte-identical to the old
    // fixed constant at this mask size, so every pre-existing test above
    // (all built at SIZE=64) is unaffected by this change.
    const mask = makeMask({ 32: [[20, 28], [31, 40]] }); // hole at 29-30, within old ±4px
    const w = runWidthAt(mask, yOf(32), 30 / (SIZE - 1));
    expect(w).not.toBeNull();
  });

  test('at size 512, a hole wider than the OLD fixed 4px nudge is bridged by the new size-relative one', () => {
    const bigSize = 512;
    const data = new Float32Array(bigSize * bigSize);
    const row = 256;
    // A run 100..245, a hole 246..255 (10px), then a second run 256..400.
    // The centreline (x=250) sits in the hole, 5px from the left run's edge
    // (245) and 6px from the right run's edge (256) — BOTH beyond the OLD
    // fixed ±4px nudge (which would return null), but within the NEW
    // size-relative one: max(4, round(512*0.02)) = max(4, 10) = 10.
    for (let x = 100; x <= 245; x++) data[row * bigSize + x] = 1;
    for (let x = 256; x <= 400; x++) data[row * bigSize + x] = 1;
    const mask: SilhouetteMask = { data, size: bigSize };

    const centerXNorm = 250 / (bigSize - 1); // inside the 246-255 hole
    const w = runWidthAt(mask, row / (bigSize - 1), centerXNorm);
    expect(w).not.toBeNull();
  });

  test('at size 512, a hole wider than the size-relative nudge is still not bridged', () => {
    const bigSize = 512;
    const data = new Float32Array(bigSize * bigSize);
    const row = 256;
    for (let x = 100; x <= 200; x++) data[row * bigSize + x] = 1;
    for (let x = 260; x <= 400; x++) data[row * bigSize + x] = 1; // hole 201-259, 59px — far beyond the nudge
    const mask: SilhouetteMask = { data, size: bigSize };

    const centerXNorm = 230 / (bigSize - 1); // deep inside the hole
    expect(runWidthAt(mask, row / (bigSize - 1), centerXNorm)).toBeNull();
  });
});

// ── Row-fraction registration (2026-07, side-view capture) ─────────────────
// extractWidths now also reports WHERE each extreme row sat, as a fraction
// of the shoulder→hip vertical span — this is how the side (profile) capture
// pass re-locates the SAME anatomical rows on a completely different photo.
// Uses a DEDICATED mask (not personMask(), whose flat-width regions tie
// across many rows and would make the winning row ambiguous/order-dependent)
// with a single unambiguous peak/trough row in each band, deliberately
// offset from the band's naive midpoint so the assertions exercise the real
// row search, not just an echo of the S.* config constants.

describe('extractWidths — row-fraction registration', () => {
  const CX = 32;

  /** Paint one row with a run of `width` centred on column CX. */
  function paintRow(data: Float32Array, size: number, row: number, width: number) {
    const half = Math.floor(width / 2);
    const x0 = CX - half;
    for (let x = x0; x < x0 + width; x++) data[row * size + x] = 1;
  }

  function rowFracMask(): SilhouetteMask {
    const data = new Float32Array(SIZE * SIZE);
    // Chest band (rows 17..23, S.chestAt=0.25 target row 20): unique max at
    // row 21 (width 30), everything else in-band width 10.
    for (let r = 17; r <= 23; r++) paintRow(data, SIZE, r, r === 21 ? 30 : 10);
    // Waist band (rows 28..44): unique min at row 33 (width 8), everything
    // else in-band width 25.
    for (let r = 28; r <= 44; r++) paintRow(data, SIZE, r, r === 33 ? 8 : 25);
    // Hip band (rows 48..53): unique max at row 52 (width 22), everything
    // else in-band width 5.
    for (let r = 48; r <= 53; r++) paintRow(data, SIZE, r, r === 52 ? 22 : 5);
    return { data, size: SIZE };
  }

  function rowFracKps(): Keypoint[] {
    const x = CX / (SIZE - 1);
    const kp = (name: string, yRow: number): Keypoint => ({ name, x, y: yRow / (SIZE - 1), score: 0.9 });
    return [
      kp('leftShoulder', 10), kp('rightShoulder', 10),
      kp('leftHip', 50), kp('rightHip', 50),
      kp('leftAnkle', 60), kp('rightAnkle', 60),
    ];
  }

  test('chest/waist/hip row fractions match the (offset-from-naive) unique extreme row', () => {
    const w = extractWidths(rowFracMask(), rowFracKps());
    expect(w).not.toBeNull();
    // torso = hipY(row50) - shoulderY(row10) = 40 rows.
    expect(w!.chestRowFrac).toBeCloseTo((21 - 10) / 40, 6); // 0.275
    expect(w!.waistRowFrac).toBeCloseTo((33 - 10) / 40, 6); // 0.575
    // Hip row (52) sits BELOW the hip joint line (row 50) — frac > 1, exactly
    // the "seat band extends below the hip joints" case documented on
    // SilhouetteWidths.hipRowFrac.
    expect(w!.hipRowFrac).toBeCloseTo((52 - 10) / 40, 6); // 1.05
    expect(w!.hipRowFrac!).toBeGreaterThan(1);
  });

  test('row fractions are absent exactly when their width is (both undefined together)', () => {
    // Degenerate mask: nothing painted at all → every band scan fails.
    const empty: SilhouetteMask = { data: new Float32Array(SIZE * SIZE), size: SIZE };
    expect(extractWidths(empty, rowFracKps())).toBeNull();
  });
});

// ── eraseDisk (2026-07, side-view hand erasure) ─────────────────────────────
// Zeroes mask probabilities inside a disk — used to erase the hands from a
// profile mask (relaxed arms put wrists near seat/hip level) before the
// side-view hip-depth scan runs.

describe('eraseDisk', () => {
  function fullMask(): SilhouetteMask {
    return { data: new Float32Array(SIZE * SIZE).fill(1), size: SIZE };
  }

  test('zeroes pixels inside the disk, leaves the rest untouched', () => {
    const mask = fullMask();
    const cx = 32 / (SIZE - 1);
    const cy = 32 / (SIZE - 1);
    const radius = 5 / (SIZE - 1);
    eraseDisk(mask, cx, cy, radius);

    // Centre pixel — well inside the disk.
    expect(mask.data[32 * SIZE + 32]).toBe(0);
    // A corner far from the disk — untouched.
    expect(mask.data[0 * SIZE + 0]).toBe(1);
    // Just past the radius on the cardinal axis — untouched.
    expect(mask.data[32 * SIZE + (32 + 8)]).toBe(1);
  });

  test('radius 0 is a true no-op — not even the centre pixel is zeroed', () => {
    const mask = fullMask();
    const cx = 32 / (SIZE - 1);
    const cy = 32 / (SIZE - 1);
    eraseDisk(mask, cx, cy, 0);
    expect(mask.data[32 * SIZE + 32]).toBe(1);
  });

  test('an out-of-range centre is clamped, not a crash — partial disk erased at the edge', () => {
    const mask = fullMask();
    // Centre well outside the mask (negative), radius large enough that the
    // disk still clips into the mask's top-left corner.
    const cx = -10 / (SIZE - 1);
    const cy = -10 / (SIZE - 1);
    const radius = 15 / (SIZE - 1);
    expect(() => eraseDisk(mask, cx, cy, radius)).not.toThrow();
    // A pixel near the top-left corner, within the clipped disk, is zeroed.
    expect(mask.data[0 * SIZE + 0]).toBe(0);
    // A pixel far from the corner is untouched.
    expect(mask.data[(SIZE - 1) * SIZE + (SIZE - 1)]).toBe(1);
  });
});
