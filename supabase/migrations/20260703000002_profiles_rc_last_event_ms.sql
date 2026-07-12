-- Migration: 20260703000002_profiles_rc_last_event_ms
-- revenuecat-webhook idempotency/out-of-order guard (backlog.md section F).
-- Stores the event_timestamp_ms of the last RC event that successfully changed
-- account_type for this user, so a delayed/retried older event (e.g. a late
-- EXPIRATION redelivered after a subsequent RENEWAL) can never clobber a newer
-- event's result — the webhook's UPDATE only applies when the incoming event's
-- timestamp is newer than what's stored here (or nothing stored yet).
alter table public.profiles
  add column if not exists rc_last_event_ms bigint;
