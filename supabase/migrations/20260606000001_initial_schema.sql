-- Migration: 20260606000001_initial_schema
-- Creates public.profiles, public.body_measurements, public.style_profiles
-- with RLS policies, FK constraints, and updated_at triggers.

-- ─── Extensions ────────────────────────────────────────────────────────────────

create extension if not exists moddatetime schema extensions;

-- ─── updated_at trigger function ──────────────────────────────────────────────

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── public.profiles ──────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id                  uuid        primary key references auth.users(id) on delete cascade,
  phone               text,
  email               text,
  gender              text        check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  dob                 date,
  location_city       text,
  location_country    text,
  skin_undertone      text,
  onboarding_complete boolean     not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: select own"  on public.profiles for select using (auth.uid() = id);
create policy "profiles: insert own"  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: update own"  on public.profiles for update using (auth.uid() = id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- Auto-create profile row when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── public.body_measurements ─────────────────────────────────────────────────

create table if not exists public.body_measurements (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null unique references auth.users(id) on delete cascade,
  body_height   numeric,    -- centimetres
  body_weight   numeric,    -- kilograms
  chest         numeric,    -- centimetres
  waist         numeric,    -- centimetres
  hip           numeric,    -- centimetres
  preferred_fit text        check (preferred_fit in ('slim', 'regular', 'relaxed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.body_measurements enable row level security;

create policy "body_measurements: select own"  on public.body_measurements for select  using (auth.uid() = user_id);
create policy "body_measurements: insert own"  on public.body_measurements for insert  with check (auth.uid() = user_id);
create policy "body_measurements: update own"  on public.body_measurements for update  using (auth.uid() = user_id);
create policy "body_measurements: delete own"  on public.body_measurements for delete  using (auth.uid() = user_id);

create trigger body_measurements_updated_at
  before update on public.body_measurements
  for each row execute procedure public.handle_updated_at();

-- ─── public.style_profiles ────────────────────────────────────────────────────

create table if not exists public.style_profiles (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null unique references auth.users(id) on delete cascade,
  selected_styles      text[]      not null default '{}',
  color_preferences    text[]      not null default '{}',
  formula_preferences  text[]      not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.style_profiles enable row level security;

create policy "style_profiles: select own"  on public.style_profiles for select  using (auth.uid() = user_id);
create policy "style_profiles: insert own"  on public.style_profiles for insert  with check (auth.uid() = user_id);
create policy "style_profiles: update own"  on public.style_profiles for update  using (auth.uid() = user_id);
create policy "style_profiles: delete own"  on public.style_profiles for delete  using (auth.uid() = user_id);

create trigger style_profiles_updated_at
  before update on public.style_profiles
  for each row execute procedure public.handle_updated_at();
