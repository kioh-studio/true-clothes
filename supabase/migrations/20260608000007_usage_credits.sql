-- Migration: 20260608000007_usage_credits
-- Creates public.usage_credits for per-user monthly scan credit tracking.

create table if not exists public.usage_credits (
  id           uuid  primary key default gen_random_uuid(),
  user_id      uuid  not null references auth.users(id) on delete cascade,
  credit_type  text  not null check (credit_type in ('worn_outfit_scan')),
  used         int   not null default 0,
  free_limit   int   not null default 2,
  period_start date  not null,
  unique (user_id, credit_type, period_start)
);

alter table public.usage_credits enable row level security;

create policy "usage_credits: select own"
  on public.usage_credits for select using (auth.uid() = user_id);
create policy "usage_credits: insert own"
  on public.usage_credits for insert with check (auth.uid() = user_id);
create policy "usage_credits: update own"
  on public.usage_credits for update using (auth.uid() = user_id);
