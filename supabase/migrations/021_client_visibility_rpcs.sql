-- ============================================================
-- Migration 021 — Cross-FA client visibility RPCs (read-only)
-- ============================================================
-- Phase 1 strict-owner RLS only lets an FA query their own clients.
-- That blocks the Pro/Ultra read-only drill-in workflow:
--
--   PRO-1 sees from their dashboard: "Basics in team: 4 / 63 clients"
--         → wants to click into one of those 63 clients to see the plan
--         → /clients list won't show non-own rows, /clients/[id] 404s
--
-- This migration adds two SECURITY DEFINER functions that bypass RLS
-- safely (they enforce hierarchy via fa_can_view_data_of inside the
-- function body) and return a `can_edit` flag the UI uses to switch
-- to read-only mode for non-owner viewers.
--
-- WRITES still go through the existing strict-owner UPDATE/INSERT/
-- DELETE policies — these RPCs are read-only by definition. A Pro
-- looking at a Basic's client gets the data but cannot mutate it.
-- ============================================================


-- ── 1. get_client_for_viewer(client_id) ──────────────────────
-- One row + can_edit. Returns nothing if the caller has no
-- visibility on the client (UI then 404s).
create or replace function public.get_client_for_viewer(
  target_id uuid
) returns table (
  id                 uuid,
  fa_user_id         uuid,
  name               text,
  nickname           text,
  birth_date         date,
  gender             text,
  phone              text,
  email              text,
  photo_url          text,
  occupation         text,
  marital_status     text,
  salary             numeric,
  num_children       int,
  status             text,
  last_reviewed_at   timestamptz,
  notes              text,
  current_status     text,
  status_note        text,
  status_updated_at  timestamptz,
  last_activity_at   timestamptz,
  created_at         timestamptz,
  updated_at         timestamptz,
  can_edit           boolean,
  owner_display_name text,
  owner_fa_code      text
)
language sql stable security definer
set search_path = public
as $$
  select
    c.id,
    c.fa_user_id,
    c.name,
    c.nickname,
    c.birth_date,
    c.gender,
    c.phone,
    c.email,
    c.photo_url,
    c.occupation,
    c.marital_status,
    c.salary,
    c.num_children,
    c.status,
    c.last_reviewed_at,
    c.notes,
    c.current_status,
    c.status_note,
    c.status_updated_at,
    c.last_activity_at,
    c.created_at,
    c.updated_at,
    (c.fa_user_id = auth.uid()) as can_edit,
    fp.display_name as owner_display_name,
    fp.fa_code as owner_fa_code
  from public.clients c
  left join public.fa_profiles fp on fp.user_id = c.fa_user_id
  where c.id = target_id
    and (
      c.fa_user_id = auth.uid()
      or public.fa_can_view_data_of(auth.uid(), c.fa_user_id)
    );
$$;

comment on function public.get_client_for_viewer(uuid) is
  'Single client lookup with hierarchy-aware visibility + can_edit flag. '
  'Returns nothing if the caller has no visibility on the client. '
  'WRITES still gated by strict-owner RLS — can_edit is purely a UI hint.';


-- ── 2. list_visible_clients() ─────────────────────────────────
-- All clients the caller can see (own + transitive subordinates).
-- Sorted by last_activity_at desc so the dashboard "what's hot"
-- queries don't need an extra ORDER BY.
create or replace function public.list_visible_clients()
returns table (
  id                 uuid,
  fa_user_id         uuid,
  name               text,
  nickname           text,
  birth_date         date,
  gender             text,
  occupation         text,
  current_status     text,
  status_note        text,
  status_updated_at  timestamptz,
  last_activity_at   timestamptz,
  created_at         timestamptz,
  updated_at         timestamptz,
  can_edit           boolean,
  owner_display_name text,
  owner_fa_code      text
)
language sql stable security definer
set search_path = public
as $$
  -- Pre-compute the descendants set ONCE (vs per-row in fa_can_view_*)
  -- so this query stays fast even for an Ultra with hundreds of
  -- transitive subordinates.
  with recursive descendants(id) as (
    select auth.uid()
    union all
    select fp.user_id
    from public.fa_profiles fp
    join descendants d on fp.team_lead_id = d.id
  )
  select
    c.id,
    c.fa_user_id,
    c.name,
    c.nickname,
    c.birth_date,
    c.gender,
    c.occupation,
    c.current_status,
    c.status_note,
    c.status_updated_at,
    c.last_activity_at,
    c.created_at,
    c.updated_at,
    (c.fa_user_id = auth.uid()) as can_edit,
    fp.display_name as owner_display_name,
    fp.fa_code as owner_fa_code
  from public.clients c
  left join public.fa_profiles fp on fp.user_id = c.fa_user_id
  where c.status = 'active'
    and c.fa_user_id in (select id from descendants)
  order by c.last_activity_at desc nulls last;
$$;

comment on function public.list_visible_clients() is
  'All active clients the caller can see (own + transitive subordinates). '
  'Each row carries can_edit + owner identity so the /clients list can '
  'badge non-own rows and the detail page can switch to read-only.';


-- ── Grants ────────────────────────────────────────────────────
grant execute on function public.get_client_for_viewer(uuid) to authenticated;
grant execute on function public.list_visible_clients()      to authenticated;
