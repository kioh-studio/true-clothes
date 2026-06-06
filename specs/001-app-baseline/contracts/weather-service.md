# Contract: weatherService

**File**: `src/services/weatherService.ts`
**Date**: 2026-06-06

This service fetches current weather conditions from Open-Meteo and returns a typed
`WeatherContext` object. It is the only module that makes HTTP requests to
`api.open-meteo.com`.

Screens and stores MUST NOT call Open-Meteo directly. The feed hook reads
`WeatherContext` from `appStore`, which calls this service.

---

## Interface

```typescript
// src/services/weatherService.ts

export interface Coordinates {
  latitude: number
  longitude: number
}

/**
 * Fetch current weather for the given coordinates.
 *
 * Calls Open-Meteo /v1/forecast with current_weather=true.
 * Returns a WeatherContext suitable for outfit temperature-range filtering.
 *
 * Throws WeatherFetchError on network failure or unexpected API response.
 */
export async function fetchCurrentWeather(
  coords: Coordinates
): Promise<WeatherContext>

/**
 * Determine the temperature band label for a given temperature.
 * Used to match OutfitSuggestion.weatherContext temperature ranges.
 *
 * Bands:
 *   < 10°C  → "cold"
 *   10–19°C → "mild"
 *   20–28°C → "warm"
 *   > 28°C  → "hot"
 */
export function getTemperatureBand(
  celsius: number
): 'cold' | 'mild' | 'warm' | 'hot'
```

---

## WeatherContext Type

```typescript
// src/types/weather.ts

export interface WeatherContext {
  temperatureCelsius: number
  temperatureBand: 'cold' | 'mild' | 'warm' | 'hot'
  weatherCode: number         // WMO weather interpretation code
  windspeedKmh: number
  fetchedAt: string           // ISO 8601 — used for 30-minute TTL check
  locationCity: string | null // From authStore.profile.location.city (display only)
}
```

---

## API Details

**Base URL**: `https://api.open-meteo.com/v1/forecast`

**Request**:
```
GET /v1/forecast
  ?latitude={lat}
  &longitude={lon}
  &current_weather=true
  &temperature_unit=celsius
  &windspeed_unit=kmh
```

**Response shape** (relevant fields):
```json
{
  "current_weather": {
    "temperature": 27.3,
    "windspeed": 12.5,
    "weathercode": 1
  }
}
```

**No API key required.** No authentication headers needed.

---

## Behaviour Contracts

### `fetchCurrentWeather(coords)`

- MUST return a `WeatherContext` with all fields populated.
- MUST derive `temperatureBand` using `getTemperatureBand()`.
- MUST set `fetchedAt` to the current ISO timestamp at time of successful fetch.
- MUST throw `WeatherFetchError` on any network error or non-200 HTTP response.
- MUST NOT cache internally — caching is handled by `appStore` with 30-minute TTL.

### `getTemperatureBand(celsius)`

- Pure function. MUST NOT call any API or store.
- MUST be deterministic: same input always returns same output.
- Bands:
  - `celsius < 10` → `"cold"`
  - `10 <= celsius < 20` → `"mild"`
  - `20 <= celsius <= 28` → `"warm"`
  - `celsius > 28` → `"hot"`

---

## Caching Strategy (in `appStore`)

`weatherService` is stateless. `appStore` owns the cache:

```typescript
// In appStore state:
weatherContext: WeatherContext | null
weatherLastFetched: string | null  // ISO timestamp

// In appStore action:
async refreshWeather(): Promise<void> {
  const now = Date.now()
  const lastFetched = state.weatherLastFetched
    ? new Date(state.weatherLastFetched).getTime()
    : 0
  const TTL_MS = 30 * 60 * 1000  // 30 minutes

  if (now - lastFetched < TTL_MS && state.weatherContext) return  // cache hit

  const coords = authStore.getState().profile?.location?.coords
  if (!coords) return  // no location available — skip silently

  const ctx = await weatherService.fetchCurrentWeather(coords)
  set({ weatherContext: ctx, weatherLastFetched: ctx.fetchedAt })
}
```

---

## Error Type

```typescript
export class WeatherFetchError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'WeatherFetchError'
  }
}
```

`WeatherFetchError` caught by `appStore.refreshWeather()`. On failure, the existing
`weatherContext` (if any) is retained. The feed continues to show using the last
known temperature band. No error is surfaced to the user (weather is enhancement, not
blocker).

---

## WMO Weather Code Reference (informational)

| Code range | Condition | Feed label |
|------------|-----------|------------|
| 0 | Clear sky | ☀️ |
| 1–3 | Partly cloudy | ⛅ |
| 45, 48 | Fog | 🌫️ |
| 51–67 | Rain/drizzle | 🌧️ |
| 71–77 | Snow | ❄️ |
| 80–82 | Rain showers | 🌦️ |
| 95–99 | Thunderstorm | ⛈️ |

Weather code is available for future UI enhancement (weather icon on feed card) but
is not used in outfit filtering logic — only `temperatureBand` is used for filtering.
