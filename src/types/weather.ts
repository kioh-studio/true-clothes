// Weather context — used by appStore and feed temperature filtering.

export interface WeatherContext {
  temperatureCelsius: number
  temperatureBand: 'cold' | 'mild' | 'warm' | 'hot'
  weatherCode: number        // WMO weather interpretation code
  windspeedKmh: number
  fetchedAt: string          // ISO 8601 — used for 30-minute TTL check
  locationCity: string | null
  // Today's daily forecast (Open-Meteo `daily`). Optional so persisted older
  // contexts still load.
  feelsLikeMaxC?: number
  feelsLikeMinC?: number
  precipProbMax?: number     // 0–100
}
