-- Distressed vocabulary gap fix (2026-08-11, closing the earlier 240a5b1
-- 'distressed' removal). `distressed` is a declared BannedFeature and was
-- listed on 14 style configs' bannedFeatures, but the engine had no signal to
-- enforce it against, so it was dead vocabulary. This column makes it real:
-- ingest-time signal for a visible INTENTIONAL wear/damage finish (rips,
-- tears, frayed/raw hems, heavy fading/whiskering, acid/stone wash,
-- deliberately abraded surfaces) — NOT natural slubby texture, normal wash,
-- soft/worn-in feel, or vintage styling without actual damage.
--
-- Nullable: NULL = unknown/not yet assessed (~70 existing items predate this
-- column). featuresPasses (filtering.ts) is fail-open — it only rejects when
-- distressed IS true AND the style bans it; NULL/undefined never rejects.
alter table public.clothing_items
  add column if not exists distressed boolean;
