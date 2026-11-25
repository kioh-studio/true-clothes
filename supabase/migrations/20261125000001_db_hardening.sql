-- 2026-11-25 DB hardening (applied via MCP apply_migration; db push is not used — history drift).

-- a) Policies granted to role `public` -> `authenticated` (USING / WITH CHECK unchanged).
alter policy "Users own collection items" on public.collection_items to authenticated;
alter policy "Users own collections" on public.collections to authenticated;
alter policy "Users own outfit interactions" on public.outfit_interactions to authenticated;
alter policy "usage_credits: select own" on public.usage_credits to authenticated;
alter policy "Users delete own wardrobe photos" on storage.objects to authenticated;
alter policy "Users read own wardrobe photos" on storage.objects to authenticated;
alter policy "Users upload own wardrobe photos" on storage.objects to authenticated;
alter policy "Users delete own avatars" on storage.objects to authenticated;
alter policy "Users read own avatars" on storage.objects to authenticated;
alter policy "Users upload own avatars" on storage.objects to authenticated;

-- b) Trigger-only SECURITY DEFINER fn must not be an RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- c) Body only uses now() (pg_catalog) -> safe with empty search_path.
alter function public.set_updated_at() set search_path = '';

-- d) Client uploads with upsert:true (itemPhotoService, profileService) -> overwrite needs UPDATE.
create policy "Users update own wardrobe photos" on storage.objects
  for update to authenticated
  using ((bucket_id = 'wardrobe-photos'::text) and ((auth.uid())::text = (storage.foldername(name))[1]))
  with check ((bucket_id = 'wardrobe-photos'::text) and ((auth.uid())::text = (storage.foldername(name))[1]));
create policy "Users update own avatars" on storage.objects
  for update to authenticated
  using ((bucket_id = 'avatars'::text) and ((auth.uid())::text = (storage.foldername(name))[1]))
  with check ((bucket_id = 'avatars'::text) and ((auth.uid())::text = (storage.foldername(name))[1]));
