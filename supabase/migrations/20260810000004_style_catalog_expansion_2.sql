-- Migration: 20260810000004_style_catalog_expansion_2
--
-- Feature: style catalog expansion batch 2 (2026-08-10 follow-up to
-- 20260810000003). 11 more styles were requested; 9 shipped here
-- ('mobwife', 'modest' were stopped — no vocabulary exists in the engine's
-- filtering model to express "fur fabric" or "skin-coverage" constraints,
-- see plan.md "Style catalog expansion batch 2" for the full reasoning).
-- Companion change: supabase/functions/generate-outfits/engine/filtering.ts
-- STYLE_CONFIGS (same 9 ids, same attributes/neighbors/popularity — verified
-- equal by supabase/functions/generate-outfits/engine/
-- style-catalog-consistency.test.ts, whose EXPECTED_STYLE_IDS now includes
-- these 9). No schema change — gender_lean column already exists from
-- 20260810000003.
--
-- Verified live row count first (Management API, `select count(*) ...
-- public.styles`): 22 rows before this migration, matching the prior
-- migration's documented end state — no drift found for this table.
--
-- Applied to live via Management API — `supabase db push` refused (same
-- pre-existing LegacyDbPushMissingLocalError as prior migrations in this
-- repo). This file exists to keep migration history readable in-repo.
-- Idempotent: the INSERTs use ON CONFLICT (id) DO NOTHING; the neighbors
-- UPDATEs on the 12 existing rows touched by this batch's new bidirectional
-- edges are idempotent by construction (unconditional final value, not an
-- increment).

-- ─── Append bidirectional neighbors on the 12 existing rows touched by batch 2 ──
-- (styleAffinity/scoring for these rows is otherwise untouched — see
-- filtering.ts comment "Style catalog expansion batch 2 (2026-08-10)" at
-- each neighbors array.)

update public.styles set
  neighbors = '[{"id":"minimalist","weight":0.8},{"id":"preppy","weight":0.8},{"id":"smartcasual","weight":0.6},{"id":"officechic","weight":0.5},{"id":"parisian","weight":0.5},{"id":"darkacademia","weight":0.6},{"id":"elegant","weight":0.5},{"id":"businessformal","weight":0.4}]'::jsonb
where id = 'oldmoney';

update public.styles set
  neighbors = '[{"id":"oldmoney","weight":0.8},{"id":"smartcasual","weight":0.7},{"id":"officechic","weight":0.4},{"id":"parisian","weight":0.6},{"id":"cleangirl","weight":0.8},{"id":"kfashion","weight":0.4},{"id":"normcore","weight":0.3}]'::jsonb
where id = 'minimalist';

update public.styles set
  neighbors = '[{"id":"athleisure","weight":0.7},{"id":"y2k","weight":0.6},{"id":"grunge","weight":0.5},{"id":"kfashion","weight":0.3},{"id":"artsy","weight":0.3},{"id":"utility","weight":0.4},{"id":"sporty","weight":0.3}]'::jsonb
where id = 'streetwear';

update public.styles set
  neighbors = '[{"id":"streetwear","weight":0.7},{"id":"y2k","weight":0.4},{"id":"athflow","weight":0.8},{"id":"sporty","weight":0.5}]'::jsonb
where id = 'athleisure';

update public.styles set
  neighbors = '[{"id":"y2k","weight":0.3},{"id":"athleisure","weight":0.2},{"id":"feminine","weight":0.4},{"id":"cottagecore","weight":0.6},{"id":"darkacademia","weight":0.3},{"id":"vintage","weight":0.4},{"id":"resort","weight":0.5},{"id":"retro70s","weight":0.3},{"id":"whimsigoth","weight":0.4}]'::jsonb
where id = 'bohemian';

update public.styles set
  neighbors = '[{"id":"smartcasual","weight":0.8},{"id":"oldmoney","weight":0.5},{"id":"minimalist","weight":0.4},{"id":"elegant","weight":0.5},{"id":"businessformal","weight":0.7}]'::jsonb
where id = 'officechic';

update public.styles set
  neighbors = '[{"id":"feminine","weight":0.8},{"id":"y2k","weight":0.3},{"id":"cottagecore","weight":0.4},{"id":"pinup","weight":0.3}]'::jsonb
where id = 'coquette';

update public.styles set
  neighbors = '[{"id":"oldmoney","weight":0.6},{"id":"preppy","weight":0.5},{"id":"bohemian","weight":0.3},{"id":"vintage","weight":0.5},{"id":"grunge","weight":0.3},{"id":"artsy","weight":0.2},{"id":"gothic","weight":0.2},{"id":"whimsigoth","weight":0.3}]'::jsonb
where id = 'darkacademia';

update public.styles set
  neighbors = '[{"id":"feminine","weight":0.5},{"id":"bohemian","weight":0.6},{"id":"coquette","weight":0.4},{"id":"utility","weight":0.3}]'::jsonb
where id = 'cottagecore';

update public.styles set
  neighbors = '[{"id":"streetwear","weight":0.5},{"id":"y2k","weight":0.3},{"id":"darkacademia","weight":0.3},{"id":"gothic","weight":0.4}]'::jsonb
where id = 'grunge';

update public.styles set
  neighbors = '[{"id":"oldmoney","weight":0.5},{"id":"parisian","weight":0.6},{"id":"officechic","weight":0.5},{"id":"feminine","weight":0.5},{"id":"glam","weight":0.5},{"id":"businessformal","weight":0.3}]'::jsonb
where id = 'elegant';

update public.styles set
  neighbors = '[{"id":"bohemian","weight":0.4},{"id":"darkacademia","weight":0.5},{"id":"retro70s","weight":0.6},{"id":"pinup","weight":0.5}]'::jsonb
where id = 'vintage';

-- ─── 9 new styles ───────────────────────────────────────────────────────────

insert into public.styles (id, name, description, image_url, popularity, attributes, neighbors, niches, active, gender_lean)
values
  ('glam', 'Glam', 'High-shine evening wear — sequin/satin-adjacent silk and velvet, and the highest formality range in the catalog.', null, 0.320, '{"formality":5,"colorPalette":["dark","bold"],"silhouette":["bodycon","tailored"],"patternLevel":1.5,"textureRichness":4.5,"mood":["romantic","edgy"]}'::jsonb, '[{"id":"elegant","weight":0.5}]'::jsonb, '["Red Carpet","Cocktail Hour"]'::jsonb, true, 'feminine'),
  ('businessformal', 'Business Formal', 'Structured suiting for the boardroom — sharper and more formal than everyday office wear.', null, 0.460, '{"formality":5,"colorPalette":["neutral","monochrome"],"silhouette":["tailored","structured"],"patternLevel":1,"textureRichness":1.5,"mood":["serious"]}'::jsonb, '[{"id":"officechic","weight":0.7},{"id":"oldmoney","weight":0.4},{"id":"elegant","weight":0.3}]'::jsonb, '["Power Suiting","Executive Polish"]'::jsonb, true, 'neutral'),
  ('gothic', 'Gothic', 'All-black romantic darkness — velvet and silk over denim, corsetry and structure over baggy layers.', null, 0.220, '{"formality":2.5,"colorPalette":["dark","monochrome"],"silhouette":["bodycon","structured"],"patternLevel":2,"textureRichness":4,"mood":["edgy","romantic"]}'::jsonb, '[{"id":"grunge","weight":0.4},{"id":"whimsigoth","weight":0.6},{"id":"darkacademia","weight":0.2}]'::jsonb, '["Romantic Goth","Traditional Goth"]'::jsonb, true, 'feminine'),
  ('utility', 'Utility', 'Functional cargo dressing — canvas, box pockets, and khaki/olive tones built for utility, not polish.', null, 0.520, '{"formality":2,"colorPalette":["earth","neutral"],"silhouette":["oversized","relaxed"],"patternLevel":1.5,"textureRichness":2,"mood":["clean","edgy"]}'::jsonb, '[{"id":"streetwear","weight":0.4},{"id":"cottagecore","weight":0.3},{"id":"normcore","weight":0.2}]'::jsonb, '["Cargo Core","Military-Inspired"]'::jsonb, true, 'neutral'),
  ('sporty', 'Sporty', 'Varsity-inspired athletic style — jerseys, letterman jackets, and collegiate color-blocking.', null, 0.400, '{"formality":2,"colorPalette":["bold","neutral"],"silhouette":["structured","relaxed"],"patternLevel":2,"textureRichness":2,"mood":["playful","clean"]}'::jsonb, '[{"id":"athleisure","weight":0.5},{"id":"streetwear","weight":0.3}]'::jsonb, '["Varsity","Tomboy"]'::jsonb, true, 'feminine'),
  ('normcore', 'Normcore', 'Deliberately unremarkable basics — plain, unisex, and quietly anti-fashion.', null, 0.260, '{"formality":1.5,"colorPalette":["neutral"],"silhouette":["relaxed","oversized"],"patternLevel":1,"textureRichness":1,"mood":["clean"]}'::jsonb, '[{"id":"minimalist","weight":0.3},{"id":"utility","weight":0.2}]'::jsonb, '["Deliberate Basics","Unisex Nothing-Special"]'::jsonb, true, 'neutral'),
  ('retro70s', 'Retro 70s', '1970s revival — flared cuts, geometric prints, and warm brown/orange/mustard tones.', null, 0.300, '{"formality":2,"colorPalette":["earth","bold"],"silhouette":["relaxed","oversized"],"patternLevel":4,"textureRichness":2.5,"mood":["playful","artistic"]}'::jsonb, '[{"id":"vintage","weight":0.6},{"id":"bohemian","weight":0.3}]'::jsonb, '["Flare & Bell-Bottom","Geometric Print"]'::jsonb, true, 'feminine'),
  ('pinup', 'Pinup', '1950s fit-and-flare femininity — polka dots, cherry red, and a cinched-waist silhouette.', null, 0.200, '{"formality":3,"colorPalette":["bold","neutral"],"silhouette":["bodycon","structured"],"patternLevel":3.5,"textureRichness":2.5,"mood":["playful","romantic"]}'::jsonb, '[{"id":"vintage","weight":0.5},{"id":"coquette","weight":0.3}]'::jsonb, '["Rockabilly","Swing Dress"]'::jsonb, true, 'feminine'),
  ('whimsigoth', 'Whimsigoth', 'Witchy, romantic darkness — velvet, mystical prints, and 70s-inflected silhouettes in jewel tones.', null, 0.230, '{"formality":2.5,"colorPalette":["dark","bold"],"silhouette":["relaxed","bodycon"],"patternLevel":3,"textureRichness":4,"mood":["romantic","edgy"]}'::jsonb, '[{"id":"bohemian","weight":0.4},{"id":"gothic","weight":0.6},{"id":"darkacademia","weight":0.3}]'::jsonb, '["Witchy Romantic","Dark Bohemian"]'::jsonb, true, 'feminine')
on conflict (id) do nothing;
