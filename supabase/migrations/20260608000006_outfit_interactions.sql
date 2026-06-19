-- Migration: 20260608000006_outfit_interactions
-- Creates public.outfit_interactions for server-side saved/worn/scheduled persistence.

create table if not exists public.outfit_interactions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  outfit_id      text        not null,
  outfit_data    jsonb       not null default '{}',
  type           text        not null check (type in ('saved', 'worn', 'scheduled')),
  interacted_at  timestamptz not null default now(),
  scheduled_for  date,
  worn_at        date,
  unique (user_id, outfit_id, type)
);

alter table public.outfit_interactions enable row level security;

create policy "outfit_interactions: select own"
  on public.outfit_interactions for select using (auth.uid() = user_id);
create policy "outfit_interactions: insert own"
  on public.outfit_interactions for insert with check (auth.uid() = user_id);
create policy "outfit_interactions: update own"
  on public.outfit_interactions for update using (auth.uid() = user_id);
create policy "outfit_interactions: delete own"
  on public.outfit_interactions for delete using (auth.uid() = user_id);

create index if not exists outfit_interactions_user_type_idx
  on public.outfit_interactions (user_id, type);

create index if not exists outfit_interactions_user_worn_at_idx
  on public.outfit_interactions (user_id, worn_at);
