# Location & weather — Visual Spec (Profile → Location & weather)

Screen `app/location-weather.tsx` (thin; logic in
`src/features/location-weather/useLocationWeather.ts`). Visual structure copied
from `app/notifications.tsx`: 56px nav row with hairline, serif title, `Bounded`
content, 10px tertiary section labels, hairline rows with serif 17px titles,
`Switch` colors muted/primary/canvas. No gradients, no shadows.

Sections, top to bottom:

1. **Your location**: current label (or "Not set"), then a "Use current location"
   row (GPS). On permission denied an inline caption appears with an "Open
   settings" text link (`Linking.openSettings`).
2. **Or search a city**: borderless text field with a hairline underline; results
   are hairline rows ("City, Country"); tapping one sets the location. Debounced
   350 ms; empty state "No matching city".
3. **Right now**: weather preview line (temperature in the user's unit, band,
   feels-like, rain chance), then a Switch "Weather-aware suggestions" with a
   one-line explanation.
4. Footer caption: coordinates stay on this device.

Notes:
- Temperatures follow `appStore.unitPreference` (`formatTemp` in weatherService);
  the Home weather label uses the same formatter.
- Coordinates live only in `appStore.weatherLocation` (device storage); the
  profile (Supabase) keeps only the "City, Country" string and country code.
- Setting a location clears the cached weather and refetches. Weather also
  refreshes when the app returns to the foreground (30-minute TTL still applies).
