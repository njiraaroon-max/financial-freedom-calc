-- 008_victory_rebrand.sql
--
-- Rebrand the Victory tenant:
--   name:    'Victory Group'        → 'Victory Financial Group'
--   tagline: 'Financial but Luxury' → null (hero shows the big logo instead)
--
-- Migration 007 seeded the row with the old copy. We can't change a seed
-- that already ran in a user's DB, so this idempotent UPDATE patches it
-- in place. Safe to re-run — the WHERE clause matches on slug, which is
-- the stable tenant key.

update public.organizations
set
  name = 'Victory Financial Group',
  tagline = null
where slug = 'victory';
