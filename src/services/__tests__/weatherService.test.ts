import { parseOpenMeteo, weatherExtras } from '../weatherService';

const current = { temperature: 24, windspeed: 5, weathercode: 1 };
const now = new Date('2026-11-05T00:00:00Z');

describe('parseOpenMeteo', () => {
  it('uses daily feels-like max for the band when present', () => {
    const ctx = parseOpenMeteo({
      current_weather: current,
      daily: {
        apparent_temperature_max: [34.2],
        apparent_temperature_min: [25],
        precipitation_probability_max: [60],
      },
    }, 'Hanoi', now);
    expect(ctx.temperatureCelsius).toBe(24);
    expect(ctx.temperatureBand).toBe('hot'); // 34 feels-like, not 24 (warm)
    expect(ctx.feelsLikeMaxC).toBe(34.2);
    expect(ctx.feelsLikeMinC).toBe(25);
    expect(ctx.precipProbMax).toBe(60);
    expect(ctx.locationCity).toBe('Hanoi');
  });

  it('falls back to current temperature without daily', () => {
    const ctx = parseOpenMeteo({ current_weather: current }, null, now);
    expect(ctx.temperatureBand).toBe('warm');
    expect(ctx.feelsLikeMaxC).toBeUndefined();
    expect('precipProbMax' in ctx).toBe(false);
  });

  it('throws without current_weather', () => {
    expect(() => parseOpenMeteo({})).toThrow();
  });
});

describe('weatherExtras', () => {
  const base = { ...parseOpenMeteo({ current_weather: current }, null, now) };
  it('shows nothing for small diff / low rain', () => {
    expect(weatherExtras({ ...base, feelsLikeMaxC: 25, precipProbMax: 40 })).toEqual({});
  });
  it('shows feels-like at >=2 deg and rain at >=50%', () => {
    expect(weatherExtras({ ...base, feelsLikeMaxC: 34, precipProbMax: 50 }))
      .toEqual({ feelsLike: 34, rainPct: 50 });
  });
});
