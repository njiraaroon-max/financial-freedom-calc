-- ============================================================
-- Migration 019 — RLS hotfix: revert hierarchical SELECT, keep
-- function for /team work in week 3
-- ============================================================
-- Migration 018 wired hierarchical visibility into the SELECT
-- policies on fa_profiles, clients, cashflow_items, plan_data using
-- a recursive-CTE function. In production this caused statement
-- timeouts because Postgres re-evaluated the CTE per row, walking
-- the entire descendant subtree of the viewer for every row check.
--
-- This is fine in theory but blew up in practice on the /admin
-- page (which fetches all fa_profiles) and would have hit the same
-- wall on /clients once we wire it up.
--
-- Two-part fix:
--
-- 1. **Rewrite fa_can_view_data_of() to walk UP from the target**
--    instead of DOWN from the viewer. Max 2 hops in our 3-tier
--    model (Basic → Pro → Ultra), regardless of how big the org is.
--    This is the version we should have shipped originally.
--
-- 2. **Revert the per-table SELECT policies to strict-owner**.
--    Phase 1 week 2 only needs owners reading their own data;
--    /team and team-visibility queries arrive in week 3 and will
--    use a SECURITY DEFINER RPC instead of broad RLS, which is
--    safer and faster.
--
-- The function stays in the schema so week 3 can call it in the
-- new RPC. Just nothing depends on it right now.
-- ============================================================

-- ── 1. Rewrite the function (walk UP instead of DOWN) ─────────
create or replace function public.fa_can_view_data_of(
  viewer_id    uuid,
  target_fa_id uuid
) returns boolean
language sql stable security invoker as $$
  -- Fast path: viewer is the target — true without recursion.
  -- Slow path: walk ancestor chain from target up through team_lead_id;
  -- if we ever hit viewer_id, target is a descendant of viewer.
  -- Depth is bounded by the tier hierarchy (Basic → Pro → Ultra), so
  -- this terminates in <=2 iterations no matter how big the org tree.
  with recursive ancestors(id) as (
    select target_fa_id
    union all
    select fp.team_lead_id
    from public.fa_profiles fp
    join ancestors a on fp.user_id = a.id
    where fp.team_lead_id is not null
  )
  select exists (select 1 from ancestors where id = viewer_id);
$$;

comment on function public.fa_can_view_data_of(uuid, uuid) is
  'True when viewer_id is target_fa_id, or target_fa_id is a transitive '
  'subordinate of viewer_id via team_lead_id. Walks ancestor chain '
  'upward from target — bounded by hierarchy depth.';

-- ── 2. Revert SELECT policies to strict-owner ─────────────────
-- fa_profiles
drop policy if exists "fa_profiles_visible_select" on public.fa_profiles;
drop policy if exists "fa_profiles_own_select" on public.fa_profiles;
create policy "fa_profiles_own_select"
  on public.fa_profiles for select
  using (user_id = auth.uid());

-- clients
drop policy if exists "clients_visible_select" on public.clients;
drop policy if exists "clients_owner_insert" on public.clients;
drop policy if exists "clients_owner_update" on public.clients;
drop policy if exists "clients_owner_delete" on public.clients;
drop policy if exists "clients_own_all" on public.clients;
create policy "clients_own_all"
  on public.clients for all
  using (fa_user_id = auth.uid())
  with check (fa_user_id = auth.uid());

-- cashflow_items
drop policy if exists "cashflow_items_visible_select" on public.cashflow_items;
drop policy if exists "cashflow_items_owner_modify" on public.cashflow_items;
drop policy if exists "cashflow_items_own_all" on public.cashflow_items;
create policy "cashflow_items_own_all"
  on public.cashflow_items for all
  using (
    exists (
      select 1 from public.clients c
      where c.id = cashflow_items.client_id
        and c.fa_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      where c.id = cashflow_items.client_id
        and c.fa_user_id = auth.uid()
    )
  );

-- plan_data
drop policy if exists "plan_data_visible_select" on public.plan_data;
drop policy if exists "plan_data_owner_modify" on public.plan_data;
drop policy if exists "plan_data_own_all" on public.plan_data;
create policy "plan_data_own_all"
  on public.plan_data for all
  using (
    exists (
      select 1 from public.clients c
      where c.id = plan_data.client_id
        and c.fa_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      where c.id = plan_data.client_id
        and c.fa_user_id = auth.uid()
    )
  );

-- fa_team_invitations policies stay as defined in 018 — they only
-- check inviter_id/invitee_id against auth.uid(), no recursion.

-- ============================================================
-- What week 3 will do for team visibility:
--
-- Add a SECURITY DEFINER RPC, e.g.:
--
--   create function public.list_visible_clients()
--   returns setof public.clients
--   language sql stable security definer as $$
--     select c.* from public.clients c
--     where public.fa_can_view_data_of(auth.uid(), c.fa_user_id);
--   $$;
--
-- The function runs with elevated privileges (bypasses RLS) but
-- enforces the visibility check explicitly via fa_can_view_data_of.
-- Cheaper because the descendant lookup happens once per call,
-- not per row.
-- ============================================================
