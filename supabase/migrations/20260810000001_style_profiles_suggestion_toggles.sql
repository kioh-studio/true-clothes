-- Migration: 20260810000001_style_profiles_suggestion_toggles
--
-- Feature: "4 suggestion toggles" (2026-08-10). Lets a user independently
-- turn off one of four outfit-suggestion dimensions — style, personal color,
-- formula preference, body measurements — without disabling outfit
-- generation itself. Verified live schema first (Management API,
-- information_schema.columns on public.style_profiles) since this repo's
-- migration files are known to drift from the live DB (see
-- 20260807000001's header) — live columns before this migration: id,
-- user_id, selected_styles, color_preferences, formula_preferences,
-- updated_at, active_formula_id. No existing suggest_by_* columns found.
--
-- Additive, default true on all four → byte-for-byte unchanged behavior for
-- every existing row/user until they explicitly opt out.
--
-- Applied to live 2026-08-10 via Management API — `supabase db push` refused
-- (LegacyDbPushMissingLocalError: known pre-existing drift, remote migration
-- history has entries with no local file; unrelated to this change). This
-- file exists to keep migration history readable in-repo, same convention as
-- 20260807000001. Verified post-apply: information_schema.columns shows all
-- four suggest_by_* columns, boolean, not null, default true.

alter table public.style_profiles
  add column if not exists suggest_by_style           boolean not null default true,
  add column if not exists suggest_by_personal_color   boolean not null default true,
  add column if not exists suggest_by_formula          boolean not null default true,
  add column if not exists suggest_by_measurements     boolean not null default true;
