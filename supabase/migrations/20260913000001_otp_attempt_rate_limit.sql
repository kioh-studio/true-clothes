-- Per-identifier (phone/email) OTP attempt rate limit.
--
-- Why: Supabase Auth's own /auth/v1/verify rate limit is per-IP only (30
-- requests / 5 min, burst up to 30, customizable in the dashboard), and the
-- IP we forward via Sb-Forwarded-For is
-- spoofable (confirmed 2026-09-13, see backlog.md) — an attacker rotating a
-- fake x-forwarded-for value can brute-force a 6-digit OTP, or the static,
-- never-expiring DEMO_WHITELIST OTPs, with no per-user lockout. This adds a
-- second, IP-independent limit keyed by the identifier itself.
--
-- Modeled on public.rate_limits / consume_rate_limit
-- (20260625000002_usage_credit_consume_rate_limit.sql) but keyed by a text
-- hash instead of auth.uid() — send-otp/verify-otp callers are unauthenticated,
-- there is no auth.uid() yet.
create table if not exists public.otp_attempts (
  key          text primary key,          -- sha256 hex of "<bucket>:<normalized identifier>", never raw phone/email
  window_start timestamptz not null,
  count        integer not null default 0
);

alter table public.otp_attempts enable row level security;
-- Intentionally no RLS policies: unreachable except via consume_otp_attempt().

-- ponytail: rows are never pruned (one row per identifier ever attempted,
-- forever). Fine at expected volume; add a pg_cron job deleting rows with
-- window_start older than a day if this table grows large.
create or replace function public.consume_otp_attempt(
  p_key         text,
  p_max         integer,
  p_window_secs integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now   timestamptz := now();
  v_count integer;
begin
  insert into public.otp_attempts (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set window_start = case
          when public.otp_attempts.window_start < v_now - make_interval(secs => p_window_secs)
          then v_now else public.otp_attempts.window_start end,
        count = case
          when public.otp_attempts.window_start < v_now - make_interval(secs => p_window_secs)
          then 1 else public.otp_attempts.count + 1 end
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

revoke all on function public.consume_otp_attempt(text, integer, integer) from public;
revoke execute on function public.consume_otp_attempt(text, integer, integer) from anon, authenticated;
grant execute on function public.consume_otp_attempt(text, integer, integer) to service_role;
