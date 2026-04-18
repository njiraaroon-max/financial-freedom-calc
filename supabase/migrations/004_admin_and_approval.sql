-- ============================================================
-- Migration 004 — Admin role + signup approval flow
-- ============================================================
-- Adds two columns to fa_profiles:
--   role    — 'fa' (default) | 'admin'
--   status  — 'pending' (default) | 'approved' | 'rejected'
--
-- New signups land as status='pending' so an admin has to approve
-- before they can use the app. The existing middleware redirects
-- pending/rejected users to /pending-approval.
--
-- Admin RLS policies let a user with role='admin' read ALL fa_profiles
-- and UPDATE status/role on any row. Admins also get read-only SELECT
-- on clients (to count clients per FA in the dashboard).
--
-- Bootstrap (after running this migration):
--   update public.fa_profiles
--      set role = 'admin', status = 'approved'
--    where email = 'YOUR@EMAIL.COM';
-- ============================================================

-- ── Add columns (idempotent) ─────────────────────────────────
alter table public.fa_profiles
  add column if not exists role text not null default 'fa'
    check (role in ('fa', 'admin'));

alter table public.fa_profiles
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected'));

-- Back-fill any pre-existing rows as approved so the app doesn't lock
-- out users that signed up before this migration.
update public.fa_profiles
   set status = 'approved'
 where status = 'pending'
   and created_at < now() - interval '1 minute';


-- ── Helper: is_admin() — avoid recursive RLS checks ──────────
-- Using security definer + a direct lookup sidesteps the "policy
-- references same table" dance. Safe because the function only
-- returns a boolean for the CURRENT auth.uid().
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.fa_profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;


-- ── Admin RLS on fa_profiles ─────────────────────────────────
drop policy if exists "fa_profiles_admin_select" on public.fa_profiles;
create policy "fa_profiles_admin_select"
  on public.fa_profiles for select
  using (public.is_admin());

drop policy if exists "fa_profiles_admin_update" on public.fa_profiles;
create policy "fa_profiles_admin_update"
  on public.fa_profiles for update
  using (public.is_admin())
  with check (public.is_admin());


-- ── Admin RLS on clients (read-only for dashboard) ───────────
drop policy if exists "clients_admin_select" on public.clients;
create policy "clients_admin_select"
  on public.clients for select
  using (public.is_admin());


-- ── Prevent FAs from self-promoting ──────────────────────────
-- RLS alone can't easily express "user can update ALL their own
-- fields EXCEPT role/status" — a BEFORE UPDATE trigger is the
-- cleanest way. If a non-admin tries to change role or status on
-- any fa_profiles row (including their own), we raise.
create or replace function public.protect_role_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip the check when running outside an auth context (auth.uid()
  -- is null). This lets DB owners promote the first admin via the
  -- Supabase SQL Editor without getting blocked by their own trigger.
  if auth.uid() is null then
    return new;
  end if;

  if (
    old.role is distinct from new.role
    or old.status is distinct from new.status
  ) and not public.is_admin() then
    raise exception 'role/status can only be modified by an admin';
  end if;
  return new;
end;
$$;

drop trigger if exists fa_profiles_protect_role_status on public.fa_profiles;
create trigger fa_profiles_protect_role_status
  before update on public.fa_profiles
  for each row execute function public.protect_role_status();
