-- ============================================================
-- Migration 002 — Row Level Security (RLS)
-- ============================================================
-- CRITICAL: these policies enforce tenant isolation. Without RLS,
-- any authenticated user could read/write any other user's data
-- via the public anon key.
--
-- Mental model:
--   auth.uid() = currently signed-in FA's user_id
--   A row is "mine" if:
--     - fa_profiles: user_id = auth.uid()
--     - clients: fa_user_id = auth.uid()
--     - cashflow_items / plan_data: the row's client belongs to me
-- ============================================================

-- ── Enable RLS on every table ────────────────────────────────
alter table public.fa_profiles    enable row level security;
alter table public.clients        enable row level security;
alter table public.cashflow_items enable row level security;
alter table public.plan_data      enable row level security;


-- ── fa_profiles ──────────────────────────────────────────────
-- FA can see/edit only their own profile.
drop policy if exists "fa_profiles_own_select" on public.fa_profiles;
create policy "fa_profiles_own_select"
  on public.fa_profiles for select
  using (user_id = auth.uid());

drop policy if exists "fa_profiles_own_update" on public.fa_profiles;
create policy "fa_profiles_own_update"
  on public.fa_profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- INSERT is handled by the trigger (runs with elevated privileges).
-- We still allow explicit insert in case the trigger is disabled.
drop policy if exists "fa_profiles_own_insert" on public.fa_profiles;
create policy "fa_profiles_own_insert"
  on public.fa_profiles for insert
  with check (user_id = auth.uid());


-- ── clients ──────────────────────────────────────────────────
-- FA can CRUD their own clients; cannot see other FAs' clients.
drop policy if exists "clients_own_all" on public.clients;
create policy "clients_own_all"
  on public.clients for all
  using (fa_user_id = auth.uid())
  with check (fa_user_id = auth.uid());


-- ── cashflow_items ───────────────────────────────────────────
-- Access via the parent client.
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


-- ── plan_data ────────────────────────────────────────────────
-- Same shape as cashflow_items.
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
