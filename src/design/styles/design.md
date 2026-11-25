# Style catalog — labels & images

## Labels (i18n)
- Style names/descriptions live in `en.json`/`vi.json` as `style_<id>_name` / `style_<id>_desc` (all 31 shipped styles; `modest` intentionally not shipped).
- Render through `src/features/styles/styleLabel.ts`: `styleName` / `styleDesc` (id + fallback text) and `styleLabelFromAny` for strings that may be an id, an upper-cased id or a display name (`outfit.style` is the id upper-cased; build.tsx stores the English display name; server `styleTag` is a name). Unknown values pass through. Missing key -> DB/static text.
- Display-only: stored/sent values are unchanged. Vietnamese keeps the English name where the community does (Old Money, Clean Girl, Coquette, Dark Academia, K-Fashion...).
- Descriptions are now sentences for all styles (the 8 original ones used to show tag strings like `REFINED · CLASSIC` on the tile).

## Images
- 14 newer styles (feminine, officechic, parisian, coquette, cleangirl, darkacademia, cottagecore, grunge, athflow, elegant, kfashion, vintage, resort, artsy) use Unsplash photos (Unsplash License), cropped 4:5, 800x1000 JPEG q75, hosted in the PUBLIC Supabase bucket `style-images/<id>.jpg`; `public.styles.image_url` points at them (migration `20261126000001_style_images_bucket.sql`).
- Client: onboarding uses `imageUrl ?? static img`; `styles-edit` now prefers the DB `imageUrl` too. The catalog is cached 24h (`styles-cache`), so existing installs pick up new images after expiry.
- Still image-less (tile = colour + label): glam, businessformal, gothic, utility, sporty, normcore, retro70s, pinup, whimsigoth, mobwife.
