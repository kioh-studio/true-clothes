alter table public.clothing_items
  add column if not exists price numeric(12,2) check (price is null or price >= 0);
