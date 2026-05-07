-- ============================================================
-- Migration 015 — FA tier hierarchy (Basic / Pro / Ultra) + fa_code
-- ============================================================
-- Foundation of the Phase 2 restructure. Adds three columns to
-- fa_profiles:
--
--   tier          'basic' | 'pro' | 'ultra'
--                 Determines what data the FA can see and which UI
--                 surfaces are available (e.g. /team page is Pro/Ultra
--                 only). 'basic' is the default for new signups.
--
--   fa_code       short uppercase string, unique across all FAs.
--                 Acts as the public identifier a Pro types when
--                 inviting a Basic to their team. Hidden from end
--                 customers. Format: 'V' + 6 hex chars derived from
--                 user_id (deterministic so the same FA always has
--                 the same code; we won't ever want to rotate it).
--
--   team_lead_id  nullable FK back to auth.users(id). For a Basic
--                 this points to their Pro; for a Pro it points to
--                 their Ultra; for an Ultra it stays NULL (Ultras
--                 are roots of their org tree).
--
-- Business rules enforced:
--   * Ultra MUST have team_lead_id = NULL (an Ultra can't be a
--     subordinate of another Ultra). Enforced via CHECK constraint.
--   * Pro MUST have team_lead_id pointing to an Ultra. Enforced
--     via trigger (CHECK can't reference another row).
--   * Basic MAY have team_lead_id = NULL (un-affiliated Basic) OR
--     pointing to a Pro. Same trigger.
--   * tier transitions (Basic→Pro, Pro→Ultra, etc) are managed by
--     Super Admin via direct SQL or the existing /admin UI in
--     Phase 2. No self-promotion.
--
-- All columns are added IF NOT EXISTS so this migration is safe
-- to re-run on a partially-applied DB.
-- ============================================================

-- ── 1. Add the columns ────────────────────────────────────────
alter table public.fa_profiles
  add column if not exists tier text not null default 'basic'
    check (tier in ('basic', 'pro', 'ultra')),
  add column if not exists fa_code text,
  add column if not exists team_lead_id uuid references auth.users(id);

-- ── 2. Backfill fa_code for any existing rows ─────────────────
-- Format: 'V' + first 6 chars of MD5(user_id) → uppercase.
-- Uses md5 from pgcrypto (already enabled in migration 001).
update public.fa_profiles
   set fa_code = 'V' || upper(substr(md5(user_id::text), 1, 6))
 where fa_code is null;

-- Make fa_code NOT NULL + UNIQUE now that every row has one.
alter table public.fa_profiles
  alter column fa_code set not null;

-- A second migration adding UNIQUE separately so re-runs don't error.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'fa_profiles_fa_code_key'
       and conrelid = 'public.fa_profiles'::regclass
  ) then
    alter table public.fa_profiles
      add constraint fa_profiles_fa_code_key unique (fa_code);
  end if;
end $$;

-- ── 3. Indexes ────────────────────────────────────────────────
create index if not exists fa_profiles_team_lead_idx
  on public.fa_profiles(team_lead_id);

create index if not exists fa_profiles_tier_idx
  on public.fa_profiles(tier);

-- ── 4. Business-rule constraint: Ultra has no lead ────────────
-- A row-level CHECK is enough for "Ultra → team_lead_id must be NULL".
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'fa_profiles_ultra_no_lead'
       and conrelid = 'public.fa_profiles'::regclass
  ) then
    alter table public.fa_profiles
      add constraint fa_profiles_ultra_no_lead
      check (tier <> 'ultra' or team_lead_id is null);
  end if;
end $$;

-- ── 5. Cross-row business rules via trigger ───────────────────
-- "Pro's team_lead_id must point to an Ultra"
-- "Basic's team_lead_id (if set) must point to a Pro"
-- Implemented as a BEFORE INSERT/UPDATE trigger.
create or replace function public.tg_fa_profiles_validate_lead()
returns trigger
language plpgsql
as $$
declare
  lead_tier text;
begin
  -- Skip when no lead is set (allowed for Basic and required for Ultra)
  if new.team_lead_id is null then
    return new;
  end if;

  -- Self-reference is never allowed
  if new.team_lead_id = new.user_id then
    raise exception 'fa_profiles.team_lead_id cannot equal user_id'
      using errcode = 'check_violation';
  end if;

  select tier into lead_tier
    from public.fa_profiles
   where user_id = new.team_lead_id;

  if lead_tier is null then
    raise exception 'team_lead_id (%) does not refer to an existing fa_profile',
      new.team_lead_id
      using errcode = 'foreign_key_violation';
  end if;

  if new.tier = 'basic' and lead_tier <> 'pro' then
    raise exception 'A Basic FA must have a team_lead_id that points to a Pro (got %)',
      lead_tier
      using errcode = 'check_violation';
  end if;

  if new.tier = 'pro' and lead_tier <> 'ultra' then
    raise exception 'A Pro FA must have a team_lead_id that points to an Ultra (got %)',
      lead_tier
      using errcode = 'check_violation';
  end if;

  -- Ultra case is already covered by fa_profiles_ultra_no_lead CHECK.
  return new;
end;
$$;

drop trigger if exists fa_profiles_validate_lead on public.fa_profiles;
create trigger fa_profiles_validate_lead
  before insert or update on public.fa_profiles
  for each row execute function public.tg_fa_profiles_validate_lead();

-- ── 6. Comments ───────────────────────────────────────────────
comment on column public.fa_profiles.tier is
  'FA tier: basic (default) | pro (team lead) | ultra (regional lead). '
  'Determines RLS visibility and which UI surfaces are unlocked.';

comment on column public.fa_profiles.fa_code is
  'Public-facing short code used during team invitations. '
  'Deterministic from user_id; never rotated.';

comment on column public.fa_profiles.team_lead_id is
  'Reference to this FA''s direct lead. NULL for Ultra (root) or '
  'unaffiliated Basic. Set when a team invitation is accepted.';
