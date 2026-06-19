-- Migration: 20260614000001_clothing_items_photo_storage
-- Feature 003-upload-image: tiered photo storage (free=on-device, premium=cloud).
--
-- Adds a discriminator that tells consumers how to interpret photo_url:
--   'none'  -> no photo (photo_url null)
--   'local' -> photo_url is a RELATIVE device path: wardrobe-photos/{itemId}.jpg
--   'cloud' -> photo_url is a Storage path: {userId}/{itemId}.jpg (private bucket)
--
-- The wardrobe-photos bucket is already private with per-user RLS
-- (see 20260606000003_storage_policies.sql) — no storage change needed here.

alter table public.clothing_items
  add column if not exists photo_storage text not null default 'none'
    check (photo_storage in ('none', 'local', 'cloud'));

-- Backfill: existing rows with a photo were uploaded to the cloud bucket
-- before tiering existed, so they are 'cloud'.
update public.clothing_items
  set photo_storage = 'cloud'
  where photo_url is not null
    and photo_storage = 'none';
