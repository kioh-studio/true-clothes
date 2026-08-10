-- Migration: 20260807000001_outfit_interactions_viewed_dismissed
--
-- Applied to live 2026-08-07 via Management API — file này chỉ để đồng bộ
-- lịch sử migration (schema drift đã biết). LƯU Ý migration gốc
-- 20260608000006 cũng thiếu 'impression' so với live.
--
-- Adds two new outfit_interactions.type values: 'viewed' (tap into outfit
-- detail from the feed — a weak positive signal) and 'dismissed' (swipe-left
-- on a feed card — an explicit negative signal). See docs/feed-signals-
-- instruction.md and engine/taste.ts for how the taste vector consumes them.
-- DO NOT RUN — the live constraint already matches this file.

alter table public.outfit_interactions drop constraint outfit_interactions_type_check;
alter table public.outfit_interactions add constraint outfit_interactions_type_check
  check (type = any (array['saved'::text,'worn'::text,'scheduled'::text,
                           'impression'::text,'viewed'::text,'dismissed'::text]));
