// weatherService — fetches current weather from Open-Meteo (no API key required).
// Stateless: caching is owned by appStore (30-minute TTL).

import { WeatherContext } from '../types/weather';

// ─── Error Type ───────────────────────────────────────────────────────────────

export class WeatherFetchError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'WeatherFetchError';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// ─── Pure function — temperature band ────────────────────────────────────────

/**
 * Determine temperature band for outfit filtering.
 *   < 10°C  → "cold"
 *   10–19°C → "mild"
 *   20–28°C → "warm"
 *   > 28°C  → "hot"
 */
export function getTemperatureBand(celsius: number): WeatherContext['temperatureBand'] {
  if (celsius < 10) return 'cold';
  if (celsius < 20) return 'mild';
  if (celsius <= 28) return 'warm';
  return 'hot';
}

// ─── API fetch ────────────────────────────────────────────────────────────────

/**
 * Fetch current weather for the given coordinates from Open-Meteo.
 * Throws WeatherFetchError on network failure or non-200 response.
 */
export async function fetchCurrentWeather(
  coords: Coordinates,
  locationCity?: string | null,
): Promise<WeatherContext> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${coords.latitude}` +
    `&longitude=${coords.longitude}` +
    `&current_weather=true` +
    `&temperature_unit=celsius` +
    `&windspeed_unit=kmh` +
    `&daily=apparent_temperature_max,apparent_temperature_min,precipitation_probability_max` +
    `&timezone=auto&forecast_days=1`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new WeatherFetchError('Network error fetching weather', err);
  }

  if (!response.ok) {
    throw new WeatherFetchError(`Open-Meteo returned ${response.status}`);
  }

  let json: OpenMeteoResponse;
  try {
    json = await response.json();
  } catch (err) {
    throw new WeatherFetchError('Invalid JSON from Open-Meteo', err);
  }

  return parseOpenMeteo(json, locationCity);
}

// ─── Pure parser ──────────────────────────────────────────────────────────────

export interface OpenMeteoResponse {
  current_weather?: { temperature: number; windspeed: number; weathercode: number };
  daily?: {
    apparent_temperature_max?: (number | null)[];
    apparent_temperature_min?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
  };
}

const num = (v: number | null | undefined): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/** Pure: Open-Meteo JSON -> WeatherContext. Throws WeatherFetchError without current_weather. */
export function parseOpenMeteo(
  json: OpenMeteoResponse,
  locationCity?: string | null,
  now: Date = new Date(),
): WeatherContext {
  const cw = json.current_weather;
  if (!cw) throw new WeatherFetchError('Missing current_weather in Open-Meteo response');

  const feelsLikeMaxC = num(json.daily?.apparent_temperature_max?.[0]);
  const feelsLikeMinC = num(json.daily?.apparent_temperature_min?.[0]);
  const precipProbMax = num(json.daily?.precipitation_probability_max?.[0]);

  return {
    temperatureCelsius: cw.temperature,
    // ponytail: uses today's daytime max; evening users get today's band, add hourly if needed
    temperatureBand: getTemperatureBand(feelsLikeMaxC ?? cw.temperature),
    weatherCode: cw.weathercode,
    windspeedKmh: cw.windspeed,
    fetchedAt: now.toISOString(),
    locationCity: locationCity ?? null,
    ...(feelsLikeMaxC !== undefined ? { feelsLikeMaxC } : {}),
    ...(feelsLikeMinC !== undefined ? { feelsLikeMinC } : {}),
    ...(precipProbMax !== undefined ? { precipProbMax } : {}),
  };
}

/** Pure: extra Home chips — feels-like when >=2 deg off current, rain when >=50%. */
export function weatherExtras(ctx: WeatherContext): { feelsLike?: number; rainPct?: number } {
  const out: { feelsLike?: number; rainPct?: number } = {};
  if (ctx.feelsLikeMaxC !== undefined &&
      Math.abs(ctx.feelsLikeMaxC - ctx.temperatureCelsius) >= 2) {
    out.feelsLike = Math.round(ctx.feelsLikeMaxC);
  }
  if (ctx.precipProbMax !== undefined && ctx.precipProbMax >= 50) {
    out.rainPct = Math.round(ctx.precipProbMax);
  }
  return out;
}

/** Pure: Celsius -> rounded number in the preferred unit. */
export function toUnit(celsius: number, unit: 'metric' | 'imperial'): number {
  return Math.round(unit === 'imperial' ? celsius * 9 / 5 + 32 : celsius);
}

/** Pure: Celsius -> display string honouring the unit preference ("21°C" / "70°F"). */
export function formatTemp(celsius: number, unit: 'metric' | 'imperial'): string {
  return `${toUnit(celsius, unit)}°${unit === 'imperial' ? 'F' : 'C'}`;
}

// ─── Tomorrow forecast (for the weather reminder) ────────────────────────────

export interface DailyForecast {
  feelsLikeMaxC: number;
  precipProbMax: number;
}

export interface TwoDayForecast { today: DailyForecast; tomorrow: DailyForecast }

/** Pure: Open-Meteo daily arrays (2 days) -> today/tomorrow, or null if incomplete. */
export function parseTwoDayForecast(json: OpenMeteoResponse): TwoDayForecast | null {
  const d = json.daily;
  const t0 = num(d?.apparent_temperature_max?.[0]);
  const t1 = num(d?.apparent_temperature_max?.[1]);
  if (t0 === undefined || t1 === undefined) return null;
  return {
    today: { feelsLikeMaxC: t0, precipProbMax: num(d?.precipitation_probability_max?.[0]) ?? 0 },
    tomorrow: { feelsLikeMaxC: t1, precipProbMax: num(d?.precipitation_probability_max?.[1]) ?? 0 },
  };
}

/** Fetch today + tomorrow daily forecast. Returns null on any failure (non-blocking). */
export async function fetchTomorrowForecast(coords: Coordinates): Promise<TwoDayForecast | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${coords.latitude}&longitude=${coords.longitude}` +
      `&daily=apparent_temperature_max,precipitation_probability_max` +
      `&timezone=auto&forecast_days=2`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return parseTwoDayForecast(await res.json());
  } catch {
    return null;
  }
}
