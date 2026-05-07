-- ============================================================
-- Migration 017 — FA team invitations (A2 self-service flow)
-- ============================================================
-- A Pro types a Basic's fa_code → row inserted here in 'pending'.
-- The Basic logs in, sees the invitation in /inbox/invitations,
-- accepts (status='accepted' + team_lead_id set on their fa_profile)
-- or rejects (status='rejected', no team change).
--
-- An Ultra invites a Pro the same way.
--
-- Tier validation:
--   inviter must be tier='pro' or tier='ultra'
--   invitee tier must be exactly 1 below inviter:
--     Pro invites Basic, Ultra invites Pro
--   This is checked by the application layer at INVITE time AND
--   re-checked at ACCEPT time so a tier change during the 7-day
--   window can't sneak through.
--
-- Lifecycle:
--   pending  — newly created, awaiting invitee response
--   accepted — invitee accepted; their team_lead_id is now set to
--              the inviter
--   rejected — invitee declined
--   expired  — exceeded expires_at (7 days default); a nightly
--              cleanup job (or the next pending-list query) marks
--              these
--   cancelled — inviter rescinded before the invitee responded
--
-- Re-inviting:
--   If a previous invitation between the same inviter+invitee was
--   rejected/expired/cancelled, a new pending row may be created.
--   Two pending rows for the same pair are blocked by a partial
--   unique index.
-- ============================================================

create table if not exists public.fa_team_invitations (
  id              uuid primary key default gen_random_uuid(),

  inviter_id      uuid not null references auth.users(id) on delete cascade,
  -- The FA who created the invite. Their tier (pro|ultra) decides
  -- which invitee tier is valid; checked in app code.

  invitee_fa_code text not null,
  -- The fa_code typed by the inviter. Stored verbatim so we can
  -- show "you invited V8K3M2P" even if the invitee's fa_code is
  -- somehow rotated later (shouldn't happen — fa_code is stable).

  invitee_id      uuid references auth.users(id) on delete cascade,
  -- Resolved by the application when the inviter creates the row
  -- (we look up the fa_code → user_id). Nullable in case the code
  -- doesn't match any FA (we still record the attempt for audit).

  status          text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),

  message         text,
  -- Optional note from inviter shown to invitee (e.g. "Hi, I'm leading
  -- the Sukhumvit team — would love to have you join.")

  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  expires_at      timestamptz not null default (now() + interval '7 days')
);

-- Block duplicate pending invites between the same pair.
-- Uses a partial unique index because we want multiple pending
-- invites from the SAME inviter to DIFFERENT invitees (and the
-- reverse), but never two pending entries for one (inviter,invitee).
create unique index if not exists fa_team_invitations_unique_pending
  on public.fa_team_invitations(inviter_id, invitee_id)
  where status = 'pending';

-- Lookups used by /inbox/invitations (per-invitee pending list)
create index if not exists fa_team_invitations_invitee_pending_idx
  on public.fa_team_invitations(invitee_id, created_at desc)
  where status = 'pending';

-- Lookups used by /team (per-inviter outgoing list)
create index if not exists fa_team_invitations_inviter_idx
  on public.fa_team_invitations(inviter_id, created_at desc);

-- Stamp responded_at automatically whenever status leaves 'pending'.
create or replace function public.tg_invitations_stamp_responded()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'pending' and new.status <> 'pending' then
    new.responded_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists fa_team_invitations_stamp_responded
  on public.fa_team_invitations;
create trigger fa_team_invitations_stamp_responded
  before update on public.fa_team_invitations
  for each row execute function public.tg_invitations_stamp_responded();

comment on table public.fa_team_invitations is
  'Self-service team invitations. Pro→Basic and Ultra→Pro only. '
  'Acceptance writes team_lead_id on the invitee''s fa_profile.';

-- RLS policies for this table are added in 018 alongside the
-- general visibility rules.
