-- garment_types: backfill 7 more picker types (schema drift, not new vocabulary)
-- 2026-08-13. Follow-up to 20260812000002_garment_type_flats.sql, which closed the
-- FLATS gap and logged the wider drift in backlog.md: `clothing_items.type` FKs to
-- `garment_types(type_key)`, but the app's picker (src/features/wardrobe-add/vocab.ts
-- TYPE_OPTIONS) and the engine's CATEGORY_MAP (enrichment.ts) both carry 55 types
-- while the live table only had 54 (now 61), with 9 picker types missing from the DB.
-- This migration closes 7 of those 9: CROP, BODYSUIT, TUNIC, CORSET, CAPE, KIMONO,
-- WEDGES. GLOVES and TIGHTS are deliberately NOT included — unlike these 7, the
-- engine carries no metadata for them at all (no TYPE_FORMALITY, no STYLE_AFFINITIES,
-- no LAYER_ROLE_BY_TYPE entry; CATEGORY_MAP is the only map that names them), so
-- there is nothing to mirror. They need a real product decision and stay open in
-- backlog.md.
--
-- Values copied verbatim from enrichment.ts, not invented:
--   category            CATEGORY_MAP            line ~14-25
--   base_formality       TYPE_FORMALITY map       line ~536-548
--   style_affinities     STYLE_AFFINITIES map     line ~345-385
-- All style tags used (y2k, streetwear, athleisure, minimalist, bohemian,
-- smartcasual, oldmoney, preppy) are valid `styles.id` values on live and already
-- appear in other garment_types rows.
--
-- default_material and layer_roles are not tracked in the engine tables; they follow
-- sibling rows already in garment_types, exactly like the FLATS migration did:
--   CROP/BODYSUIT/TUNIC/CORSET -> layer_roles {base}, default_material 'cotton'
--     (same as base cotton tops TEE/TANK/HENLEY/POLO); LAYER_ROLE_BY_TYPE in
--     enrichment.ts (~line 282-290) puts all 4 at 'base'.
--   CAPE -> layer_roles {outer} (LAYER_ROLE_BY_TYPE puts CAPE at 'outer'),
--     default_material 'wool' (wool shells BLAZER/COAT/OVERCOAT).
--   KIMONO -> LAYER_ROLE_BY_TYPE puts KIMONO at 'mid', but written here as
--     {mid,outer} not {mid} because every other mid-capable outwear row already on
--     live (HOODIE, JACKET, WINDBREAKER, GILET) uses {mid,outer} — the engine's
--     dual-role rule lets a mid item occupy the outwear slot alone when there is no
--     true outer. default_material 'silk' (exists in fabric_types; matches a kimono's
--     real-world fabric better than the wool shells).
--   WEDGES -> no LAYER_ROLE_BY_TYPE entry, falls back to the shoes category default
--     'base'; default_material 'leather' (leather shoes BOOTS/FLATS/HEELS/LOAFERS/…).
--
-- Idempotent — safe to re-run.

insert into public.garment_types
  (type_key, category, base_formality, style_affinities, default_material, layer_roles)
values
  ('CROP',     'top',     1.5, array['y2k','streetwear','athleisure'],     'cotton',  array['base']),
  ('BODYSUIT', 'top',     2.5, array['minimalist','y2k','athleisure'],     'cotton',  array['base']),
  ('TUNIC',    'top',     2.5, array['bohemian','minimalist','smartcasual'],'cotton', array['base']),
  ('CORSET',   'top',     3.0, array['y2k','bohemian','smartcasual'],      'cotton',  array['base']),
  ('CAPE',     'outwear', 3.5, array['bohemian','oldmoney','minimalist'],  'wool',    array['outer']),
  ('KIMONO',   'outwear', 3.0, array['bohemian','minimalist','oldmoney'],  'silk',    array['mid','outer']),
  ('WEDGES',   'shoes',   3.0, array['bohemian','smartcasual','preppy'],   'leather', array['base'])
on conflict (type_key) do nothing;
