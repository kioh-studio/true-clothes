-- Store the ISO 3166-1 alpha-2 country code (e.g. 'VN', 'BR', 'AU') alongside the
-- free-text location_country. Captured from GPS reverse-geocoding at onboarding.
-- Locale-independent, so the outfit engine derives hemisphere (→ current season)
-- exactly, instead of substring-matching a device-localised country name.
alter table public.profiles
  add column if not exists location_country_code text;
