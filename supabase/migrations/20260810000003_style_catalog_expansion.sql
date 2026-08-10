-- Migration: 20260810000003_style_catalog_expansion
--
-- Feature: style catalog expansion (2026-08-10 follow-up). The 8-style
-- catalog skewed masculine/unisex; this adds 14 styles (12 feminine-leaning,
-- 2 neutral) and a gender_lean column so the client can surface a gender-
-- matched subset first without hiding the rest. Companion change:
-- supabase/functions/generate-outfits/engine/filtering.ts STYLE_CONFIGS
-- (same 14 ids, same attributes/neighbors/popularity — verified equal by
-- supabase/functions/generate-outfits/engine/style-catalog-consistency.test.ts,
-- which encodes this migration's id set as its expected-ids constant).
--
-- Verified live schema first (Management API, information_schema.columns on
-- public.styles) since this repo's migration files are known to drift from
-- the live DB (see 20260807000001/20260810000001/20260810000002's headers).
-- Live columns before this migration: id, name, description, image_url,
-- popularity, attributes, neighbors, niches, active, created_at, updated_at.
-- No existing gender_lean column found. Single PK (id), one RLS SELECT
-- policy ("styles: read", public, USING true) — no RLS insert/update policy,
-- consistent with this table being applied through the Management API
-- (bypasses RLS) rather than through client writes.
--
-- Applied to live via Management API — `supabase db push` refused (known
-- pre-existing drift, same LegacyDbPushMissingLocalError as the prior three
-- migrations). This file exists to keep migration history readable in-repo.
-- Idempotent: the ADD COLUMN/constraint drop+recreate can rerun safely; the
-- INSERTs use ON CONFLICT (id) DO NOTHING; the neighbors/gender_lean UPDATEs
-- on the original 8 rows are idempotent by construction (they set an
-- unconditional final value, not an increment).

-- ─── gender_lean column ─────────────────────────────────────────────────────

alter table public.styles
  add column if not exists gender_lean text not null default 'neutral';

alter table public.styles
  drop constraint if exists styles_gender_lean_check;

alter table public.styles
  add constraint styles_gender_lean_check
  check (gender_lean in ('feminine', 'masculine', 'neutral'));

-- ─── Backfill gender_lean + append bidirectional neighbors on the original 8 ──
-- (styleAffinity/scoring for these 8 is otherwise untouched — see filtering.ts
-- comment "Style catalog expansion (2026-08-10)" at each neighbors array.)

update public.styles set
  gender_lean = 'masculine',
  neighbors = '[{"id":"minimalist","weight":0.8},{"id":"preppy","weight":0.8},{"id":"smartcasual","weight":0.6},{"id":"officechic","weight":0.5},{"id":"parisian","weight":0.5},{"id":"darkacademia","weight":0.6},{"id":"elegant","weight":0.5}]'::jsonb
where id = 'oldmoney';

update public.styles set
  gender_lean = 'neutral',
  neighbors = '[{"id":"oldmoney","weight":0.8},{"id":"smartcasual","weight":0.7},{"id":"officechic","weight":0.4},{"id":"parisian","weight":0.6},{"id":"cleangirl","weight":0.8},{"id":"kfashion","weight":0.4}]'::jsonb
where id = 'minimalist';

update public.styles set
  gender_lean = 'masculine',
  neighbors = '[{"id":"athleisure","weight":0.7},{"id":"y2k","weight":0.6},{"id":"grunge","weight":0.5},{"id":"kfashion","weight":0.3},{"id":"artsy","weight":0.3}]'::jsonb
where id = 'streetwear';

update public.styles set
  gender_lean = 'masculine',
  neighbors = '[{"id":"oldmoney","weight":0.6},{"id":"minimalist","weight":0.7},{"id":"preppy","weight":0.8},{"id":"officechic","weight":0.8},{"id":"parisian","weight":0.5},{"id":"cleangirl","weight":0.5},{"id":"resort","weight":0.3}]'::jsonb
where id = 'smartcasual';

update public.styles set
  gender_lean = 'masculine',
  neighbors = '[{"id":"oldmoney","weight":0.8},{"id":"smartcasual","weight":0.8},{"id":"darkacademia","weight":0.5}]'::jsonb
where id = 'preppy';

update public.styles set
  gender_lean = 'neutral',
  neighbors = '[{"id":"streetwear","weight":0.7},{"id":"y2k","weight":0.4},{"id":"athflow","weight":0.8}]'::jsonb
where id = 'athleisure';

update public.styles set
  gender_lean = 'feminine',
  neighbors = '[{"id":"streetwear","weight":0.6},{"id":"athleisure","weight":0.4},{"id":"coquette","weight":0.3},{"id":"grunge","weight":0.3},{"id":"artsy","weight":0.3}]'::jsonb
where id = 'y2k';

update public.styles set
  gender_lean = 'feminine',
  neighbors = '[{"id":"y2k","weight":0.3},{"id":"athleisure","weight":0.2},{"id":"feminine","weight":0.4},{"id":"cottagecore","weight":0.6},{"id":"darkacademia","weight":0.3},{"id":"vintage","weight":0.4},{"id":"resort","weight":0.5}]'::jsonb
where id = 'bohemian';

-- ─── 14 new styles ──────────────────────────────────────────────────────────

insert into public.styles (id, name, description, image_url, popularity, attributes, neighbors, niches, active, gender_lean)
values
  ('feminine', 'Feminine', 'Romantic, soft, and deliberately pretty — pastels, delicate fabrics, and gently fitted shapes.', null, 0.620, '{"formality":3,"colorPalette":["pastel","neutral"],"silhouette":["relaxed","bodycon"],"patternLevel":3,"textureRichness":3.5,"mood":["romantic","playful"]}'::jsonb, '[{"id":"coquette","weight":0.8},{"id":"cottagecore","weight":0.5},{"id":"bohemian","weight":0.4},{"id":"elegant","weight":0.5}]'::jsonb, '["Romantic Florals","Ruffles & Lace","Soft Power"]'::jsonb, true, 'feminine'),
  ('officechic', 'Office Chic', 'Polished, tailored workwear — sharp shirting and structured pieces built for the boardroom.', null, 0.700, '{"formality":4,"colorPalette":["neutral","monochrome"],"silhouette":["tailored","structured"],"patternLevel":1.5,"textureRichness":2,"mood":["serious","clean"]}'::jsonb, '[{"id":"smartcasual","weight":0.8},{"id":"oldmoney","weight":0.5},{"id":"minimalist","weight":0.4},{"id":"elegant","weight":0.5}]'::jsonb, '["Business Casual","Boardroom Tailoring","Weekend-to-Work"]'::jsonb, true, 'feminine'),
  ('parisian', 'Parisian Chic', 'Effortless, understated French style — stripes, trench coats, and quality basics worn simply.', null, 0.450, '{"formality":3.5,"colorPalette":["neutral","monochrome"],"silhouette":["tailored","relaxed"],"patternLevel":2,"textureRichness":2,"mood":["clean","serious"]}'::jsonb, '[{"id":"minimalist","weight":0.6},{"id":"oldmoney","weight":0.5},{"id":"elegant","weight":0.6},{"id":"smartcasual","weight":0.5},{"id":"cleangirl","weight":0.5}]'::jsonb, '["Breton Stripes","Effortless Tailoring","Left Bank Minimal"]'::jsonb, true, 'feminine'),
  ('coquette', 'Coquette', 'Bows, lace, and ballet-inspired softness — hyper-feminine and deliberately delicate.', null, 0.400, '{"formality":2,"colorPalette":["pastel"],"silhouette":["bodycon","relaxed"],"patternLevel":3.5,"textureRichness":4,"mood":["romantic","playful"]}'::jsonb, '[{"id":"feminine","weight":0.8},{"id":"y2k","weight":0.3},{"id":"cottagecore","weight":0.4}]'::jsonb, '["Balletcore","Bow Details","Vintage Lingerie-Inspired"]'::jsonb, true, 'feminine'),
  ('cleangirl', 'Clean Girl', 'Polished minimal basics, tonal color, no clutter — effortless-looking but exact.', null, 0.580, '{"formality":2.5,"colorPalette":["neutral","monochrome"],"silhouette":["tailored","relaxed"],"patternLevel":1,"textureRichness":1.5,"mood":["clean"]}'::jsonb, '[{"id":"minimalist","weight":0.8},{"id":"smartcasual","weight":0.5},{"id":"parisian","weight":0.5},{"id":"athflow","weight":0.4},{"id":"kfashion","weight":0.4}]'::jsonb, '["Ton-sur-ton","Slicked & Simple","Everyday Essentials"]'::jsonb, true, 'feminine'),
  ('darkacademia', 'Dark Academia', 'Tweed, cardigans, and worn-in library aesthetics — moody, literary, and heritage-leaning.', null, 0.420, '{"formality":3.5,"colorPalette":["earth","dark"],"silhouette":["structured","relaxed"],"patternLevel":2,"textureRichness":4,"mood":["serious","artistic"]}'::jsonb, '[{"id":"oldmoney","weight":0.6},{"id":"preppy","weight":0.5},{"id":"bohemian","weight":0.3},{"id":"vintage","weight":0.5},{"id":"grunge","weight":0.3},{"id":"artsy","weight":0.2}]'::jsonb, '["Ivy Scholar","Gothic Academia","Vintage Professor"]'::jsonb, true, 'feminine'),
  ('cottagecore', 'Cottagecore', 'Maxi dresses, florals, and natural fibers — a soft, pastoral, hand-made feeling.', null, 0.350, '{"formality":1.5,"colorPalette":["earth","pastel"],"silhouette":["relaxed","oversized"],"patternLevel":3.5,"textureRichness":3.5,"mood":["romantic","artistic"]}'::jsonb, '[{"id":"feminine","weight":0.5},{"id":"bohemian","weight":0.6},{"id":"coquette","weight":0.4}]'::jsonb, '["Prairie Dress","Farm-to-Closet","Meadow Florals"]'::jsonb, true, 'feminine'),
  ('grunge', 'Grunge', 'Denim, leather, and worn-in dark layers — raw, unpolished, and a little rebellious.', null, 0.380, '{"formality":1.5,"colorPalette":["dark","bold"],"silhouette":["oversized","relaxed"],"patternLevel":3,"textureRichness":3,"mood":["edgy"]}'::jsonb, '[{"id":"streetwear","weight":0.5},{"id":"y2k","weight":0.3},{"id":"darkacademia","weight":0.3}]'::jsonb, '["90s Grunge","Distressed Denim","Band Tee Culture"]'::jsonb, true, 'feminine'),
  ('athflow', 'Athflow', 'Soft, studio-to-street activewear — a gentler, more fluid take on athleisure.', null, 0.500, '{"formality":1.5,"colorPalette":["neutral","pastel"],"silhouette":["relaxed","oversized"],"patternLevel":1,"textureRichness":1.5,"mood":["clean","playful"]}'::jsonb, '[{"id":"athleisure","weight":0.8},{"id":"cleangirl","weight":0.4}]'::jsonb, '["Studio-to-Street","Soft Performance","Yoga-Inspired"]'::jsonb, true, 'feminine'),
  ('elegant', 'Elegant', 'Classic, refined eveningwear-adjacent style — rich fabrics and clean, considered lines.', null, 0.480, '{"formality":4.5,"colorPalette":["dark","monochrome"],"silhouette":["tailored","bodycon"],"patternLevel":1,"textureRichness":3,"mood":["serious","romantic"]}'::jsonb, '[{"id":"oldmoney","weight":0.5},{"id":"parisian","weight":0.6},{"id":"officechic","weight":0.5},{"id":"feminine","weight":0.5}]'::jsonb, '["Evening Tailoring","Old Hollywood","Modern Classic"]'::jsonb, true, 'feminine'),
  ('kfashion', 'K-Fashion', 'Soft oversized layering in muted, light tones — Korean street style staples.', null, 0.650, '{"formality":2.5,"colorPalette":["neutral","pastel"],"silhouette":["oversized","relaxed"],"patternLevel":1.5,"textureRichness":2,"mood":["clean","playful"]}'::jsonb, '[{"id":"minimalist","weight":0.4},{"id":"streetwear","weight":0.3},{"id":"cleangirl","weight":0.4}]'::jsonb, '["Seoul Street","Soft Layering","Muted Oversized"]'::jsonb, true, 'feminine'),
  ('vintage', 'Vintage', 'Retro silhouettes and worn-in warmth — thrifted textures in earthy, sun-faded tones.', null, 0.400, '{"formality":2.5,"colorPalette":["earth","bold"],"silhouette":["relaxed","structured"],"patternLevel":3,"textureRichness":3,"mood":["artistic","romantic"]}'::jsonb, '[{"id":"bohemian","weight":0.4},{"id":"darkacademia","weight":0.5}]'::jsonb, '["70s Revival","Thrifted Classics","Retro Denim"]'::jsonb, true, 'feminine'),
  ('resort', 'Resort', 'Linen, light color, and easy shapes built for warm-weather travel and vacation days.', null, 0.420, '{"formality":1.5,"colorPalette":["pastel","earth"],"silhouette":["relaxed","oversized"],"patternLevel":3,"textureRichness":2.5,"mood":["playful"]}'::jsonb, '[{"id":"bohemian","weight":0.5},{"id":"smartcasual","weight":0.3}]'::jsonb, '["Vacation Linen","Poolside Ease","Coastal Getaway"]'::jsonb, true, 'neutral'),
  ('artsy', 'Artsy', 'Avant-garde and experimental — unusual proportions, layering, and color that reads as gallery-ready.', null, 0.300, '{"formality":2.5,"colorPalette":["bold","monochrome"],"silhouette":["oversized","structured"],"patternLevel":4,"textureRichness":4,"mood":["artistic","edgy"]}'::jsonb, '[{"id":"streetwear","weight":0.3},{"id":"y2k","weight":0.3},{"id":"darkacademia","weight":0.2}]'::jsonb, '["Deconstructed","Gallery Opening","Color-Block Statement"]'::jsonb, true, 'neutral')
on conflict (id) do nothing;
