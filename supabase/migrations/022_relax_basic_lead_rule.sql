-- ============================================================
-- Migration 022 — relax Basic team_lead rule (allow Basic→Ultra)
-- ============================================================
-- Migration 015 enforced that a Basic FA's team_lead_id must point
-- to a Pro. After hands-on testing this turned out to be too strict
-- for real Victory operations:
--
--   - When a Pro leaves, all Basics under them lose their team
--     lead until a new Pro is assigned. Forcing the chain to be
--     unbroken means temporary state has no valid representation.
--   - Some FAs (mentees, star performers) report directly to a
--     regional Ultra without a Pro intermediary.
--   - Brand-new regions don't have Pros yet — Ultras run them
--     directly until headcount grows.
--
-- This migration relaxes the rule:
--   * Basic.team_lead_id can now point to Pro **or** Ultra
--   * Pro.team_lead_id must still point to Ultra (no change)
--   * Ultra.team_lead_id must still be NULL (no change)
--
-- Visibility / RLS / RPCs from migration 020+021 don't change —
-- they walk the team_lead_id chain regardless of tier transitions
-- so an Ultra still sees Basics that report to them directly.
-- ============================================================

create or replace function public.tg_fa_profiles_validate_lead()
returns trigger
language plpgsql
as $$
declare
  lead_tier text;
begin
  -- Skip when no lead is set (allowed for Basic and required for Ultra).
  if new.team_lead_id is null then
    return new;
  end if;

  -- Self-reference is never allowed.
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

  -- RELAXED: a Basic FA can have a Pro OR an Ultra as their lead.
  -- The earlier "must be Pro" rule was overly strict — see header.
  if new.tier = 'basic' and lead_tier not in ('pro', 'ultra') then
    raise exception
      'A Basic FA must have a team_lead_id that points to a Pro or Ultra (got %)',
      lead_tier
      using errcode = 'check_violation';
  end if;

  -- Pros still must report to Ultras (preserves the integrity of the
  -- middle tier — we don't want Pro → Pro chains).
  if new.tier = 'pro' and lead_tier <> 'ultra' then
    raise exception
      'A Pro FA must have a team_lead_id that points to an Ultra (got %)',
      lead_tier
      using errcode = 'check_violation';
  end if;

  -- Ultra case is already covered by the fa_profiles_ultra_no_lead
  -- CHECK constraint — execution can't reach this point with
  -- new.tier = 'ultra' AND new.team_lead_id IS NOT NULL.

  return new;
end;
$$;

-- Trigger itself doesn't need re-creation — it already references
-- this function by name. CREATE OR REPLACE FUNCTION above is enough
-- for new behaviour to take effect on the next INSERT/UPDATE.
