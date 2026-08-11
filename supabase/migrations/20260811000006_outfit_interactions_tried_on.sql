-- Migration: 20260811000006_outfit_interactions_tried_on
--
-- Applied to live 2026-08-11 via Management API — file này chỉ để đồng bộ
-- lịch sử migration (schema drift đã biết, cùng kiểu với
-- 20260807000001_outfit_interactions_viewed_dismissed.sql). DO NOT RUN — the
-- live constraint already matches this file.
--
-- Adds one new outfit_interactions.type value: 'tried_on' (an AI "wear on
-- you" render succeeded, Flow B only — app/try-on/wear.tsx /
-- useWearOnYou.ts). It is logged after a successful generation, when the
-- outfit has a real, owned wardrobe item id to key it by (Flow A's "Scan" of
-- a not-yet-owned garment never logs this — its items have no
-- clothing_items.id). See engine/taste.ts TRIED_ON_WEIGHT for how the taste
-- vector consumes it (weight 1.5, between SAVED_WEIGHT and WORN_WEIGHT).

alter table public.outfit_interactions drop constraint outfit_interactions_type_check;
alter table public.outfit_interactions add constraint outfit_interactions_type_check
  check (type = any (array['saved'::text,'worn'::text,'scheduled'::text,
                           'impression'::text,'viewed'::text,'dismissed'::text,
                           'tried_on'::text]));
