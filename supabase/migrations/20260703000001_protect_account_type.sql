-- Migration: 20260703000001_protect_account_type
-- Security audit 2026-07-03 (backlog.md section F): profiles.account_type
-- tự-nâng-cấp được qua PostgREST. RLS "profiles: update own row" chỉ check
-- auth.uid() = id, không giới hạn cột — free user PATCH /profiles?id=eq.<self>
-- {"account_type":"premium"} pass được vì CHECK constraint cho phép giá trị đó,
-- bypass credit gate ở tryon-generate/index.ts gateCredit().
--
-- Column-level REVOKE UPDATE(account_type) KHÔNG đủ: profiles có GRANT UPDATE
-- ở tầng TABLE cho anon/authenticated (Supabase default), và trong Postgres
-- table-level ACL vẫn cho phép update mọi cột kể cả khi có column-level REVOKE
-- riêng (column ACL chỉ thu hẹp khi KHÔNG có table-level grant che phủ).
-- Verified live: information_schema.column_privileges vẫn liệt kê
-- anon/authenticated có UPDATE trên account_type sau khi revoke riêng cột đó.
--
-- Fix triệt để bằng trigger: chặn mọi thay đổi account_type trừ khi request
-- chạy bằng service_role (revenuecat-webhook, script admin dùng service key).
-- PostgREST chạy mỗi request dưới current_user = 'anon'/'authenticated' (JWT-based
-- role switch), còn service-role client chạy dưới current_user = 'service_role'.
-- Verified live (transaction rollback test): update từ role 'authenticated' bị
-- chặn với lỗi "account_type cannot be modified by this role".

revoke update (account_type) on public.profiles from authenticated, anon;

create or replace function public.protect_account_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_type is distinct from old.account_type and current_user <> 'service_role' then
    raise exception 'account_type cannot be modified by this role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_account_type on public.profiles;
create trigger profiles_protect_account_type
  before update on public.profiles
  for each row
  execute function public.protect_account_type();
