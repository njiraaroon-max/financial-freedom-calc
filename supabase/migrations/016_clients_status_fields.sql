-- ============================================================
-- Migration 016 — Client status (manual toggle, free-form note)
-- ============================================================
-- Phase 1 replacement for the v0 pipeline state machine. Each FA
-- manually marks their client's current state from a fixed list
-- of seven values, optionally with a free-form note.
--
-- Why manual instead of automated:
--   * Front-end of every planning module is still moving in Phase 1.
--     If we tied status transitions to module completeness we'd
--     constantly chase the auto-bumping logic.
--   * FAs already think in these labels in their head — surfacing
--     a manual toggle gives them visibility without forcing them
--     into a rigid funnel.
--   * In Phase 2 we may add an automated pipeline on TOP of this
--     column (a `pipeline_stage` derived from completeness rules),
--     keeping `current_status` as the FA's intent vs. a system view.
--
-- Status values (locked 2026-05-07):
--   appointment   — นัดทำแผน
--   fact_finding  — เก็บข้อมูลเรียบร้อย (Fact Finding)
--   proposed      — นำเสนอแผน
--   done          — Done
--   follow        — Follow
--   deny          — Deny
--   other         — Other (use status_note for the actual label)
--
-- last_activity_at is the catch-all "anything happened recently"
-- timestamp powering the dashboard's "ใครยังกำลัง update อยู่บ้าง"
-- panel. Refreshed every time the FA writes any client-related
-- record (status change, plan_data update, cashflow edit, …) —
-- handled by application code, not a trigger here, so we can keep
-- it cheap.
-- ============================================================

alter table public.clients
  add column if not exists current_status text not null default 'appointment'
    check (current_status in (
      'appointment',
      'fact_finding',
      'proposed',
      'done',
      'follow',
      'deny',
      'other'
    )),
  add column if not exists status_note text,
  add column if not exists status_updated_at timestamptz not null default now(),
  add column if not exists last_activity_at timestamptz not null default now();

-- Useful for the dashboard "by status" cards and the client list
-- "filter by status" dropdown.
create index if not exists clients_fa_user_status_idx
  on public.clients(fa_user_id, current_status);

-- Useful for the "recent activity" panel + the "who hasn't logged
-- anything in 30 days" coaching surface (Phase 2 but column is
-- already there).
create index if not exists clients_last_activity_idx
  on public.clients(last_activity_at desc);

-- Auto-bump status_updated_at when current_status changes. We do
-- NOT bump it when only status_note changes — the timestamp tracks
-- "moved between buckets" only.
create or replace function public.tg_clients_status_changed()
returns trigger
language plpgsql
as $$
begin
  if new.current_status is distinct from old.current_status then
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists clients_status_changed on public.clients;
create trigger clients_status_changed
  before update on public.clients
  for each row execute function public.tg_clients_status_changed();

comment on column public.clients.current_status is
  'Manually-toggled state of the FA-client relationship. One of '
  'appointment | fact_finding | proposed | done | follow | deny | other.';

comment on column public.clients.status_note is
  'Free-form note about the current status. Required spirit (not '
  'enforced) when current_status = ''other''.';

comment on column public.clients.last_activity_at is
  'Updated by application code on any meaningful write to this '
  'client''s plan/cashflow/insurance/etc. data.';
