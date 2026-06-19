-- Migration: 20260608000002_measurements_v2
-- Expands body_measurements from 5 fields to 15.
-- Renames chest → bust; adds 10 new measurement columns + body_shape + consent fields.

-- Rename chest → bust if the old column name exists
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'body_measurements'
      and column_name  = 'chest'
  ) then
    alter table public.body_measurements rename column chest to bust;
  end if;
end;
$$;

-- Add bust column if neither chest nor bust exists (fresh DB)
alter table public.body_measurements
  add column if not exists bust numeric;

-- New measurement columns
alter table public.body_measurements
  add column if not exists inseam             numeric,
  add column if not exists thigh              numeric,
  add column if not exists rise               numeric,
  add column if not exists shoulder_width     numeric,
  add column if not exists sleeve_length      numeric,
  add column if not exists upper_body_length  numeric,
  add column if not exists upper_arm          numeric,
  add column if not exists neck               numeric,
  add column if not exists foot_length        numeric,
  add column if not exists foot_width         numeric;

-- Body shape and pose flags
alter table public.body_measurements
  add column if not exists body_shape           text check (body_shape in ('hourglass', 'rectangle', 'triangle', 'inverted_triangle', 'apple')),
  add column if not exists pose_estimated       boolean not null default false,
  add column if not exists measurements_consent boolean not null default false;
