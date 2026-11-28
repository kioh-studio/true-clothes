-- 2026-11-29 AI photo consent (App Store 5.1.2(i) + PDPL): verifiable proof the user agreed
-- before photos are sent to Google Gemini. One row per user; withdraw = set withdrawn_at.
create table if not exists public.ai_photo_consents (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  version      text not null,
  granted_at   timestamptz not null default now(),
  withdrawn_at timestamptz
);

alter table public.ai_photo_consents enable row level security;

revoke all on public.ai_photo_consents from anon, authenticated;
grant select, insert, update on public.ai_photo_consents to authenticated;

create policy ai_photo_consents_select_own on public.ai_photo_consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy ai_photo_consents_insert_own on public.ai_photo_consents
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy ai_photo_consents_update_own on public.ai_photo_consents
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
