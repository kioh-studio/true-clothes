-- Drop the old client-callable refund RPC now that both edge functions
-- (tryon-generate, generate-item-image) call refund_usage_credit_for
-- (20260920000001_close_credit_bypass.sql) via a service-role client instead.
-- refund_usage_credit(text, date) was auth.uid()-scoped and granted to
-- `authenticated`, so any signed-in client could call it directly, in a
-- loop, to zero its own credits_used regardless of what the edge function
-- actually did — verified nothing else in src/, app/, or supabase/functions
-- still calls it before dropping.
drop function if exists public.refund_usage_credit(text, date);
