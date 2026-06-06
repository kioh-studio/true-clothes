-- Migration: 20260606000003_storage_policies
-- Creates the wardrobe-photos storage bucket and RLS access policies.

-- ─── Bucket ────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wardrobe-photos',
  'wardrobe-photos',
  false,               -- private bucket; access via signed URLs
  10485760,            -- 10 MB per upload
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ─── Storage RLS Policies ──────────────────────────────────────────────────────
-- Path pattern: {userId}/{itemId}.jpg
-- The first folder segment is the userId; matched against auth.uid()::text.

create policy "wardrobe-photos: select own"
  on storage.objects for select
  using (
    bucket_id = 'wardrobe-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "wardrobe-photos: insert own"
  on storage.objects for insert
  with check (
    bucket_id = 'wardrobe-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "wardrobe-photos: delete own"
  on storage.objects for delete
  using (
    bucket_id = 'wardrobe-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
