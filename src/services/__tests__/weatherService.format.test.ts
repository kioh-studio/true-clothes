import { formatTemp, toUnit, parseTwoDayForecast } from '../weatherService';

describe('formatTemp', () => {
  it('metric rounds Celsius', () => {
    expect(formatTemp(21.4, 'metric')).toBe('21°C');
  });
  it('imperial converts to Fahrenheit', () => {
    expect(formatTemp(0, 'imperial')).toBe('32°F');
    expect(formatTemp(21, 'imperial')).toBe('70°F');
    expect(toUnit(-10, 'imperial')).toBe(14);
  });
});

describe('parseTwoDayForecast', () => {
  it('returns today and tomorrow', () => {
    expect(parseTwoDayForecast({
      daily: { apparent_temperature_max: [30, 22], precipitation_probability_max: [10, 80] },
    })).toEqual({
      today: { feelsLikeMaxC: 30, precipProbMax: 10 },
      tomorrow: { feelsLikeMaxC: 22, precipProbMax: 80 },
    });
  });
  it('returns null when tomorrow is missing', () => {
    expect(parseTwoDayForecast({ daily: { apparent_temperature_max: [30] } })).toBeNull();
  });
});
