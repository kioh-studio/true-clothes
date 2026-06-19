-- Migration: 20260608000003_clothing_items_v2
-- Adds name, primary_color, material, pattern, warmth_season to clothing_items.
-- Expands category CHECK constraint to include 'dress' and 'headwear'.

alter table public.clothing_items
  add column if not exists name          text,
  add column if not exists primary_color text not null default '',
  add column if not exists material      text,
  add column if not exists pattern       text,
  add column if not exists warmth_season text[] not null default '{}';

-- Drop old category check constraint and add updated one
do $$
begin
  -- Remove any existing category check constraint
  if exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.check_constraints cc using (constraint_schema, constraint_name)
    where tc.table_schema = 'public'
      and tc.table_name   = 'clothing_items'
      and tc.constraint_type = 'CHECK'
      and cc.check_clause like '%category%'
  ) then
    execute (
      select 'alter table public.clothing_items drop constraint ' || constraint_name
      from information_schema.table_constraints tc
      join information_schema.check_constraints cc using (constraint_schema, constraint_name)
      where tc.table_schema = 'public'
        and tc.table_name   = 'clothing_items'
        and tc.constraint_type = 'CHECK'
        and cc.check_clause like '%category%'
      limit 1
    );
  end if;
end;
$$;

alter table public.clothing_items
  add constraint clothing_items_category_check
    check (category in ('top', 'bottom', 'outerwear', 'footwear', 'accessory', 'dress', 'headwear'));
