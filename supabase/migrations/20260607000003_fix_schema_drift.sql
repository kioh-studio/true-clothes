-- Migration: Fix schema drift between migration files and live DB
-- Date: 2026-06-07
--
-- Context: The original migration 20260606000002_clothing_items.sql used
-- clothing_items.user_id directly. The live Supabase DB uses a wardrobes
-- table with clothing_items.wardrobe_id (many-to-one). This migration
-- reconciles the two by adding the live schema structures with IF NOT EXISTS
-- guards so it is safe and idempotent to run against any environment.

-- ─── 1. wardrobes table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wardrobes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wardrobes_user_id_unique UNIQUE (user_id)
);

ALTER TABLE public.wardrobes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'wardrobes' AND policyname = 'wardrobes_select_own'
  ) THEN
    CREATE POLICY wardrobes_select_own ON public.wardrobes
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'wardrobes' AND policyname = 'wardrobes_insert_own'
  ) THEN
    CREATE POLICY wardrobes_insert_own ON public.wardrobes
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─── 2. wardrobe_id column on clothing_items ─────────────────────────────────

ALTER TABLE public.clothing_items
  ADD COLUMN IF NOT EXISTS wardrobe_id uuid
    REFERENCES public.wardrobes(id) ON DELETE CASCADE;

-- ─── 3. NOTE: user_id column removal ─────────────────────────────────────────
--
-- The original migration created clothing_items with a user_id column.
-- The live DB may have data in that column. Do NOT drop it here — the
-- wardrobeService already reads via wardrobe_id; user_id can be removed in a
-- future maintenance migration once all rows have been backfilled and verified.
--
-- To backfill (run manually after confirming data integrity):
--
--   INSERT INTO public.wardrobes (user_id)
--     SELECT DISTINCT user_id FROM public.clothing_items
--     WHERE user_id IS NOT NULL
--     ON CONFLICT (user_id) DO NOTHING;
--
--   UPDATE public.clothing_items ci
--     SET wardrobe_id = w.id
--     FROM public.wardrobes w
--     WHERE ci.user_id = w.user_id
--       AND ci.wardrobe_id IS NULL;
--
--   -- After backfill and verification:
--   -- ALTER TABLE public.clothing_items DROP COLUMN IF EXISTS user_id;
