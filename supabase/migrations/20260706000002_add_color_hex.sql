-- Measured-hex color layer (feature 010-wardrobe-critic follow-up, 2026-07-06).
-- Deterministic pixel-derived dominant colour(s) of an item's isolated product
-- photo, extracted server-side (colorCluster.ts) — distinct from the AI's
-- text-guessed `color`/color_hex-in-prompt. Nullable: absent until an item's
-- image has been processed (new ingests + backfill-item-metadata).
-- Mirrors the migration already applied directly to the live DB by anh Khôi.
alter table public.clothing_items
  add column if not exists primary_hex text check (primary_hex ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists secondary_hex text check (secondary_hex ~ '^#[0-9A-Fa-f]{6}$');
