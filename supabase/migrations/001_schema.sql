-- ============================================================
-- Migration 001 — Schema
-- Financial Friend Calculator — multi-tenant FA / CFP tool
-- ============================================================
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Idempotent: safe to re-run (uses IF NOT EXISTS + CREATE OR REPLACE)
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "pgcrypto";   -- gen_random_uuid()


-- ── fa_profiles ──────────────────────────────────────────────
-- FA (financial advisor) metadata. Row per auth.users entry.
-- Populated automatically by the on-signup trigger (see 003).
create table if not exists public.fa_profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  license_no    text,           -- เลขใบอนุญาต IC / CFP
  company       text,
  phone         text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.fa_profiles is
  'Financial Advisor profile. 1:1 with auth.users.';


-- ── clients ──────────────────────────────────────────────────
-- A "client" = end-consumer the FA is planning for.
-- Clients do NOT have their own auth account; they are records
-- owned by an FA. Profile data (name, salary, etc.) lives here
-- to avoid a separate profile table per client.
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  fa_user_id    uuid not null references auth.users(id) on delete cascade,

  -- Basic info
  name          text not null,
  nickname      text,
  birth_date    date,
  gender        text,             -- 'male' | 'female' | 'other'
  phone         text,
  email         text,
  photo_url     text,

  -- Profile (mirrors profile-store)
  occupation    text,             -- 'private' | 'government' | 'freelance'
  marital_status text,            -- 'single' | 'married' | 'married_with_children'
  salary        numeric,
  num_children  int default 0,

  -- Plan lifecycle
  status        text not null default 'active',   -- 'active' | 'archived'
  last_reviewed_at timestamptz,
  notes         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists clients_fa_user_id_idx
  on public.clients(fa_user_id);
create index if not exists clients_fa_user_id_status_idx
  on public.clients(fa_user_id, status);

comment on table public.clients is
  'End-consumer records owned by an FA. No auth account.';


-- ── cashflow_items ───────────────────────────────────────────
-- Relational — 1 row per income/expense item. Query-friendly
-- (sum by category, filter by essential, etc.).
create table if not exists public.cashflow_items (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id) on delete cascade,

  kind              text not null check (kind in ('income', 'expense')),
  name              text not null,
  amounts           numeric[] not null default '{0,0,0,0,0,0,0,0,0,0,0,0}',  -- [12] months
  constraint cashflow_items_amounts_len check (array_length(amounts, 1) = 12),

  -- Income-specific
  tax_category      text,        -- '40(1)'..'40(8)' | 'exempt' | null
  salary_percent    numeric,     -- for salary-linked items (PVD %)

  -- Expense-specific
  expense_category  text,        -- 'fixed' | 'variable' | 'investment' | null
  is_essential      boolean not null default false,
  is_debt_repayment text,        -- 'debt' | 'non_debt' | null

  -- Timing
  is_recurring      boolean not null default true,
  start_month       int,         -- 0..11 (for non-recurring)
  end_month         int,         -- 0..11

  sort_order        int not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists cashflow_items_client_id_idx
  on public.cashflow_items(client_id);
create index if not exists cashflow_items_client_kind_idx
  on public.cashflow_items(client_id, kind);

comment on table public.cashflow_items is
  'Monthly income/expense rows. One row per item per client.';


-- ── plan_data ────────────────────────────────────────────────
-- JSONB blob storage for everything *else*. Schema here still
-- changes often (retirement, insurance, education, goals, tax),
-- so JSONB lets us evolve Zustand stores without DB migrations.
--
-- Keyed by (client_id, domain). Domains:
--   'retirement' | 'insurance' | 'education' | 'goals'
--   | 'balance_sheet' | 'tax' | 'variables'
create table if not exists public.plan_data (
  client_id   uuid not null references public.clients(id) on delete cascade,
  domain      text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (client_id, domain)
);

create index if not exists plan_data_client_id_idx
  on public.plan_data(client_id);

comment on table public.plan_data is
  'JSONB storage for non-cashflow plan domains (retirement, insurance, etc.).';


-- ── updated_at triggers ──────────────────────────────────────
-- Auto-bump updated_at on every row update.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists fa_profiles_set_updated_at on public.fa_profiles;
create trigger fa_profiles_set_updated_at
  before update on public.fa_profiles
  for each row execute function public.tg_set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.tg_set_updated_at();

drop trigger if exists cashflow_items_set_updated_at on public.cashflow_items;
create trigger cashflow_items_set_updated_at
  before update on public.cashflow_items
  for each row execute function public.tg_set_updated_at();

drop trigger if exists plan_data_set_updated_at on public.plan_data;
create trigger plan_data_set_updated_at
  before update on public.plan_data
  for each row execute function public.tg_set_updated_at();
