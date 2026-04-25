-- ============================================================
-- Migration 013 — Victory: Health + Savings Combo (sales tool)
-- ============================================================
-- Introduces the first "Sales tools" feature flag —
-- `health_savings_combo` — and gives it to Victory by default.
-- The combo bundles HSMHPDC (health rider) with MDP 25/20
-- (endowment) and frames the maturity benefit as "ประกันสุขภาพฟรี
-- + กำไร". Senior Victory FAs already use a standalone version
-- of this calculator (musical-lolly-3aaa85.netlify.app) — this
-- migration brings it inside the planner suite.
--
-- Gating policy:
--   * Other orgs (Financial Planner / Avenger Planner / future
--     tenants) → flag absent (effectively false). Admin can flip
--     per-FA from /admin if a non-Victory FA needs it.
--   * Victory → flag = true on org default_features so new
--     signups auto-receive it AND existing Victory FAs are
--     back-filled below.
-- ============================================================

-- ── 1. Set Victory's org default ─────────────────────────────
-- Merge into existing default_features rather than replacing —
-- avoids stomping on any flags Victory might add later via UI.
update public.organizations
   set default_features = default_features
                          || jsonb_build_object('health_savings_combo', true)
 where slug = 'victory';

-- ── 2. Back-fill existing Victory FA rows ────────────────────
-- The handle_new_user trigger only seeds default_features at
-- signup, so FAs created before this migration would otherwise
-- never see the flag. Merge it in for any Victory FA that
-- doesn't already have an explicit value (true OR false — we
-- respect deliberate admin overrides).
update public.fa_profiles f
   set features = features || jsonb_build_object('health_savings_combo', true)
  from public.organizations o
 where f.organization_id = o.id
   and o.slug = 'victory'
   and not (f.features ? 'health_savings_combo');

-- ── 3. Comment for future reference ──────────────────────────
comment on column public.organizations.default_features is
  'Feature flags applied to new FAs that sign up under this org. Merged into fa_profiles.features by handle_new_user trigger. Keys follow the FeatureFlags interface in src/lib/supabase/database.types.ts. Victory currently sets health_savings_combo=true.';
