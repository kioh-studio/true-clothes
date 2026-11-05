-- Per-item wear log. Parallel to outfit_interactions 'worn' (which the taste
-- engine reads and which stays untouched).
create table if not exists public.wear_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id    uuid not null references public.clothing_items(id) on delete cascade,
  worn_on    date not null,          -- client local date
  outfit_id  text,                   -- null = logged as a single item
  created_at timestamptz not null default now(),
  unique (user_id, item_id, worn_on)
);
create index if not exists wear_events_user_item_idx
  on public.wear_events (user_id, item_id, worn_on desc);

alter table public.wear_events enable row level security;
revoke all on public.wear_events from anon, authenticated;
grant select, insert, delete on public.wear_events to authenticated;

drop policy if exists wear_events_select_own on public.wear_events;
create policy wear_events_select_own on public.wear_events
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists wear_events_insert_own on public.wear_events;
create policy wear_events_insert_own on public.wear_events
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists wear_events_delete_own on public.wear_events;
create policy wear_events_delete_own on public.wear_events
  for delete to authenticated using (auth.uid() = user_id);
