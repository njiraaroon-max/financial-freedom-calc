-- ============================================================
-- Migration 014 — Victory Insurance Tools (Pyramid sales mode)
-- ============================================================
-- Umbrella flag for the entire 5-layer Victory Sales Pyramid:
-- Emergency Fund / Life / Health / Saving (Annuity) / Wealth Legacy
-- + cross-cutting Tax + decision-helper combo tools.
--
-- When this flag is true AND planningMode === 'modular', HomePro
-- swaps the standard 5-tile modular grid for VictorySalesHome —
-- a scroll-through pyramid where each layer has its own 5-Act
-- sales journey (Hello → Verdict → Time Machine → Compare → Summary).
-- Comprehensive mode is unaffected.
--
-- Gating policy (matches health_savings_combo from migration 013):
--   * Other orgs (Financial Planner / Avenger Planner / future) →
--     flag absent (effectively false). Admin can grant per-FA via
--     /admin Features modal if a non-Victory FA needs preview.
--   * Victory → flag = true on org default_features so new signups
--     auto-receive it AND existing Victory FAs get back-filled.
--
-- This is the parent flag for the Pyramid UI shell. Individual
-- product-specific flags (e.g. health_savings_combo) remain
-- separately controllable so admins can mix-and-match.
-- ============================================================

-- ── 1. Set Victory's org default ─────────────────────────────
update public.organizations
   set default_features = default_features
                          || jsonb_build_object('victory_insurance_tools', true)
 where slug = 'victory';

-- ── 2. Back-fill existing Victory FA rows ────────────────────
-- Same pattern as migration 013: only set if the FA has no
-- explicit value yet (preserves admin overrides).
update public.fa_profiles f
   set features = features || jsonb_build_object('victory_insurance_tools', true)
  from public.organizations o
 where f.organization_id = o.id
   and o.slug = 'victory'
   and not (f.features ? 'victory_insurance_tools');
