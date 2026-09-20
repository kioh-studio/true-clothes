-- Close three server-side holes that let a signed-in user bypass AI credit /
-- rate limits, found in the 2026-09-20 pre-submission review.

-- ── 1. usage_credits: drop the client UPDATE policy ─────────────────────────
-- protect_credits() (20260811000004) only guards credits_used/credits_limit.
-- The "usage_credits: update own" policy (20260811000005) still lets a client
-- UPDATE any other column of their own row directly via PostgREST, including
-- period_start — moving the row to a period with no history gives it a fresh
-- credits_used = 0 (consume_usage_credit's upsert then no-ops into that
-- already-moved row instead of creating a real new one), resetting the quota
-- without ever tripping protect_credits. All writes the client needs already
-- go through the SECURITY DEFINER RPCs (consume_usage_credit,
-- refund_usage_credit_for below), which bypass RLS as `postgres`
-- (rolbypassrls) same as every other RPC on this table — see
-- 20260811000005's design note. The client only ever SELECTs this table
-- (src/services/usageCreditService.ts); it needs no UPDATE policy at all.
drop policy if exists "usage_credits: update own" on public.usage_credits;

-- ── 2. Server-only refund, keyed by a JWT-verified user id ──────────────────
-- refund_usage_credit(text, date) (20260625000002) is auth.uid()-scoped and
-- granted to `authenticated` — a client can call it directly, in a loop, to
-- zero its own credits_used regardless of what the edge function actually
-- did. Replaced by a function only `service_role` can execute; the edge
-- functions call it with the id from their own auth.getUser() (never from
-- the request body) using a service-role client. The old function is kept
-- until both edge functions are redeployed to use this one (dropped in
-- 20260920000002).
create or replace function public.refund_usage_credit_for(
  p_user_id uuid,
  p_type    text,
  p_period  date
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.credit_write_allowed', 'on', true);

  update public.usage_credits
     set credits_used = greatest(0, credits_used - 1),
         updated_at   = now()
   where user_id = p_user_id and credit_type = p_type and period_start = p_period;
end;
$$;

revoke all on function public.refund_usage_credit_for(uuid, text, date) from public, anon, authenticated;
grant execute on function public.refund_usage_credit_for(uuid, text, date) to service_role;

-- ── 3. consume_rate_limit: ignore caller-supplied max/window ────────────────
-- Every edge function calls this RPC with its own bucket's p_max/
-- p_window_secs as literal args. Those aren't secret and PostgREST lets any
-- `authenticated` caller invoke the RPC directly with whatever arguments it
-- wants — e.g. p_window_secs=0 makes every call look "past the window" and
-- reset the counter to 1, so the limit never actually trips. The bucket name
-- is now the only caller input that matters: max/window come from a
-- server-side table below, keyed by the bucket names the edge functions
-- currently use (verified by grep across supabase/functions):
--   describe_outfit 60/60s, verdict_note 30/60s, curate_feed 30/3600s,
--   map_measurements 30/60s, tryon_validate 30/3600s, wardrobe_critic 10/3600s.
-- An unrecognized bucket fails closed (returns false) instead of silently
-- allowing unlimited calls — adding a new caller means adding its case here.
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
  v_max   integer;
  v_win   integer;
begin
  if v_uid is null then return false; end if;

  -- p_max/p_window_secs are intentionally ignored below — see comment above.
  case p_bucket
    when 'describe_outfit'   then v_max := 60; v_win := 60;
    when 'verdict_note'      then v_max := 30; v_win := 60;
    when 'curate_feed'       then v_max := 30; v_win := 3600;
    when 'map_measurements'  then v_max := 30; v_win := 60;
    when 'tryon_validate'    then v_max := 30; v_win := 3600;
    when 'wardrobe_critic'   then v_max := 10; v_win := 3600;
    else return false; -- unknown bucket → fail closed
  end case;

  insert into public.rate_limits (user_id, bucket, window_start, count)
  values (v_uid, p_bucket, v_now, 1)
  on conflict (user_id, bucket) do update
    set window_start = case
          when public.rate_limits.window_start < v_now - make_interval(secs => v_win)
          then v_now else public.rate_limits.window_start end,
        count = case
          when public.rate_limits.window_start < v_now - make_interval(secs => v_win)
          then 1 else public.rate_limits.count + 1 end
  returning count into v_count;

  return v_count <= v_max;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;
