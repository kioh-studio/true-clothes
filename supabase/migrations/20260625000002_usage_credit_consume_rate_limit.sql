-- Server-authoritative usage credits + generic per-user rate limiting.
--
-- Why: the client-side incrementCredit() was non-atomic and never actually
-- incremented past 1 (upsert overwrote credits_used to 1 and never errored, so
-- the RPC fallback — which also did not exist — never ran). Free-tier limits
-- were therefore unenforceable and the expensive Gemini edge functions could be
-- driven without bound from a single free account. The authority for consuming a
-- credit now lives in the database (atomic) and is called from the edge
-- functions, so a scripted client cannot bypass it.

-- ── Atomic monthly credit consume ────────────────────────────────────────────
-- Uses auth.uid() (never a caller-supplied id) so a user can only ever consume
-- their OWN credits. SECURITY DEFINER so it can write past the table's RLS.
-- Returns: { allowed: bool, used: int, limit: int }.
create or replace function public.consume_usage_credit(
  p_type   text,
  p_period date,
  p_limit  integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_used integer;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'used', 0, 'limit', p_limit, 'error', 'unauthenticated');
  end if;

  -- Ensure the current period row exists (starts at 0).
  insert into public.usage_credits (user_id, credit_type, period_start, credits_used, credits_limit)
  values (v_uid, p_type, p_period, 0, p_limit)
  on conflict (user_id, credit_type, period_start) do nothing;

  -- Atomically increment ONLY while under the limit. The WHERE guard makes the
  -- check-and-increment a single statement (no read-then-write race).
  update public.usage_credits
     set credits_used  = credits_used + 1,
         credits_limit = p_limit,
         updated_at    = now()
   where user_id     = v_uid
     and credit_type = p_type
     and period_start = p_period
     and credits_used < p_limit
  returning credits_used into v_used;

  if v_used is null then
    -- Either no row (impossible after the insert) or already at/over the limit.
    select credits_used into v_used
      from public.usage_credits
     where user_id = v_uid and credit_type = p_type and period_start = p_period;
    return jsonb_build_object('allowed', false, 'used', coalesce(v_used, p_limit), 'limit', p_limit);
  end if;

  return jsonb_build_object('allowed', true, 'used', v_used, 'limit', p_limit);
end;
$$;

revoke all on function public.consume_usage_credit(text, date, integer) from public;
grant execute on function public.consume_usage_credit(text, date, integer) to authenticated;

-- ── Generic per-user sliding-window rate limit ───────────────────────────────
-- For cheap-but-abusable AI text endpoints (describe-outfit, map-measurements)
-- that have no credit model. Generous limits: stops scripts, never trips normal
-- interactive use. Only the SECURITY DEFINER function below may touch the table.
create table if not exists public.rate_limits (
  user_id      uuid not null references auth.users(id) on delete cascade,
  bucket       text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (user_id, bucket)
);

alter table public.rate_limits enable row level security;
-- Intentionally no RLS policies: unreachable except via consume_rate_limit().

-- Returns true if the call is allowed (under the limit for the current window),
-- false if the per-window budget is exhausted. auth.uid()-scoped.
create or replace function public.consume_rate_limit(
  p_bucket      text,
  p_max         integer,
  p_window_secs integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_now   timestamptz := now();
  v_count integer;
begin
  if v_uid is null then return false; end if;

  insert into public.rate_limits (user_id, bucket, window_start, count)
  values (v_uid, p_bucket, v_now, 1)
  on conflict (user_id, bucket) do update
    set window_start = case
          when public.rate_limits.window_start < v_now - make_interval(secs => p_window_secs)
          then v_now else public.rate_limits.window_start end,
        count = case
          when public.rate_limits.window_start < v_now - make_interval(secs => p_window_secs)
          then 1 else public.rate_limits.count + 1 end
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

-- ── Compensating refund ──────────────────────────────────────────────────────
-- A credit is consumed atomically BEFORE the (slow, fallible) Gemini call so the
-- monthly cap cannot be bypassed by concurrency. When the generation then fails
-- or yields nothing, the edge function refunds the credit so a free user is only
-- ever charged for a result they actually received. auth.uid()-scoped, floored
-- at 0 (a stray refund can never grant free credits).
create or replace function public.refund_usage_credit(
  p_type   text,
  p_period date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  update public.usage_credits
     set credits_used = greatest(0, credits_used - 1),
         updated_at   = now()
   where user_id = v_uid and credit_type = p_type and period_start = p_period;
end;
$$;

revoke all on function public.refund_usage_credit(text, date) from public;
grant execute on function public.refund_usage_credit(text, date) to authenticated;
