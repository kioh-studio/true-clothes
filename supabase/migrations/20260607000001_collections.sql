-- Migration: 20260607000001_collections
-- Collections group WARDROBE ITEMS (not outfits). An item may belong to many
-- collections and a collection may hold many items — modelled as a join table.
-- Collections are owned by a user and persisted server-side with RLS.
--
-- NOTE: references public.clothing_items(id), which exists under the live schema.
-- Ownership is anchored on auth.users(id) directly (one wardrobe per user), so this
-- migration is independent of the wardrobes/wardrobe_id indirection used elsewhere.

-- ─── public.collections ──────────────────────────────────────────────────────

create table if not exists public.collections (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  description text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists collections_user_id_idx
  on public.collections (user_id);

alter table public.collections enable row level security;

create policy "collections: select own"
  on public.collections for select
  using (auth.uid() = user_id);

create policy "collections: insert own"
  on public.collections for insert
  with check (auth.uid() = user_id);

create policy "collections: update own"
  on public.collections for update
  using (auth.uid() = user_id);

create policy "collections: delete own"
  on public.collections for delete
  using (auth.uid() = user_id);

create trigger collections_updated_at
  before update on public.collections
  for each row execute procedure public.handle_updated_at();

-- ─── public.collection_items (join — many-to-many) ───────────────────────────

create table if not exists public.collection_items (
  collection_id uuid        not null references public.collections(id)    on delete cascade,
  item_id       uuid        not null references public.clothing_items(id) on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (collection_id, item_id)   -- an item appears at most once per collection
);

create index if not exists collection_items_item_id_idx
  on public.collection_items (item_id);

alter table public.collection_items enable row level security;

-- Membership rows are visible/editable only when the parent collection is the user's.
create policy "collection_items: select own"
  on public.collection_items for select
  using (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.user_id = auth.uid()
  ));

create policy "collection_items: insert own"
  on public.collection_items for insert
  with check (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.user_id = auth.uid()
  ));

create policy "collection_items: delete own"
  on public.collection_items for delete
  using (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.user_id = auth.uid()
  ));
