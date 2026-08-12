-- Opacity vocabulary gap fix (2026-08-14). The outfit engine gated a
-- cardigan's mid/outer layer roles ("born to be worn open") but not its base
-- role (sole torso garment) — CATEGORY_MAP granted that unconditionally, so
-- a see-through mesh cardigan could be selected as the ONLY thing on the
-- torso. The fix is type-agnostic: gate on opacity, not on garment type (a
-- sheer blouse or lace camisole is exactly as unwearable alone as a sheer
-- cardigan). See generate-item-image/prompt.ts's GarmentMetadata.opacity for
-- the full field definition and generate-outfits/engine/enrichment.ts's
-- deriveCanBeSoleTop for how it's consumed.
--
-- Nullable, defensive `if not exists` (migration files here are known to
-- drift from the live DB — verify schema before assuming). NULL = unassessed
-- (every existing row); the engine treats NULL the same as 'opaque' (fail-
-- open, unchanged behaviour) until backfill-item-metadata fills it.
alter table public.clothing_items
  add column if not exists opacity text check (opacity in ('sheer', 'semi', 'opaque'));

comment on column public.clothing_items.opacity is
  'How much skin/what''s underneath shows through the fabric: sheer (mesh/open-knit/lace/chiffon/organza/voile/fishnet) | semi (light show-through, e.g. thin white cotton) | opaque (covers fully, the default read). NULL = unassessed. Gates deriveCanBeSoleTop in the fit engine — a sheer garment may never be the sole torso layer, regardless of type.';
