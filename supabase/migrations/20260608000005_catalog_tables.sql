-- Migration: 20260608000005_catalog_tables
-- Creates public.styles and public.formulas catalog tables (server-driven, admin-managed).
-- Also adds the deferred FK from style_profiles.active_formula_id → formulas.id.

-- ─── public.formulas ──────────────────────────────────────────────────────────

create table if not exists public.formulas (
  id            uuid        primary key default gen_random_uuid(),
  slug          text        unique not null,
  name          text        not null,
  name_vi       text,
  description   text        not null default '',
  display_order int         not null default 0,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now()
);

alter table public.formulas enable row level security;

create policy "formulas: select authenticated"
  on public.formulas for select to authenticated using (true);

-- ─── public.styles ────────────────────────────────────────────────────────────

create table if not exists public.styles (
  id            uuid        primary key default gen_random_uuid(),
  slug          text        unique not null,
  name          text        not null,
  name_vi       text,
  description   text        not null default '',
  related_slugs text[]      not null default '{}',
  display_order int         not null default 0,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now()
);

alter table public.styles enable row level security;

create policy "styles: select authenticated"
  on public.styles for select to authenticated using (true);

-- ─── FK from style_profiles.active_formula_id → formulas.id ──────────────────
-- Added here because formulas table must exist before the FK constraint.

alter table public.style_profiles
  add constraint if not exists style_profiles_active_formula_id_fkey
    foreign key (active_formula_id) references public.formulas(id) on delete set null;

-- ─── Seed: formulas ───────────────────────────────────────────────────────────

insert into public.formulas (slug, name, name_vi, description, display_order) values
  ('color_harmony',       'Color Harmony',       'Hài hòa màu sắc',      'Outfits where item colors complement each other using proven color theory.',          1),
  ('rule_of_thirds',      'Rule of Thirds',      'Quy tắc một phần ba',  'Divide the outfit into three proportional zones of color or texture.',                2),
  ('proportion_balance',  'Proportion Balance',  'Cân bằng tỷ lệ',       'Pair fitted and relaxed pieces to flatter your body shape.',                         3),
  ('monochrome',          'Monochrome',          'Đơn sắc',               'One color family across the entire outfit, varied by texture and shade.',             4)
on conflict (slug) do nothing;

-- ─── Seed: styles ─────────────────────────────────────────────────────────────

insert into public.styles (slug, name, name_vi, description, related_slugs, display_order) values
  ('minimalist',    'Minimalist',    'Tối giản',          'Clean lines, neutral palette, no excess.',                 array['smart_casual','monochrome'],         1),
  ('streetwear',    'Streetwear',    'Thời trang đường phố', 'Casual, urban, graphic-forward.',                       array['athleisure','casual'],               2),
  ('smart_casual',  'Smart Casual',  'Thanh lịch thường ngày', 'Polished but relaxed — office-to-dinner.',           array['business','minimalist'],             3),
  ('business',      'Business',      'Công sở',           'Professional, structured, formal-leaning.',                array['smart_casual'],                      4),
  ('casual',        'Casual',        'Thường ngày',        'Everyday comfortable basics.',                             array['streetwear','athleisure'],           5),
  ('athleisure',    'Athleisure',    'Thể thao năng động', 'Athletic-inspired pieces styled for daily life.',         array['casual','streetwear'],               6),
  ('vintage',       'Vintage',       'Cổ điển',            'Retro-inspired silhouettes and nostalgia-driven pieces.', array['bohemian'],                          7),
  ('bohemian',      'Bohemian',      'Bohemian',           'Free-spirited, earthy, layered textures.',                array['vintage'],                           8)
on conflict (slug) do nothing;
