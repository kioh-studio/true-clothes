-- Migration: 20260810000002_style_profiles_shape_goal
--
-- Feature: "shape goal" (010-wardrobe-critic follow-up, 2026-08-10). Lets a
-- user set a durable "desired resulting body silhouette" — consumed by
-- generate-outfits/engine/silhouette.ts's resolveTargetSilhouette cascade
-- (new shapeGoal tier, between intent and style-silhouette) and ranking.ts's
-- shapeGoalDelta. Verified live schema first (Management API,
-- information_schema.columns on public.style_profiles) since this repo's
-- migration files are known to drift from the live DB (see 20260807000001's
-- and 20260810000001's headers) — live columns before this migration: id,
-- user_id, selected_styles, color_preferences, formula_preferences,
-- updated_at, active_formula_id, suggest_by_style, suggest_by_personal_color,
-- suggest_by_formula, suggest_by_measurements. No existing shape_goal column
-- found.
--
-- Nullable, default null. null = 'auto' (the engine treats a missing/null/
-- 'auto' value identically — see resolveTargetSilhouette's shapeGoal tier,
-- which is a total no-op in that case). Additive → byte-for-byte unchanged
-- behavior for every existing row/user until they explicitly set a goal.
--
-- Applied to live via Management API — `supabase db push` refused (known
-- pre-existing drift, same LegacyDbPushMissingLocalError as the two prior
-- migrations above; unrelated to this change). This file exists to keep
-- migration history readable in-repo, same convention as those two. Verified
-- post-apply: information_schema.columns shows shape_goal (text, nullable,
-- no default) plus the check constraint below.

alter table public.style_profiles
  add column if not exists shape_goal text;

alter table public.style_profiles
  drop constraint if exists style_profiles_shape_goal_check;

alter table public.style_profiles
  add constraint style_profiles_shape_goal_check
  check (shape_goal is null or shape_goal in (
    'auto', 'natural', 'hourglass', 'rectangle', 'oval', 'inverted-triangle', 'triangle'
  ));
