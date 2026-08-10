// Scoring tests — no analyzePhoto/hook imports (native deps live there).
import { scorePersonalColor } from '../colorSeasonData';

describe('scorePersonalColor', () => {
  test('skin-only warm answer resolves to a warm season (spring or autumn)', () => {
    const result = scorePersonalColor({ skinUndertone: 'warm' });
    expect(['spring', 'autumn']).toContain(result.season);
  });

  test('skin + hair: warm + dark_brown_warm resolves to autumn', () => {
    const result = scorePersonalColor({ skinUndertone: 'warm', hairKey: 'dark_brown_warm' });
    expect(result.season).toBe('autumn');
    expect(result.tone12).toBe('true_autumn');
  });

  test('full answers (warm + auburn_red + brown_hazel_warm + gold) resolve to autumn, matching prior full-quiz behaviour', () => {
    const result = scorePersonalColor({
      skinUndertone: 'warm',
      hairKey: 'auburn_red',
      eyeKey: 'brown_hazel_warm',
      metalKey: 'gold',
    });
    expect(result.season).toBe('autumn');
  });

  test('palette always matches the winning season', () => {
    const result = scorePersonalColor({ skinUndertone: 'cool' });
    expect(result.palette.length).toBeGreaterThan(0);
    expect(['summer', 'winter']).toContain(result.season);
  });

  // UX-simplify (2026-08-06): the result screens' new AxisMeters component
  // reads `result.axes` directly — assert it actually flows through from
  // computeAxes into the scored result object, not just that computeAxes
  // itself works (that's covered separately in tone12.test.ts).
  test('axes flow through to the result object', () => {
    const result = scorePersonalColor({ skinUndertone: 'warm', hairKey: 'dark_brown_warm' });
    expect(result.axes).toBeDefined();
    expect(typeof result.axes.warmth).toBe('number');
    expect(typeof result.axes.value).toBe('number');
    expect(typeof result.axes.chroma).toBe('number');
    expect(result.axes.warmth).toBeGreaterThanOrEqual(-1);
    expect(result.axes.warmth).toBeLessThanOrEqual(1);
  });
});
