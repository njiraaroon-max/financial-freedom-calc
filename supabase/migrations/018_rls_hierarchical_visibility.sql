-- ============================================================
-- Migration 018 — Hierarchical RLS (tier-based visibility)
-- ============================================================
-- Replaces the strict-owner SELECT policies from migration 002 with
-- hierarchy-aware ones: a Pro can read their team Basic's clients,
-- an Ultra can read everything in their org tree, etc.
--
-- WRITE policies stay strict-owner. Phase 1 explicitly does NOT let
-- a Pro modify a Basic's data — only read. (Phase 2 may add a
-- "review mode" where a lead can leave annotations without editing
-- the underlying record.)
--
-- The traversal direction matters:
--   "Can VIEWER see TARGET's data?" = is TARGET a descendant of VIEWER?
-- We start from VIEWER and walk DOWN through users where
-- team_lead_id = current_node, collecting everyone reachable.
-- TARGET is visible iff TARGET is in that set.
--
-- Performance:
--   - Indexed by team_lead_id (migration 015) so each step of the
--     CTE is an index scan
--   - For 200 FAs in 3 tiers the CTE expands to <=200 rows max,
--     evaluated once per (viewer, table) and then cached by Postgres
--     within the query — fast enough for Phase 1
--   - If we hit perf issues at scale we can swap the CTE for a
--     materialized closure table refreshed on team_lead_id change.
--
-- The clients SELECT policy is the most read-hot; we deliberately
-- inline the function call there but keep it as a function for
-- cashflow_items / plan_data so a future closure-table swap touches
-- only one place.
-- ============================================================

-- ── 1. The descendants helper function ────────────────────────
create or replace function public.fa_can_view_data_of(
  viewer_id    uuid,
  target_fa_id uuid
) returns boolean
language sql stable security invoker as $$
  with recursive descendants(id) as (
    -- Start at the viewer themselves
    select viewer_id
    union all
    -- Walk down: anyone whose team_lead is in the set so far
    select fp.user_id
    from public.fa_profiles fp
    join descendants d on fp.team_lead_id = d.id
  )
  select exists (
    select 1 from descendants where id = target_fa_id
  );
$$;

comment on function public.fa_can_view_data_of(uuid, uuid) is
  'True when viewer_id is target_fa_id, or target_fa_id is a '
  'transitive subordinate of viewer_id via team_lead_id chain. '
  'Drives hierarchical SELECT policies on owned-by-FA tables.';


-- ── 2. fa_profiles — viewer can see their tree's profiles ─────
-- Replace the strict-owner SELECT with hierarchical.
drop policy if exists "fa_profiles_own_select" on public.fa_profiles;
create policy "fa_profiles_visible_select"
  on public.fa_profiles for select
  using (public.fa_can_view_data_of(auth.uid(), user_id));

-- UPDATE / INSERT remain owner-only (same as 002, just kept here
-- for clarity since we touched the SELECT).
-- (002 already created _own_update and _own_insert; we don't redo them.)


-- ── 3. clients — hierarchical SELECT, owner-only WRITE ────────
drop policy if exists "clients_own_all" on public.clients;

create policy "clients_visible_select"
  on public.clients for select
  using (public.fa_can_view_data_of(auth.uid(), fa_user_id));

create policy "clients_owner_insert"
  on public.clients for insert
  with check (fa_user_id = auth.uid());

create policy "clients_owner_update"
  on public.clients for update
  using (fa_user_id = auth.uid())
  with check (fa_user_id = auth.uid());

create policy "clients_owner_delete"
  on public.clients for delete
  using (fa_user_id = auth.uid());


-- ── 4. cashflow_items — hierarchical SELECT via parent client ─
drop policy if exists "cashflow_items_own_all" on public.cashflow_items;

create policy "cashflow_items_visible_select"
  on public.cashflow_items for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = cashflow_items.client_id
        and public.fa_can_view_data_of(auth.uid(), c.fa_user_id)
    )
  );

create policy "cashflow_items_owner_modify"
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


-- ── 5. plan_data — same pattern as cashflow_items ─────────────
drop policy if exists "plan_data_own_all" on public.plan_data;

create policy "plan_data_visible_select"
  on public.plan_data for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = plan_data.client_id
        and public.fa_can_view_data_of(auth.uid(), c.fa_user_id)
    )
  );

create policy "plan_data_owner_modify"
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


-- ── 6. fa_team_invitations — RLS for the invite flow ──────────
alter table public.fa_team_invitations enable row level security;

-- Inviter can see their own outgoing invites (any status)
create policy "invitations_inviter_select"
  on public.fa_team_invitations for select
  using (inviter_id = auth.uid());

-- Invitee can see invitations addressed to them (resolved by code)
create policy "invitations_invitee_select"
  on public.fa_team_invitations for select
  using (invitee_id = auth.uid());

-- Inviter can create invitations
-- (App code validates tier compatibility before insert.)
create policy "invitations_inviter_insert"
  on public.fa_team_invitations for insert
  with check (inviter_id = auth.uid());

-- Inviter can cancel (UPDATE status='cancelled') their own
-- pending invites. Invitee can accept/reject. Both flows funnel
-- through a single UPDATE policy that checks the actor matches
-- one end of the row.
create policy "invitations_endpoint_update"
  on public.fa_team_invitations for update
  using (inviter_id = auth.uid() or invitee_id = auth.uid())
  with check (inviter_id = auth.uid() or invitee_id = auth.uid());

-- No DELETE — soft-cancel via status='cancelled' or status='expired'.
