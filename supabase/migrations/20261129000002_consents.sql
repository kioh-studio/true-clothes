-- 2026-11-29 Generic consent model: definitions (public.consents), current state per user
-- (public.user_consents, upsert) and a trigger-written append-only audit log
-- (public.user_consent_history, provable history for PDPL). Replaces public.ai_photo_consents.
create table public.consents (
  id          text primary key,
  version     text not null,
  description text not null,
  created_at  timestamptz not null default now()
);
alter table public.consents enable row level security;
revoke all on public.consents from anon, authenticated;
grant select on public.consents to authenticated;
create policy consents_select_all on public.consents for select to authenticated using (true);

insert into public.consents (id, version, description)
values ('ai_photo', '2026-11-29', 'Send user photos to Google Gemini for try-on and clothing recognition');

create table public.user_consents (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  consent_id text not null references public.consents (id),
  version    text not null,
  is_consent boolean not null,  -- true = granted, false = withdrawn
  updated_at timestamptz not null default now(),
  primary key (user_id, consent_id)
);
alter table public.user_consents enable row level security;
revoke all on public.user_consents from anon, authenticated;
grant select, insert, update on public.user_consents to authenticated;
create policy user_consents_select_own on public.user_consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_consents_insert_own on public.user_consents
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_consents_update_own on public.user_consents
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.user_consent_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  consent_id text not null references public.consents (id),
  version    text not null,
  is_consent boolean not null,
  created_at timestamptz not null default now()
);
create index user_consent_history_user_consent_created_idx
  on public.user_consent_history (user_id, consent_id, created_at desc);
alter table public.user_consent_history enable row level security;
revoke all on public.user_consent_history from anon, authenticated;
grant select on public.user_consent_history to authenticated;
create policy user_consent_history_select_own on public.user_consent_history
  for select to authenticated using (user_id = (select auth.uid()));

-- Server-side updated_at (client clock is never trusted).
create function public.user_consents_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger user_consents_touch before insert or update on public.user_consents
  for each row execute function public.user_consents_touch();

-- Only writer of the history table (clients have no grant on it).
create function public.user_consents_log() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_consent_history (user_id, consent_id, version, is_consent)
  values (new.user_id, new.consent_id, new.version, new.is_consent);
  return null;
end $$;
revoke execute on function public.user_consents_log() from public, anon, authenticated;
revoke execute on function public.user_consents_touch() from public, anon, authenticated;
create trigger user_consents_log after insert or update on public.user_consents
  for each row execute function public.user_consents_log();

-- Carry over old rows into both tables (trigger logs the final state; add the grant event explicitly
-- when a withdrawal exists so history shows both), then drop the old table.
insert into public.user_consent_history (user_id, consent_id, version, is_consent, created_at)
select user_id, 'ai_photo', version, true, granted_at from public.ai_photo_consents
where withdrawn_at is not null;
insert into public.user_consents (user_id, consent_id, version, is_consent)
select user_id, 'ai_photo', version, withdrawn_at is null from public.ai_photo_consents;
drop table public.ai_photo_consents;
