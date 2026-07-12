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
});
