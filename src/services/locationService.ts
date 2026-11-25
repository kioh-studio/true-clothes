// Device location detection for onboarding (feature: weather/season-aware feed).
// Wraps expo-location so screens stay thin. Foreground-only, requested on demand.
// Returns null on denied permission / no fix / geocode miss — the caller falls
// back to manual entry. Never throws (location is optional, must not block onboarding).

import * as Location from 'expo-location';

export interface DetectedLocation {
  label: string;          // "City, Country" for display + storage
  city: string | null;
  country: string | null;
  countryCode: string | null;  // ISO 3166-1 alpha-2 (locale-independent hemisphere)
  latitude: number;
  longitude: number;
}

// Request foreground permission, take one low-accuracy fix (fast; city-level is
// all we need), and reverse-geocode it to a "City, Country" label.
export async function detectCurrentLocation(): Promise<DetectedLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });

    const p = places?.[0];
    if (!p) return null;

    const city = p.city || p.subregion || p.region || null;
    const country = p.country || null;
    const countryCode = p.isoCountryCode ? p.isoCountryCode.toUpperCase() : null;
    const label = [city, country].filter(Boolean).join(', ');
    if (!label) return null;

    return { label, city, country, countryCode, latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

export interface CityResult {
  label: string;           // "City, Country"
  city: string;
  country: string | null;
  countryCode: string | null;
  latitude: number;
  longitude: number;
}

interface GeocodeResponse {
  results?: Array<{
    name?: string; country?: string; country_code?: string;
    latitude?: number; longitude?: number;
  }>;
}

/** Pure: Open-Meteo geocoding JSON -> CityResult[] (drops rows without name/coords). */
export function mapGeocodeResults(json: GeocodeResponse): CityResult[] {
  const out: CityResult[] = [];
  for (const r of json.results ?? []) {
    if (!r.name || typeof r.latitude !== 'number' || typeof r.longitude !== 'number') continue;
    const country = r.country ?? null;
    out.push({
      label: [r.name, country].filter(Boolean).join(', '),
      city: r.name,
      country,
      countryCode: r.country_code ? r.country_code.toUpperCase() : null,
      latitude: r.latitude,
      longitude: r.longitude,
    });
  }
  return out;
}

/** City search via Open-Meteo geocoding (same provider as weatherService). Never throws. */
export async function searchCities(query: string, lang: 'en' | 'vi'): Promise<CityResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=${lang}&format=json`,
    );
    if (!res.ok) return [];
    return mapGeocodeResults(await res.json());
  } catch {
    return [];
  }
}
