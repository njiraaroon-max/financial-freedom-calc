-- 010_victory_luxury_palette.sql
--
-- Refine Victory's palette to the private-banking / wealth-management spec:
--
--   color_primary      = #062B5F  (primary navy — headlines, buttons, main ink)
--   color_primary_dark = #041833  (deep navy — hero gradient end, ultra-dark anchor)
--   color_accent       = #D6B56D  (champagne gold — subtle luxury highlight,
--                                  used for the "Recommended" comprehensive card
--                                  and featured chips)
--
-- Replaces the values set by migration 009 (#0B3A78 / #061B3A). The new
-- primary navy is slightly darker and warmer, pairing better with the
-- royal-blue (#0B4EA2) used for module icon tints inside HomePro, which
-- is hardcoded in the component (not stored per-tenant) so every
-- professional-skin org inherits the same premium look.
--
-- Idempotent: UPDATE keyed by slug, safe to re-run.

update public.organizations
set
  color_primary      = '#062B5F',
  color_primary_dark = '#041833',
  color_accent       = '#D6B56D'
where slug = 'victory';
