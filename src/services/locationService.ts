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

    return { label, city, country, countryCode };
  } catch {
    return null;
  }
}
