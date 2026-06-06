-- Migration: 20260606000002_clothing_items
-- Creates public.clothing_items table with RLS policies and indexes.

create table if not exists public.clothing_items (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  photo_url   text,                      -- Supabase Storage public/signed URL
  photo_path  text,                      -- Storage path: {userId}/{id}.jpg (for deletion)
  category    text        not null check (category in ('top', 'bottom', 'outerwear', 'footwear', 'accessory')),
  colors      text[]      not null default '{}',  -- named colour strings, never hex
  size_label  text,
  brand       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Indexes for primary lookup patterns
create index if not exists clothing_items_user_id_idx
  on public.clothing_items (user_id);

create index if not exists clothing_items_user_category_idx
  on public.clothing_items (user_id, category);

-- Row-level security
alter table public.clothing_items enable row level security;

create policy "clothing_items: select own"
  on public.clothing_items for select
  using (auth.uid() = user_id);

create policy "clothing_items: insert own"
  on public.clothing_items for insert
  with check (auth.uid() = user_id);

create policy "clothing_items: update own"
  on public.clothing_items for update
  using (auth.uid() = user_id);

create policy "clothing_items: delete own"
  on public.clothing_items for delete
  using (auth.uid() = user_id);

-- updated_at trigger
create trigger clothing_items_updated_at
  before update on public.clothing_items
  for each row execute procedure public.handle_updated_at();
