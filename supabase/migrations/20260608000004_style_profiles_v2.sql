-- Migration: 20260608000004_style_profiles_v2
-- Adds active_formula_id to style_profiles.
-- FK to public.formulas is added after formulas table is created in 20260608000005.

alter table public.style_profiles
  add column if not exists active_formula_id uuid;
