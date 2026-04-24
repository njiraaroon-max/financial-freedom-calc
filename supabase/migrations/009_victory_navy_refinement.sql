-- 009_victory_navy_refinement.sql
--
-- Refine the Victory palette for a deeper, more premium hero.
--
-- Previous values (migration 007):
--   color_primary      = #003780  (mid navy from the brand book)
--   color_primary_dark = #002659  (darker navy)
--
-- New values:
--   color_primary      = #0B3A78  (slightly warmer / more saturated navy —
--                                  becomes the "light end" of the hero
--                                  gradient, under the radial glow)
--   color_primary_dark = #061B3A  (deep, near-black navy — anchors the
--                                  bottom-right of the gradient and makes
--                                  the white logo pop more)
--
-- Idempotent: UPDATE keyed by slug so it's safe to re-run.

update public.organizations
set
  color_primary      = '#0B3A78',
  color_primary_dark = '#061B3A'
where slug = 'victory';
