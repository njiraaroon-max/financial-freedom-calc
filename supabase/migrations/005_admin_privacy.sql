-- ============================================================
-- Migration 005 — Admin privacy: aggregate-only access to clients
-- ============================================================
-- Migration 004 let admin SELECT every row in `clients` so the
-- dashboard could count clients per FA. That leaks PII (client
-- names, salaries, etc.) from every FA to every admin.
--
-- This migration:
--   1. Drops the admin-read-all policy on clients
--   2. Adds a security-definer RPC `admin_fa_stats()` that
--      returns ONLY aggregates — counts + "% active in last 30d"
--      + last activity timestamp, keyed by fa_user_id
--
-- Admins still see their OWN clients via the existing
-- `clients_own_all` policy. They see aggregates of OTHER FAs via
-- the RPC. Raw rows from other FAs are inaccessible.
-- ============================================================

-- ── Remove the privacy-violating policy ──────────────────────
drop policy if exists "clients_admin_select" on public.clients;


-- ── Aggregate-only function ──────────────────────────────────
-- Returns one row per FA: user_id, #clients, #active (updated in
-- last 30 days), last_activity (max updated_at). We intentionally
-- DO NOT return any per-client fields.
create or replace function public.admin_fa_stats()
returns table (
  fa_user_id uuid,
  client_count bigint,
  active_count bigint,
  last_activity timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return query
  select
    c.fa_user_id,
    count(*)::bigint as client_count,
    count(*) filter (
      where c.updated_at > now() - interval '30 days'
    )::bigint as active_count,
    max(c.updated_at) as last_activity
  from public.clients c
  group by c.fa_user_id;
end;
$$;

revoke all on function public.admin_fa_stats() from public;
grant execute on function public.admin_fa_stats() to authenticated;


-- ── Plan data activity (optional bonus metric) ───────────────
-- How much of the FA's "plan work" has been updated recently.
-- Aggregate only — no blob contents exposed.
create or replace function public.admin_fa_plan_activity()
returns table (
  fa_user_id uuid,
  plan_row_count bigint,
  plan_last_update timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return query
  select
    c.fa_user_id,
    count(pd.*)::bigint as plan_row_count,
    max(pd.updated_at) as plan_last_update
  from public.clients c
  left join public.plan_data pd on pd.client_id = c.id
  group by c.fa_user_id;
end;
$$;

revoke all on function public.admin_fa_plan_activity() from public;
grant execute on function public.admin_fa_plan_activity() to authenticated;
