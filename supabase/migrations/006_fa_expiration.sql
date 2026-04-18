-- ============================================================
-- Migration 006 — FA account expiration
-- ============================================================
-- Adds an optional `expires_at` timestamp to fa_profiles. If set
-- and past, the middleware redirects the FA to /pending-approval
-- with an "expired" message. NULL = never expires.
--
-- Admins are intentionally exempt from the expiration check in
-- the middleware — otherwise a forgotten expires_at on an admin
-- could lock every FA and every admin out of the app. Admin rows
-- still CAN have expires_at (for display/billing purposes); the
-- middleware just doesn't enforce it for role='admin'.
-- ============================================================

alter table public.fa_profiles
  add column if not exists expires_at timestamptz null;

-- Only admin can set expires_at; protect it with the same trigger
-- that guards role/status so a FA can't extend themselves.
create or replace function public.protect_role_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip the check when running outside an auth context (auth.uid()
  -- is null). Lets DB owners promote admins / edit rows via the
  -- SQL Editor without being blocked.
  if auth.uid() is null then
    return new;
  end if;

  if (
    old.role is distinct from new.role
    or old.status is distinct from new.status
    or old.expires_at is distinct from new.expires_at
  ) and not public.is_admin() then
    raise exception 'role, status, or expires_at can only be modified by an admin';
  end if;
  return new;
end;
$$;
