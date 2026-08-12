-- garment_types: add missing FLATS row (schema drift, not new vocabulary)
-- 2026-08-12. `clothing_items.type` FKs to `garment_types(type_key)`. FLATS
-- (ballet flats) is already fully wired everywhere else — the app's
-- TYPE_OPTIONS picker (src/features/wardrobe-add/vocab.ts) and the fit
-- engine (supabase/functions/generate-outfits/engine/enrichment.ts) both
-- carry it — but the garment_types table never got the corresponding row,
-- so inserting a FLATS clothing_item fails the FK. This closes that drift.
--
-- Values copied verbatim from enrichment.ts, not invented:
--   category            'shoes'        line ~21  (GARMENT_CATEGORY)
--   base_formality       3.0           line ~584 (BASE_FORMALITY)
--   style_affinities     minimalist/oldmoney/preppy/smartcasual  line ~373 (STYLE_AFFINITY)
-- default_material and layer_roles are not tracked in the engine tables;
-- they follow the sibling shoes rows already in garment_types (HEELS,
-- LOAFERS, MULES all use default_material 'leather' and layer_roles
-- {base}), which keeps the fabric_types FK satisfied ('leather' exists).
--
-- Other missing types (BODYSUIT, CAPE, CORSET, CROP, GLOVES, KIMONO,
-- TIGHTS, TUNIC, WEDGES) are deliberately out of scope here — logged in
-- backlog.md.
--
-- Idempotent — safe to re-run.

insert into public.garment_types
  (type_key, category, base_formality, style_affinities, default_material, layer_roles)
values
  ('FLATS', 'shoes', 3.0, array['minimalist','oldmoney','preppy','smartcasual'], 'leather', array['base'])
on conflict (type_key) do nothing;
