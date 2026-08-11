-- Close the INSERT/DELETE gap the previous migration
-- (20260811000004_protect_usage_credits_trigger.sql) left open. That
-- migration's protect_credits() trigger only guards UPDATE (BEFORE UPDATE,
-- mirroring protect_account_type()'s shape). But the table's only RLS policy
-- ("Users own usage credits", cmd=ALL, qual=auth.uid()=user_id, no
-- WITH CHECK) still let any authenticated user INSERT or DELETE their own
-- rows directly via PostgREST — Postgres RLS grants INSERT/DELETE under an
-- ALL policy the same as SELECT/UPDATE unless narrower policies say
-- otherwise. Two real exploits followed from this:
--   1. DELETE the current-period row, then INSERT a fresh one with
--      credits_used = 0 — recreates the exact reset the UPDATE trigger was
--      built to stop, just via a different pair of commands.
--   2. INSERT a fresh row for a period that doesn't exist yet with an
--      absurdly negative credits_used (e.g. -1000000) — consume_usage_credit's
--      guard `credits_used < p_limit` stays true for ~a million calls
--      afterward (its own UPDATE only ever does `credits_used = credits_used
--      + 1`, it never resets a pre-seeded value), giving effectively
--      unlimited credits without ever tripping the "reset to 0" pattern.
--
-- Design decision: RLS-only, not another GUC-flag trigger. Verified live
-- (session notes) that `usage_credits` is owned by `postgres`, which has
-- `rolbypassrls = true` — same as the role consume_usage_credit()/
-- refund_usage_credit() run as while executing (SECURITY DEFINER, owned by
-- postgres). RLS is bypassed for that role entirely, independent of any
-- policy, so denying INSERT/DELETE to `anon`/`authenticated` cannot block the
-- legitimate RPC path (verified end-to-end after applying, not just
-- reasoned about — see session notes). A trigger duplicating "no such
-- policy exists" would just be the same rule expressed twice; the ALL policy
-- with no WITH CHECK was the actual root cause, per the brief, so this fixes
-- it at the root instead of layering another special case on top.
--
-- Net result: `anon`/`authenticated` get SELECT (unchanged — checkCredit()
-- reads live usage) and UPDATE (unchanged in shape, still further gated by
-- the protect_credits trigger for credits_used/credits_limit — this
-- migration doesn't touch that) of their own rows; INSERT and DELETE have NO
-- policy at all, so RLS default-denies both for every client-facing role.
-- `service_role` and `postgres` are unaffected (BYPASSRLS).
drop policy if exists "Users own usage credits" on public.usage_credits;

create policy "usage_credits: select own"
  on public.usage_credits for select
  using ((select auth.uid()) = user_id);

create policy "usage_credits: update own"
  on public.usage_credits for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Deliberately no INSERT or DELETE policy — see comment above.
