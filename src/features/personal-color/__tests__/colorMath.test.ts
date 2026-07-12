// Pure colour-math tests — no native deps, no analyzePhoto/hook imports.
import {
  classifyUndertone, labHueAngleDeg, darkestFraction, nearestSwatch,
  type LAB,
} from '../colorMath';

describe('labHueAngleDeg', () => {
  test('45° for equal positive a/b', () => {
    expect(labHueAngleDeg({ L: 50, a: 10, b: 10 })).toBeCloseTo(45, 5);
  });

  test('stays within [0, 360)', () => {
    const angles = [
      { L: 50, a: 10, b: 10 },
      { L: 50, a: -10, b: 10 },
      { L: 50, a: -10, b: -10 },
      { L: 50, a: 10, b: -10 },
    ].map(labHueAngleDeg);
    for (const a of angles) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(360);
    }
    // negative b (4th quadrant of atan2) should wrap up near 315°, not go negative
    expect(labHueAngleDeg({ L: 50, a: 10, b: -10 })).toBeCloseTo(315, 5);
  });
});

describe('classifyUndertone', () => {
  test('golden skin (b≈22, a≈13, ~59°) reads warm', () => {
    const lab: LAB = { L: 60, a: 13, b: 22 };
    expect(labHueAngleDeg(lab)).toBeGreaterThanOrEqual(57);
    expect(classifyUndertone(lab)).toBe('warm');
  });

  test('rosy skin (b≈14, a≈15, ~43°) reads cool', () => {
    const lab: LAB = { L: 60, a: 15, b: 14 };
    expect(labHueAngleDeg(lab)).toBeLessThanOrEqual(47);
    expect(classifyUndertone(lab)).toBe('cool');
  });

  test('in-between hue (~52°) reads neutral', () => {
    const lab: LAB = { L: 60, a: 15, b: 15 * Math.tan((52 * Math.PI) / 180) };
    const angle = labHueAngleDeg(lab);
    expect(angle).toBeGreaterThan(47);
    expect(angle).toBeLessThan(57);
    expect(classifyUndertone(lab)).toBe('neutral');
  });
});

describe('darkestFraction', () => {
  test('picks the lowest-L subset, ceil(n × frac) of them', () => {
    const labs: LAB[] = [10, 20, 30, 40, 50].map(L => ({ L, a: 0, b: 0 }));
    const dark = darkestFraction(labs, 0.4); // ceil(5*0.4) = 2
    expect(dark).toHaveLength(2);
    expect(dark.map(l => l.L).sort((a, b) => a - b)).toEqual([10, 20]);
  });

  test('handles an empty input', () => {
    expect(darkestFraction([], 0.4)).toEqual([]);
  });
});

describe('nearestSwatch', () => {
  test('a clear winner produces a high margin', () => {
    const swatches = [
      { key: 'near' as const, lab: { L: 50, a: 0, b: 0 } },
      { key: 'far' as const, lab: { L: 50, a: 100, b: 100 } },
    ];
    const result = nearestSwatch({ L: 51, a: 1, b: 1 }, swatches);
    expect(result).not.toBeNull();
    expect(result!.key).toBe('near');
    expect(result!.margin).toBeGreaterThan(0.15);
  });

  test('two equidistant swatches produce a margin near zero', () => {
    const swatches = [
      { key: 'a' as const, lab: { L: 50, a: -10, b: 0 } },
      { key: 'b' as const, lab: { L: 50, a: 10, b: 0 } },
    ];
    const result = nearestSwatch({ L: 50, a: 0, b: 0 }, swatches);
    expect(result).not.toBeNull();
    expect(Math.abs(result!.margin)).toBeCloseTo(0, 5);
  });

  test('null on an empty swatch list', () => {
    expect(nearestSwatch({ L: 50, a: 0, b: 0 }, [])).toBeNull();
  });
});
