-- Migration: 20260608000001_profiles_v2
-- Adds display_name, avatar, color_season, personal_palette to public.profiles.

alter table public.profiles
  add column if not exists display_name    text,
  add column if not exists avatar_url      text,
  add column if not exists avatar_path     text,
  add column if not exists color_season    text check (color_season in ('spring', 'summer', 'autumn', 'winter')),
  add column if not exists personal_palette text[] not null default '{}';

-- Drop old check constraint on skin_undertone if it exists (was nullable with no constraint)
-- skin_undertone is populated by personal color detection; no constraint needed.
