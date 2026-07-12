-- Least-privilege: revoke EXECUTE on the credit/rate-limit RPCs from `anon`.
-- Supabase's default privileges grant EXECUTE on new public functions to anon,
-- authenticated, and service_role, so `revoke ... from public` in the prior
-- migration did not remove the anon grant. These functions are auth.uid()-scoped
-- (a no-op for an unauthenticated caller) so this is defence-in-depth, but they
-- should only ever be invoked by the edge functions running with a user JWT
-- (the `authenticated` role). This also clears the security advisor warning.
revoke execute on function public.consume_usage_credit(text, date, integer) from anon;
revoke execute on function public.refund_usage_credit(text, date) from anon;
revoke execute on function public.consume_rate_limit(text, integer, integer) from anon;
