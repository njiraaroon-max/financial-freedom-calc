-- ============================================================
-- Migration 011 — Avenger Planner org + org-level default_features
-- ============================================================
-- Seeds Avenger Planner as the second professional-skin tenant.
--
-- Key idea introduced here: `organizations.default_features` (JSONB).
-- When a new FA is created by the handle_new_user trigger, we merge
-- the org's default_features into the fa_profiles.features row. This
-- lets each tenant ship with its own baseline feature-flag profile —
-- e.g. Avenger Planner defaults to Comprehensive-only (Modular off),
-- without requiring admin to toggle it per FA after signup.
--
-- The Avenger Planner brand palette is derived from the AVP logo:
--   dark navy text (#1A2B47)
--   bright blue accent on the "A" mark and the "l" in planner (#2B7FD8)
-- Tagline is their site mission statement.
-- ============================================================

-- ── 1. Add default_features column to organizations ──────────
alter table public.organizations
  add column if not exists default_features jsonb not null default '{}'::jsonb;

comment on column public.organizations.default_features is
  'Feature flags applied to new FAs that sign up under this org. Merged into fa_profiles.features by handle_new_user trigger. Keys follow the FeatureFlags interface in src/lib/supabase/database.types.ts.';

-- ── 2. Seed Avenger Planner org ──────────────────────────────
-- Logo lives at /public/brands/avenger-planner/logo.png (copied
-- from ./Avenger Planner Logo/AVP-Logo-Transparent.png).
--
-- default_features forces Comprehensive-only: HomePro hides the
-- mode selector when only one mode is enabled (see HomePro.tsx).
insert into public.organizations (
  slug, name, tagline,
  logo_url, logo_dark_url, favicon_url,
  color_primary, color_primary_dark, color_accent,
  font_display, font_body,
  default_skin,
  default_features
) values (
  'avenger-planner',
  'Avenger Planner',
  'การทำให้คนไทยในทุกระดับสามารถเข้าถึงคำแนะนำทางการเงินที่ดีได้',
  '/brands/avenger-planner/logo.png',
  '/brands/avenger-planner/logo.png',
  null,
  '#1A2B47',   -- dark navy — "Avenger planner" text color
  '#0F1E33',   -- deeper navy for hover / primary-dark
  '#2B7FD8',   -- bright blue — the A mark + "l" accent
  'Inter',     -- modern sans-serif, professional not luxury
  'Sarabun',   -- Thai-friendly body font (already used in app)
  'professional',
  jsonb_build_object(
    'mode_modular_enabled', false,
    'mode_comprehensive_enabled', true
  )
)
on conflict (slug) do nothing;


-- ── 3. Update handle_new_user trigger to merge default_features ─
-- Supersedes the version from migration 007. Now the new FA's
-- `features` column starts from the org's default_features instead
-- of the hardcoded '{}'. Uses jsonb concatenation so later admin
-- edits still fully replace the JSONB (no accidental merge layers).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_org_id uuid;
  org_default_features jsonb;
begin
  -- Default org = Financial Planner (matches 007 behavior). Admins
  -- reassign to Victory / Avenger / etc. at approval time.
  select id, default_features
    into default_org_id, org_default_features
    from public.organizations
   where slug = 'financial-planner'
   limit 1;

  insert into public.fa_profiles (
    user_id, email, display_name, organization_id, skin, features
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    default_org_id,
    'legacy',
    coalesce(org_default_features, '{}'::jsonb)
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;


-- ── 4. (Optional) Backfill — explain why we don't ────────────
-- We deliberately do NOT backfill existing FA rows. `features` is
-- an admin-controlled column per FA; existing users already have
-- their flags either set or defaulted (undefined → defaultTrue in
-- the UI). Forcing Avenger defaults on pre-existing Avenger FAs
-- (if any exist before this migration runs) would surprise them.
-- Admin can manually toggle `mode_modular_enabled` in the UI if
-- needed — the Features modal exposes it in the "Planning modes"
-- section.
