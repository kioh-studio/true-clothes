-- Migration: 20260616000001_profiles_account_type
-- Adds an account-type discriminator to profiles so account class is queryable
-- in the DB (was previously only known at runtime via RevenueCat / hardcoded demo).
--
--   'free'    -> default; no premium entitlement
--   'premium' -> paid tier (cloud photo storage, unlimited curated batches)
--   'demo'    -> demo/test account (src/config/demo.ts)
--   'admin'   -> internal/admin account
--
-- NOTE: this column does NOT auto-sync with RevenueCat. Decide the source of
-- truth in app wiring: either RevenueCat stays authoritative for 'premium'
-- (a webhook writes this column), or this column overrides for demo/dev.

alter table public.profiles
  add column if not exists account_type text not null default 'free'
    check (account_type in ('free', 'premium', 'demo', 'admin'));
