-- ============================================================
-- Migration 020 — SECURITY DEFINER RPCs for cross-FA reads
-- ============================================================
-- Phase 1 strict-owner RLS (migration 019) keeps fa_profiles + clients
-- private to the owner — fast and safe, but it blocks three legitimate
-- cross-FA reads we need for the new tier features:
--
--   1. /inbox/invitations — show the inviter's name, not just their
--      fa_code. The inviter is on a different fa_profiles row that
--      the invitee can't normally see.
--   2. /team page — show each team member's client count and last
--      activity. The clients sit on rows owned by other FAs.
--   3. Pro / Ultra /dashboard — rollup totals across the whole team
--      tree, again touching other FAs' clients.
--
-- We solve all three with SECURITY DEFINER functions that:
--   * run with elevated privileges (bypass RLS)
--   * BUT enforce the visibility check explicitly inside the
--     function body using fa_can_view_data_of() — same predicate
--     we'd use if we kept hierarchical RLS, just evaluated once
--     per call instead of once per row.
--
-- This is the right Postgres pattern for "hierarchical reads with
-- bounded scope". The recursive CTE inside fa_can_view_data_of()
-- (rewritten in migration 019 to walk UP from the target) runs at
-- most TIER_DEPTH steps regardless of org size, so calls stay fast.
--
-- All functions:
--   * are STABLE so the planner can cache within a query
--   * return only the public-safe subset of columns (display_name,
--     email, fa_code, tier — never license numbers, phone, etc.)
--   * gracefully return empty result sets when the caller has no
--     visibility (no errors thrown — the UI can show empty states)
-- ============================================================


-- ── 1. fa_lookup_public(target_id) ────────────────────────────
-- Resolve a single FA's user_id to public-safe identity fields.
-- Used by /inbox/invitations to show the inviter's display_name.
-- Returns nothing when target is outside viewer's visibility scope.
create or replace function public.fa_lookup_public(
  target_id uuid
) returns table (
  user_id      uuid,
  display_name text,
  email        text,
  fa_code      text,
  tier         text
)
language sql stable security definer
set search_path = public
as $$
  select
    fp.user_id,
    fp.display_name,
    fp.email,
    fp.fa_code,
    fp.tier
  from public.fa_profiles fp
  where fp.user_id = target_id
    -- Visibility check: the caller must either BE the target, or
    -- have the target as a descendant in their tree, OR be the
    -- target's team_lead (so an invitee can see their inviter when
    -- the inviter is one tier above them on the same chain).
    and (
      fp.user_id = auth.uid()
      or public.fa_can_view_data_of(auth.uid(), fp.user_id)
      or public.fa_can_view_data_of(fp.user_id, auth.uid())
    );
$$;

comment on function public.fa_lookup_public(uuid) is
  'Public-safe FA lookup: returns display_name + email + fa_code + tier '
  'for an FA that is visible to the caller (self, ancestor in chain, '
  'or descendant). Used to show inviter names in /inbox/invitations.';


-- ── 2. fa_lookup_by_code(code) ────────────────────────────────
-- Same as above but keyed by fa_code. Used by /team's invite form
-- to "preview" a code before sending — confirms the FA exists and
-- shows their name so the inviter doesn't typo into the void.
create or replace function public.fa_lookup_by_code(
  code text
) returns table (
  user_id      uuid,
  display_name text,
  email        text,
  fa_code      text,
  tier         text
)
language sql stable security definer
set search_path = public
as $$
  select
    fp.user_id,
    fp.display_name,
    fp.email,
    fp.fa_code,
    fp.tier
  from public.fa_profiles fp
  where fp.fa_code = upper(trim(code))
    -- Phase 1: any authenticated FA can resolve any fa_code. This
    -- is intentional — the code is a public-by-design handle, like
    -- a username, and an inviter needs to look up codes they don't
    -- have a relationship with yet. We return only the public-safe
    -- subset so this isn't an info leak.
    and auth.uid() is not null;
$$;

comment on function public.fa_lookup_by_code(text) is
  'Resolve a fa_code (case-insensitive) to public-safe FA identity. '
  'Any authenticated user may look up any code — safe because we only '
  'return display_name, email, fa_code, tier (not phone/license).';


-- ── 3. team_members_with_counts() ─────────────────────────────
-- Direct subordinates of the caller, plus their client counts and
-- last activity timestamp. Powers /team's "My Team Members" panel.
create or replace function public.team_members_with_counts()
returns table (
  user_id          uuid,
  display_name     text,
  email            text,
  fa_code          text,
  tier             text,
  client_count     bigint,
  last_activity_at timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select
    fp.user_id,
    fp.display_name,
    fp.email,
    fp.fa_code,
    fp.tier,
    coalesce(c.cnt, 0)::bigint as client_count,
    c.last_activity_at
  from public.fa_profiles fp
  left join lateral (
    select
      count(*) as cnt,
      max(last_activity_at) as last_activity_at
    from public.clients
    where fa_user_id = fp.user_id
      and status = 'active'
  ) c on true
  where fp.team_lead_id = auth.uid();
$$;

comment on function public.team_members_with_counts() is
  'Direct subordinates of the caller (team_lead_id = auth.uid()) with '
  'their client counts and last activity timestamp. Used by /team.';


-- ── 4. team_client_stats() ────────────────────────────────────
-- Aggregate counts by current_status for every client owned by an
-- FA in the caller's tree (own + transitive subordinates). Powers
-- the Pro / Ultra dashboard rollup.
create or replace function public.team_client_stats()
returns table (
  current_status text,
  count          bigint
)
language sql stable security definer
set search_path = public
as $$
  with recursive descendants(id) as (
    -- Start with the caller themselves, walk DOWN through anyone
    -- whose team_lead is in the set so far. This direction is
    -- expensive vs. fa_can_view_data_of's UP walk, BUT this query
    -- runs only ONCE per dashboard render, not per row, so the
    -- cost is bounded by tree size.
    select auth.uid()
    union all
    select fp.user_id
    from public.fa_profiles fp
    join descendants d on fp.team_lead_id = d.id
  )
  select
    c.current_status,
    count(*)::bigint as count
  from public.clients c
  where c.fa_user_id in (select id from descendants)
    and c.status = 'active'
  group by c.current_status;
$$;

comment on function public.team_client_stats() is
  'Per-status client counts across the caller''s entire tree (own + '
  'transitive subordinates). Returns one row per status that has '
  'at least one client; UI fills the rest with zeros.';


-- ── 5. team_total_counts() ────────────────────────────────────
-- Convenience companion to team_client_stats: returns one-row
-- summary with totals for the dashboard's KPI cards.
create or replace function public.team_total_counts()
returns table (
  total_clients bigint,
  total_pros    bigint,
  total_basics  bigint
)
language sql stable security definer
set search_path = public
as $$
  with recursive descendants(id, tier) as (
    select fp.user_id, fp.tier
    from public.fa_profiles fp
    where fp.user_id = auth.uid()
    union all
    select fp.user_id, fp.tier
    from public.fa_profiles fp
    join descendants d on fp.team_lead_id = d.id
  )
  select
    (select count(*)::bigint
       from public.clients c
       where c.fa_user_id in (select id from descendants)
         and c.status = 'active') as total_clients,
    (select count(*)::bigint
       from descendants
       where tier = 'pro' and id <> auth.uid()) as total_pros,
    (select count(*)::bigint
       from descendants
       where tier = 'basic') as total_basics;
$$;

comment on function public.team_total_counts() is
  'Grand totals for the caller''s tree: clients, pros under, basics '
  'under. The caller themselves is NOT counted in total_pros (they '
  'might be Pro but they''re the root of the rollup), but their own '
  'clients ARE in total_clients.';


-- ============================================================
-- Grants
-- ============================================================
-- Functions need EXECUTE granted to authenticated users (Postgres
-- requires this even for SECURITY DEFINER) so PostgREST exposes
-- them via /rest/v1/rpc/<name>.

grant execute on function public.fa_lookup_public(uuid) to authenticated;
grant execute on function public.fa_lookup_by_code(text) to authenticated;
grant execute on function public.team_members_with_counts() to authenticated;
grant execute on function public.team_client_stats() to authenticated;
grant execute on function public.team_total_counts() to authenticated;
