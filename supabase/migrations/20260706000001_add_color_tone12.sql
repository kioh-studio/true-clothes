-- 12-tone personal-colour classifier: adds the optional column that stores
-- the finer-grained tone alongside the existing 4-season `color_season`.
-- Already applied to the live DB directly; this file exists for repo history.
alter table public.profiles
  add column if not exists color_tone12 text check (color_tone12 in (
    'light_spring','true_spring','bright_spring',
    'light_summer','true_summer','soft_summer',
    'soft_autumn','true_autumn','deep_autumn',
    'bright_winter','true_winter','deep_winter'
  ));
