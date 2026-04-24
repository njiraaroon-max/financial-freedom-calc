-- ============================================================
-- Migration 007 — Organizations (multi-tenant) + skins + feature flags
-- ============================================================
-- Introduces the "organization" concept so the app can serve multiple
-- brands (Financial Planner / Victory Group / ...) with their own theme,
-- logo, and default skin. Also adds three per-FA knobs:
--
--   skin            — 'legacy' | 'professional'
--                     Which Home layout the FA sees. Admin-only to change.
--   planning_mode   — 'modular' | 'comprehensive'
--                     Per-FA default when they start planning. The FA
--                     CAN toggle this themselves (per-client override
--                     lives on clients in a later migration).
--   features        — JSONB feature flag map. Admin-only to change.
--                     Keys: see seed defaults below. JSONB lets us add
--                     new flags without further migrations.
--
-- Existing users all land in the "financial-planner" org with
-- skin='legacy' so nothing changes for them today. Victory Group is
-- seeded here as the first professional-skin tenant.
--
-- RLS:
--   - Any authenticated user can SELECT their own organization row
--     (needed for theme/logo lookup on every page load).
--   - Admins can SELECT + INSERT + UPDATE all organizations.
--
-- Admin-only fields on fa_profiles are protected by extending the
-- protect_role_status() trigger from migration 004/006.
-- ============================================================

-- ── organizations table ──────────────────────────────────────
create table if not exists public.organizations (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,   -- 'victory' — URL-safe
  name              text not null,          -- 'Victory Group'
  tagline           text,                   -- 'Financial but Luxury'

  -- Branding (all paths are relative URLs under /public or a storage URL)
  logo_url          text,
  logo_dark_url     text,                   -- for dark backgrounds
  favicon_url       text,
  color_primary     text not null default '#6366f1',  -- hex
  color_primary_dark text,                   -- hover / active state
  color_accent      text,                    -- decorative, charts, badges

  -- Typography (frontend composes these into a fallback stack)
  font_display      text default 'Inter',    -- headings / hero
  font_body         text default 'Inter',    -- body copy

  -- Behavior
  default_skin      text not null default 'legacy'
    check (default_skin in ('legacy', 'professional')),

  -- Navigation customization (white-label level 2):
  --   {"order": ["retirement","insurance",...], "hidden": ["goals"]}
  -- Empty object = use app default.
  nav_config        jsonb not null default '{}'::jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.organizations is
  'Multi-tenant brand / organization. Each FA belongs to exactly one.';

-- updated_at trigger function. Normally lives in migration 001, but we
-- re-declare it here defensively (create or replace) so this migration
-- works even if 001 was applied in a variant that didn't include it.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.tg_set_updated_at();


-- ── Seed organizations ──────────────────────────────────────
-- Financial Planner = the existing "Legacy" tenant. All users
-- currently in the DB will be back-filled to this org below.
insert into public.organizations (slug, name, tagline, default_skin)
values (
  'financial-planner',
  'Financial Planner',
  null,
  'legacy'
)
on conflict (slug) do nothing;

-- Victory Group = first professional-skin tenant.
-- Colors + fonts come straight from the Victory brand guidelines
-- (Chu Design Studio). Logo paths are placeholders — the actual
-- files will be copied into /public/brands/victory/ in a follow-up
-- commit, and the URLs updated via the admin UI (or manual SQL).
insert into public.organizations (
  slug, name, tagline,
  logo_url, logo_dark_url, favicon_url,
  color_primary, color_primary_dark, color_accent,
  font_display, font_body,
  default_skin
) values (
  'victory',
  'Victory Financial Group',
  null,
  '/brands/victory/logo.png',
  '/brands/victory/logo-white.png',
  '/brands/victory/favicon.ico',
  '#003780',   -- navy (per brand book: HEX 003780)
  '#002659',   -- darker navy for hover
  '#b8c7e0',   -- metallic blue accent (simplified from gradient)
  'Oswald',    -- substitute for Engravers Gothic BT (Google Fonts, web-safe)
  'Sarabun',   -- substitute for TH Sarabun New (Google Fonts, full Thai support)
  'professional'
)
on conflict (slug) do nothing;


-- ── Extend fa_profiles ───────────────────────────────────────
alter table public.fa_profiles
  add column if not exists organization_id uuid
    references public.organizations(id) on delete restrict;

alter table public.fa_profiles
  add column if not exists skin text
    check (skin in ('legacy', 'professional'));

alter table public.fa_profiles
  add column if not exists planning_mode text not null default 'comprehensive'
    check (planning_mode in ('modular', 'comprehensive'));

-- Feature flags — JSONB so we can add flags without migrations.
-- NEW sign-ups get basic tier (report_pdf + 5 clients); admins upgrade
-- them via the admin dashboard. Existing users are backfilled with
-- everything enabled below (they've been using the app unrestricted).
alter table public.fa_profiles
  add column if not exists features jsonb not null default '{
    "report_pdf": true,
    "export_excel": false,
    "ci_shock_simulator": false,
    "allianz_deep_data": false,
    "multi_insurer_compare": false,
    "client_limit": 5,
    "custom_branding": false
  }'::jsonb;


-- ── Back-fill existing users ─────────────────────────────────
-- Everyone who signed up before this migration goes to Financial
-- Planner org with legacy skin. They get ALL features enabled — they
-- were using the app without gating, so we don't want to suddenly
-- lock them out of anything.
update public.fa_profiles
   set organization_id = (
         select id from public.organizations where slug = 'financial-planner'
       ),
       skin = 'legacy',
       features = '{
         "report_pdf": true,
         "export_excel": true,
         "ci_shock_simulator": true,
         "allianz_deep_data": true,
         "multi_insurer_compare": true,
         "client_limit": 999,
         "custom_branding": false
       }'::jsonb
 where organization_id is null;

-- Now that every row has a value, make them NOT NULL.
alter table public.fa_profiles
  alter column organization_id set not null,
  alter column skin set not null;

create index if not exists fa_profiles_organization_id_idx
  on public.fa_profiles(organization_id);


-- ── Protect admin-only fields ────────────────────────────────
-- Extends the guard from 004/006 so FAs can't self-change their org,
-- skin, or features. planning_mode is NOT protected here — FAs are
-- allowed to toggle it themselves.
create or replace function public.protect_role_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip the check outside an auth context (SQL editor bootstrapping).
  if auth.uid() is null then
    return new;
  end if;

  if (
    old.role is distinct from new.role
    or old.status is distinct from new.status
    or old.expires_at is distinct from new.expires_at
    or old.organization_id is distinct from new.organization_id
    or old.skin is distinct from new.skin
    or old.features is distinct from new.features
  ) and not public.is_admin() then
    raise exception
      'role, status, expires_at, organization_id, skin, or features '
      'can only be modified by an admin';
  end if;
  return new;
end;
$$;


-- ── RLS on organizations ─────────────────────────────────────
alter table public.organizations enable row level security;

-- Every authenticated user needs to read their own org (for theme/logo
-- on every page). Cross-org reads are blocked unless admin.
drop policy if exists "organizations_own_select" on public.organizations;
create policy "organizations_own_select"
  on public.organizations for select
  using (
    id = (
      select organization_id from public.fa_profiles
      where user_id = auth.uid()
    )
  );

drop policy if exists "organizations_admin_select" on public.organizations;
create policy "organizations_admin_select"
  on public.organizations for select
  using (public.is_admin());

drop policy if exists "organizations_admin_insert" on public.organizations;
create policy "organizations_admin_insert"
  on public.organizations for insert
  with check (public.is_admin());

drop policy if exists "organizations_admin_update" on public.organizations;
create policy "organizations_admin_update"
  on public.organizations for update
  using (public.is_admin())
  with check (public.is_admin());

-- No DELETE policy — organizations should be archived (status column
-- if needed later) rather than hard-deleted, to protect referential
-- integrity with fa_profiles.


-- ── Update signup trigger (003) to stamp organization_id ─────
-- New sign-ups go to Financial Planner by default. Admins can reassign
-- to Victory Group (or any org) at approval time via the admin UI.
-- This overrides the handle_new_user() function from migration 003.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_org_id uuid;
begin
  select id into default_org_id
    from public.organizations
   where slug = 'financial-planner'
   limit 1;

  insert into public.fa_profiles (
    user_id, email, display_name, organization_id, skin
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    default_org_id,
    'legacy'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;
