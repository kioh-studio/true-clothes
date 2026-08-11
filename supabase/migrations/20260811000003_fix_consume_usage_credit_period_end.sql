-- Fix: consume_usage_credit() never populated usage_credits.period_end.
--
-- Live-DB investigation (2026-08-11, security-audit follow-up) found the
-- deployed usage_credits table has a NOT NULL `period_end date` column with
-- no default (added by some out-of-band change — no migration file in this
-- repo introduces it; confirmed schema drift, matches [[project_schema_drift]]).
-- consume_usage_credit()'s INSERT (from 20260625000002_usage_credit_consume_rate_limit.sql)
-- only ever set (user_id, credit_type, period_start, credits_used, credits_limit),
-- so EVERY call's insert throws 23502 "null value in column period_end". The
-- calling edge functions' gateCredit() catches the RPC error and fails OPEN
-- (unmetered) by design for transient failures — but since this failure was
-- permanent, every account tier (free/premium/demo) has been unmetered for
-- both credit_type in production, not just the demo bypass this audit set out
-- to close. Live-verified before this fix (see session notes): a bare RPC
-- call reliably threw 23502; after this fix, the same call inserts a row with
-- a populated period_end, increments credits_used, and rejects once the limit
-- is hit — verified end-to-end against the live DB in temporary rows (deleted
-- after verification, not committed to this migration).
--
-- period_end is derived from p_period (the caller-supplied period_start,
-- always the 1st of a month per usageCreditService.ts's monthPeriod() /
-- monthPeriod() duplicated in the edge functions) as the LAST day of that
-- same calendar month — date_trunc('month', ...) makes this robust even if a
-- caller ever passes a p_period that isn't already truncated to the 1st.
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
  v_period_end date := (date_trunc('month', p_period) + interval '1 month' - interval '1 day')::date;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'used', 0, 'limit', p_limit, 'error', 'unauthenticated');
  end if;

  -- Ensure the current period row exists (starts at 0).
  insert into public.usage_credits (user_id, credit_type, period_start, period_end, credits_used, credits_limit)
  values (v_uid, p_type, p_period, v_period_end, 0, p_limit)
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
