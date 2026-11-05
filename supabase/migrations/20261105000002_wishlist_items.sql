-- Wishlist: scanned items under consideration (no AI cost to save -> no cap).
create table if not exists public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  metadata    jsonb not null,               -- GarmentMetadata of the scanned item
  photo_path  text,                         -- wardrobe-photos bucket: {user_id}/wishlist/{id}.png
  price       numeric(12,2) check (price is null or price >= 0),
  source_url  text,
  verdict     jsonb,                        -- last Verdict
  verdict_at  timestamptz,
  wardrobe_fp text,                         -- wardrobe fingerprint at verdict time
  status      text not null default 'considering'
              check (status in ('considering','bought','skipped')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists wishlist_items_user_status_idx
  on public.wishlist_items (user_id, status, created_at desc);

alter table public.wishlist_items enable row level security;
revoke all on public.wishlist_items from anon, authenticated;
grant select, insert, update, delete on public.wishlist_items to authenticated;

drop policy if exists wishlist_select_own on public.wishlist_items;
create policy wishlist_select_own on public.wishlist_items
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists wishlist_insert_own on public.wishlist_items;
create policy wishlist_insert_own on public.wishlist_items
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists wishlist_update_own on public.wishlist_items;
create policy wishlist_update_own on public.wishlist_items
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists wishlist_delete_own on public.wishlist_items;
create policy wishlist_delete_own on public.wishlist_items
  for delete to authenticated using (auth.uid() = user_id);

-- Photos reuse the private wardrobe-photos bucket (policy keys on first
-- folder = auth.uid()); objects live at {user_id}/wishlist/{id}.png.
