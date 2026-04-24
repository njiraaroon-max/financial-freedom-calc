-- ============================================================
-- Migration 012 — Skin follows Organization (auto-sync)
-- ============================================================
-- Until now, fa_profiles.skin was a fully independent column
-- from fa_profiles.organization_id, so admins had to keep them
-- in sync by hand: "ย้าย FA ไป Victory ← อย่าลืมเปลี่ยน skin เป็น pro ด้วย".
-- Easy to forget, and a misconfigured skin-vs-org combo looks
-- broken (Legacy home with Victory branding is incoherent).
--
-- This migration adds a BEFORE INSERT/UPDATE trigger on fa_profiles
-- that auto-syncs skin to the target organization's default_skin,
-- EXCEPT when the admin has explicitly changed skin in the same
-- UPDATE — in that case the explicit value wins (so overrides still
-- work, e.g. previewing another skin without moving org).
--
-- Behavior matrix (UPDATE):
--   org changed, skin unchanged           → skin := new org.default_skin  (auto-sync)
--   org unchanged, skin changed           → skin := admin's new value     (explicit override)
--   org changed, skin changed (same txn)  → skin := admin's new value     (explicit wins)
--   nothing changed                        → no-op
--
-- INSERT:
--   skin is always derived from organization_id's default_skin.
--   The handle_new_user trigger (migration 007) is kept but its
--   hardcoded skin='legacy' is now overridden by this trigger.
-- ============================================================

create or replace function public.sync_skin_with_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_skin text;
begin
  if tg_op = 'INSERT' then
    -- Always pull from the org on new rows. If organization_id is
    -- null (shouldn't happen since 007 made it NOT NULL, but be
    -- defensive), leave skin as whatever the caller supplied.
    if new.organization_id is not null then
      select default_skin into target_skin
        from public.organizations
       where id = new.organization_id;
      if target_skin is not null then
        new.skin := target_skin;
      end if;
    end if;

  elsif tg_op = 'UPDATE' then
    -- Only auto-sync when admin moved the FA between orgs without
    -- also touching skin. If skin changed in this same UPDATE the
    -- admin is deliberately overriding — don't clobber that.
    if new.organization_id is distinct from old.organization_id
       and new.skin is not distinct from old.skin then
      select default_skin into target_skin
        from public.organizations
       where id = new.organization_id;
      if target_skin is not null then
        new.skin := target_skin;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_skin_with_org_trigger on public.fa_profiles;
create trigger sync_skin_with_org_trigger
  before insert or update on public.fa_profiles
  for each row execute function public.sync_skin_with_org();


-- ── One-time reconciliation ──────────────────────────────────
-- Existing FAs may currently have skin inconsistent with their
-- org (e.g. an Avenger FA stuck on 'legacy' because they were
-- moved before this trigger existed). We deliberately DO NOT
-- auto-reconcile here — forcing a skin flip retroactively could
-- surprise an FA who explicitly opted into a different skin for
-- testing. Admin can bulk-align via:
--
--   update public.fa_profiles f
--      set skin = o.default_skin
--     from public.organizations o
--    where f.organization_id = o.id
--      and f.skin <> o.default_skin;
--
-- Run it manually once reviewed, or use the /admin UI to flip
-- individual rows (org change now auto-syncs skin going forward).
