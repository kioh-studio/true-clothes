-- Feature 006-ai-item-extraction: capture per-garment logo / statement signals.
-- Stored as a JSONB blob: { present, size, kind, text }.
-- The fit engine does NOT read this yet (captured for future graphics scoring).

alter table public.clothing_items
  add column if not exists graphics jsonb;

comment on column public.clothing_items.graphics is
  'Logo/statement signals captured at ingest (feature 006): {present,size,kind,text}. Not read by the fit engine yet.';
