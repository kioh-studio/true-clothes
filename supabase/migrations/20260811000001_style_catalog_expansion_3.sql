-- Migration: 20260811000001_style_catalog_expansion_3
--
-- Feature: style catalog expansion batch 3 (2026-08-11 follow-up to
-- 20260810000004). 'mobwife' was stopped in batch 2 for a real vocabulary
-- gap — its defining material is fur, and the engine's FabricName union had
-- no fur/faux-fur entry (see plan.md "Style catalog expansion batch 2").
-- That gap is now closed: 'fur' was added to FabricName (supabase/functions/
-- generate-outfits/engine/types.ts) with FABRIC_DEFAULTS/MATERIAL_WARMTH/
-- FABRIC_NAME_MAP entries (engine/enrichment.ts). 'modest' remains stopped —
-- its gap (garment coverage/sleeve-hem-neckline) is a missing FitItem
-- attribute, not a fabric, and is out of this batch's scope.
--
-- Companion change: supabase/functions/generate-outfits/engine/filtering.ts
-- STYLE_CONFIGS (same id, same attributes/neighbors/popularity — verified
-- equal by supabase/functions/generate-outfits/engine/
-- style-catalog-consistency.test.ts, whose EXPECTED_STYLE_IDS now includes
-- 'mobwife'). No schema change — gender_lean column already exists from
-- 20260810000003.
--
-- Verified live row count first (Management API, `select count(*) from
-- public.styles`): 31 rows before this migration, matching the prior
-- migration's documented end state — no drift found for this table.
--
-- Applied to live via Management API — `supabase db push` refused (same
-- pre-existing LegacyDbPushMissingLocalError as prior migrations in this
-- repo). This file exists to keep migration history readable in-repo.
-- Idempotent: the INSERT uses ON CONFLICT (id) DO NOTHING; the neighbors
-- UPDATEs on the 3 existing rows touched by this batch's new bidirectional
-- edges are idempotent by construction (unconditional final value, not an
-- increment).

-- ─── Append bidirectional neighbors on the 3 existing rows touched by batch 3 ──
-- (styleAffinity/scoring for these rows is otherwise untouched — see
-- filtering.ts comment "Style catalog expansion batch 3 (2026-08-11)" at
-- each neighbors array.)

update public.styles set
  neighbors = '[{"id":"oldmoney","weight":0.5},{"id":"parisian","weight":0.6},{"id":"officechic","weight":0.5},{"id":"feminine","weight":0.5},{"id":"glam","weight":0.5},{"id":"businessformal","weight":0.3},{"id":"mobwife","weight":0.4}]'::jsonb
where id = 'elegant';

update public.styles set
  neighbors = '[{"id":"elegant","weight":0.5},{"id":"mobwife","weight":0.5}]'::jsonb
where id = 'glam';

update public.styles set
  neighbors = '[{"id":"grunge","weight":0.4},{"id":"whimsigoth","weight":0.6},{"id":"darkacademia","weight":0.2},{"id":"mobwife","weight":0.4}]'::jsonb
where id = 'gothic';

-- ─── 1 new style ────────────────────────────────────────────────────────────

insert into public.styles (id, name, description, image_url, popularity, attributes, neighbors, niches, active, gender_lean)
values
  ('mobwife', 'Mob Wife', 'Fur, leather, and gold-tone glamour — dark, rich, and unapologetically maximal, the highest texture richness in the catalog.', null, 0.280, '{"formality":3,"colorPalette":["dark","earth"],"silhouette":["oversized","bodycon"],"patternLevel":3.5,"textureRichness":5,"mood":["edgy","romantic"]}'::jsonb, '[{"id":"glam","weight":0.5},{"id":"gothic","weight":0.4},{"id":"elegant","weight":0.4}]'::jsonb, '["Fur & Leather","Gold-Chain Glam"]'::jsonb, true, 'feminine')
on conflict (id) do nothing;
