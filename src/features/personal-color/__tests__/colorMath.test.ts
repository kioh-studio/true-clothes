// Pure colour-math tests — no native deps, no analyzePhoto/hook imports.
import {
  classifyUndertone, labHueAngleDeg, darkestFraction, nearestSwatch,
  srgbToLinear, linearToSrgb, subtractAmbient, itaDeg, itaToValueAxis,
  chromaC, scleraGains, applyGains,
  type LAB, type RGB,
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

describe('srgbToLinear / linearToSrgb round-trip', () => {
  test('round-trips a range of channel values within floating-point tolerance', () => {
    const samples = [0, 1, 12, 55, 128, 200, 254, 255];
    for (const v of samples) {
      const rgb: RGB = { r: v, g: v, b: v };
      const back = linearToSrgb(srgbToLinear(rgb));
      expect(back.r).toBeCloseTo(v, 5);
      expect(back.g).toBeCloseTo(v, 5);
      expect(back.b).toBeCloseTo(v, 5);
    }
  });

  test('linear values stay within [0, 1] for valid sRGB input', () => {
    const lin = srgbToLinear({ r: 255, g: 128, b: 0 });
    expect(lin.r).toBeCloseTo(1, 5);
    expect(lin.g).toBeGreaterThan(0);
    expect(lin.g).toBeLessThan(1);
    expect(lin.b).toBe(0);
  });
});

describe('subtractAmbient', () => {
  test('identical flash/ambient pair subtracts to black', () => {
    const px: RGB = { r: 180, g: 120, b: 90 };
    const diff = subtractAmbient(px, px);
    expect(diff.r).toBeCloseTo(0, 3);
    expect(diff.g).toBeCloseTo(0, 3);
    expect(diff.b).toBeCloseTo(0, 3);
  });

  test('a known synthetic pair isolates the flash-only contribution', () => {
    // Ambient alone reads as a dim warm cast; flash+ambient reads brighter.
    // The subtraction should land close to (but not exceeding, given the
    // nonlinear round-trip) the flash-only reference on each channel.
    const ambient: RGB = { r: 40, g: 30, b: 20 };
    const flashOnlyLinear = srgbToLinear({ r: 150, g: 100, b: 80 });
    const ambientLinear = srgbToLinear(ambient);
    const combinedLinear = {
      r: flashOnlyLinear.r + ambientLinear.r,
      g: flashOnlyLinear.g + ambientLinear.g,
      b: flashOnlyLinear.b + ambientLinear.b,
    };
    const combined = linearToSrgb(combinedLinear);
    const diff = subtractAmbient(combined, ambient);
    expect(diff.r).toBeCloseTo(150, 0);
    expect(diff.g).toBeCloseTo(100, 0);
    expect(diff.b).toBeCloseTo(80, 0);
  });

  test('floors at 0 when ambient reads brighter than flash on a channel (noise)', () => {
    const diff = subtractAmbient({ r: 50, g: 50, b: 50 }, { r: 80, g: 50, b: 50 });
    expect(diff.r).toBe(0);
  });
});

describe('itaDeg', () => {
  test('L=50 (midpoint) gives ITA° of 0 regardless of b*', () => {
    expect(itaDeg({ L: 50, a: 10, b: 20 })).toBeCloseTo(0, 5);
  });

  test('hand-computed: L=70, b=20 → atan2(20,20)=45°', () => {
    expect(itaDeg({ L: 70, a: 5, b: 20 })).toBeCloseTo(45, 5);
  });

  test('hand-computed: L=20, b=30 → atan2(-30,30)=-45°', () => {
    expect(itaDeg({ L: 20, a: 5, b: 30 })).toBeCloseTo(-45, 5);
  });
});

describe('itaToValueAxis', () => {
  test('clamps at the light pole above 65°', () => {
    expect(itaToValueAxis(80)).toBe(1);
    expect(itaToValueAxis(65)).toBe(1);
  });

  test('clamps at the deep pole below -45°', () => {
    expect(itaToValueAxis(-60)).toBe(-1);
    expect(itaToValueAxis(-45)).toBe(-1);
  });

  test('anchor points map exactly', () => {
    expect(itaToValueAxis(55)).toBeCloseTo(2 / 3, 10);
    expect(itaToValueAxis(41)).toBeCloseTo(1 / 3, 10);
    expect(itaToValueAxis(28)).toBeCloseTo(0, 10);
    expect(itaToValueAxis(10)).toBeCloseTo(-1 / 3, 10);
    expect(itaToValueAxis(-30)).toBeCloseTo(-2 / 3, 10);
  });

  test('monotonically non-increasing as ITA° falls', () => {
    const points = [70, 65, 60, 55, 48, 41, 35, 28, 19, 10, -10, -30, -38, -45, -50];
    const values = points.map(itaToValueAxis);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1] + 1e-9);
    }
  });
});

describe('chromaC', () => {
  test('sqrt(a²+b²)', () => {
    expect(chromaC({ L: 50, a: 3, b: 4 })).toBeCloseTo(5, 10);
  });

  test('zero for a neutral gray (a=b=0)', () => {
    expect(chromaC({ L: 50, a: 0, b: 0 })).toBe(0);
  });
});

describe('scleraGains', () => {
  test('a perfectly neutral gray sample yields gains of 1 (no correction needed)', () => {
    const px: RGB = { r: 200, g: 200, b: 200 };
    const gains = scleraGains([px, px, px]);
    expect(gains).not.toBeNull();
    expect(gains!.r).toBeCloseTo(1, 5);
    expect(gains!.g).toBeCloseTo(1, 5);
    expect(gains!.b).toBeCloseTo(1, 5);
  });

  test('a mildly tinted white sample yields gains within the accepted range', () => {
    // Slightly warm-cast "white" — blue channel a bit low.
    const gains = scleraGains([{ r: 235, g: 230, b: 200 }]);
    expect(gains).not.toBeNull();
    expect(gains!.b).toBeGreaterThan(1); // blue under-read → gets boosted
  });

  test('refuses correction when a gain would fall outside [0.6, 1.6] (bloodshot/blue-lit)', () => {
    // Heavily red-tinted "sclera" (e.g. bloodshot) — red channel dominant
    // enough to push the blue/green gains past the safety cap.
    const gains = scleraGains([{ r: 255, g: 60, b: 40 }]);
    expect(gains).toBeNull();
  });

  test('null on an empty sample', () => {
    expect(scleraGains([])).toBeNull();
  });
});

describe('applyGains', () => {
  test('neutralizes a synthetically tinted grey back toward neutral', () => {
    // A "grey" that's actually tinted (blue channel low) — gains computed
    // from itself should bring all channels close together.
    const tinted: RGB = { r: 210, g: 205, b: 160 };
    const gains = scleraGains([tinted]);
    expect(gains).not.toBeNull();
    const corrected = applyGains(tinted, gains!);
    const spread = Math.max(corrected.r, corrected.g, corrected.b) - Math.min(corrected.r, corrected.g, corrected.b);
    const originalSpread = Math.max(tinted.r, tinted.g, tinted.b) - Math.min(tinted.r, tinted.g, tinted.b);
    expect(spread).toBeLessThan(originalSpread);
    expect(spread).toBeCloseTo(0, 1);
  });

  test('clamps output to [0, 255]', () => {
    const out = applyGains({ r: 250, g: 250, b: 250 }, { r: 1.6, g: 1.6, b: 1.6 });
    expect(out.r).toBeLessThanOrEqual(255);
    expect(out.g).toBeLessThanOrEqual(255);
    expect(out.b).toBeLessThanOrEqual(255);
  });
});
