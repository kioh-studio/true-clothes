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
    `&windspeed_unit=kmh`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new WeatherFetchError('Network error fetching weather', err);
  }

  if (!response.ok) {
    throw new WeatherFetchError(`Open-Meteo returned ${response.status}`);
  }

  let json: { current_weather?: { temperature: number; windspeed: number; weathercode: number } };
  try {
    json = await response.json();
  } catch (err) {
    throw new WeatherFetchError('Invalid JSON from Open-Meteo', err);
  }

  const cw = json.current_weather;
  if (!cw) throw new WeatherFetchError('Missing current_weather in Open-Meteo response');

  return {
    temperatureCelsius: cw.temperature,
    temperatureBand: getTemperatureBand(cw.temperature),
    weatherCode: cw.weathercode,
    windspeedKmh: cw.windspeed,
    fetchedAt: new Date().toISOString(),
    locationCity: locationCity ?? null,
  };
}
