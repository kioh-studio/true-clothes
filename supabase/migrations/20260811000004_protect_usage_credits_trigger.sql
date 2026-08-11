-- Fix: usage_credits.credits_used/credits_limit were directly writable by
-- their own owner via PostgREST (RLS policy "Users own usage credits" is
-- cmd=ALL, qual=auth.uid()=user_id, no WITH CHECK, and — unlike
-- profiles.account_type — no protective trigger existed). Any authenticated
-- user could PATCH their own row and reset credits_used to 0, bypassing the
-- monthly quota before the edge function's gate ever ran.
--
-- Design note (chosen over mirroring protect_account_type() verbatim): a
-- naive port of protect_account_type()'s `current_user <> 'service_role'`
-- check was live-tested against consume_usage_credit() and BLOCKS it —
-- consume_usage_credit/refund_usage_credit are SECURITY DEFINER, owned by
-- `postgres`, so current_user inside them is 'postgres' during their own
-- UPDATE, never 'service_role'. A role-name check would either permanently
-- break the legitimate RPC path or require trusting the entire `postgres`
-- role (which would silently extend to any future SECURITY DEFINER function
-- owned by postgres — a widening, decaying trust surface).
--
-- Instead: a transaction-local GUC flag (`app.credit_write_allowed`) that
-- ONLY consume_usage_credit() and refund_usage_credit() ever set, right
-- before their own UPDATE. The trigger allows a credits_used/credits_limit
-- change only while that flag is 'on'. This grants the capability to exactly
-- those two named functions — not to a role, which anything could someday
-- run as.
create or replace function public.protect_credits()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if (new.credits_used is distinct from old.credits_used
      or new.credits_limit is distinct from old.credits_limit)
     and coalesce(current_setting('app.credit_write_allowed', true), 'off') <> 'on' then
    raise exception 'credits_used/credits_limit cannot be modified outside consume_usage_credit()/refund_usage_credit()';
  end if;
  return new;
end;
$$;

drop trigger if exists usage_credits_protect_credits on public.usage_credits;
create trigger usage_credits_protect_credits
before update on public.usage_credits
for each row execute function public.protect_credits();

-- Re-create both RPCs to set the flag (transaction-local — `true` as the
-- third set_config() arg — so it can never leak past the current call) right
-- before the UPDATE the trigger needs to allow.
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

  perform set_config('app.credit_write_allowed', 'on', true);

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

  perform set_config('app.credit_write_allowed', 'on', true);

  update public.usage_credits
     set credits_used = greatest(0, credits_used - 1),
         updated_at   = now()
   where user_id = v_uid and credit_type = p_type and period_start = p_period;
end;
$$;
