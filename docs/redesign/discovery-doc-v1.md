# WealthPlanner Restructure — Discovery Doc v1 (LOCKED)

> **Status:** v1 — locked architecture, ready for wireframing + migrations
> **Author:** Nutt Jiraaroon + Claude (paired)
> **Date:** 2026-05-07
> **Target launch:** ~2026-06-15 (5-6 weeks from start, vs original 8-week plan)
> **v0 reference:** [discovery-doc-v0.md](./discovery-doc-v0.md) — superseded
>
> **Major delta from v0:** scope reduced significantly. Single workspace
> instead of three. Pipeline / Plan Quality / Client Portal / AI Insights
> all deferred to Phase 2. 3-tier FA hierarchy (Basic / Pro / Ultra)
> replaces the AVP/AL/Agent model. Self-service team invitations replace
> Super-Admin-only assignments.

---

## 0. Why this doc exists (and why v1 is leaner than v0)

After a full review with the product owner, we deferred the following from
Phase 1 to Phase 2:

- **Client Portal** — front-end design + the "should clients self-register?"
  question are still open. Building it now risks the wrong UX.
- **Pipeline state machine** — too tightly coupled to client data fields
  that themselves are still moving. Replaced with a **manual status
  toggle** the FA ticks on each client.
- **Plan Quality scoring** — depends on planning modules that may still
  evolve. Adds churn risk if rules change.
- **AI Insights** — feature is FA-only when it lands, so safe to ship after
  the core is stable.

Net effect: **scope dropped ~50%, timeline shrinks from 8 weeks to ~5-6
weeks**, and the Victory launch may need only a small delay (mid-June)
rather than the original July 8 target.

---

## 1. Architecture Overview

### 1.1 ONE workspace — three FA tiers see different data

Instead of three separate workspaces (Client / Planner / Team) we render
**one shared front-end shell** ("Manage Clients") that adapts based on the
viewer's tier:

```
                ┌──────────────────────────────┐
                │   wealthplanner.finance      │
                │   (single Next.js app)       │
                └──────────────┬───────────────┘
                               │
                               ▼
              ┌─────────────────────────────┐
              │  /  → role-aware redirect   │
              │     /dashboard              │
              │     /clients                │
              │     /clients/[id]           │
              │     /clients/[id]/[module]  │
              │     /quick-plan (public)    │
              │     /team (Pro+Ultra only)  │
              └──┬──────────────┬──────────┬┘
                 ▼              ▼          ▼
          ┌──────────┐   ┌──────────┐   ┌──────────┐
          │ Basic    │   │ Pro      │   │ Ultra    │
          │ — Own    │   │ — Own +  │   │ — Own +  │
          │   only   │   │   team   │   │   Pros   │
          │          │   │          │   │   + tree │
          └──────────┘   └──────────┘   └──────────┘
```

The Same UI, Different Data principle:

- Same `/clients` page → Basic sees 5 clients, Pro sees 50 (own + team), Ultra
  sees 500 (own + Pros + Pros' Basics)
- Same `/dashboard` page → KPIs scoped to what each tier can see
- New `/team` page → only visible to Pro + Ultra

### 1.2 Three FA tiers + Super Admin

| Tier         | Sees Own Clients | Sees Team Clients | Can Add Team Members | Notes |
|--------------|:----------------:|:-----------------:|:--------------------:|-------|
| **Basic**    | ✅              | —                 | —                    | Default tier; the agent in the field |
| **Pro**      | ✅              | ✅ (own team only) | ✅ adds Basics       | Team lead — small org around them |
| **Ultra**    | ✅              | ✅ (own + Pros' teams transitively) | ✅ adds Pros | Regional / divisional lead |
| **Super Admin** | (system) | (system) | (system) | Promotes tier, resolves disputes |

**Important:** every FA can have their own personal clients regardless of
tier. Pros and Ultras don't stop being practitioners just because they
manage a team.

### 1.3 Role-aware home redirect

`/` route:
- Anonymous → `/login`
- Logged-in Basic → `/dashboard` (own KPIs)
- Logged-in Pro → `/dashboard` (own + team KPIs)
- Logged-in Ultra → `/dashboard` (own + Pros' teams KPIs)
- Logged-in Super Admin → `/admin` (existing admin UI)

### 1.4 URL routing scheme (final)

```
/                           role-aware redirect
/login, /signup, /forgot-password, /auth/*    auth flows (existing)
/quick-plan                 PUBLIC — kept as lead-gen
/dashboard                  tier-aware dashboard
/clients                    tier-aware client list
/clients/new                add new client manually
/clients/[id]               Client Detail (tabs: Overview, Modules, Status, Notes, Reports)
/clients/[id]/[module]      Per-module deep view (cashflow, balance, retirement, tax, insurance, education, goals)
/team                       Pro+Ultra only — team list + invitation UI
/team/invitations           Pro+Ultra: outgoing invites (pending/accepted/rejected)
/inbox/invitations          ANY FA: incoming team invitations to accept/reject
/profile/account            existing — show fa_code prominently
/admin/*                    existing — Super Admin only
/report/[id]                generated PDF report viewer
```

### 1.5 Layout shell

ONE shared layout (`/app/(authed)/layout.tsx`) wrapping all authenticated
pages:
- Top bar: logo, search, user menu
- Left sidebar: nav items (filtered by tier — `/team` hidden for Basic)
- Main area: page content
- Conditional `/quick-plan` and `/admin` use their own layouts (already exist)

---

## 2. Data Model (Phase 1 only)

### 2.1 Existing tables — changes

```sql
-- Add tier + team-lead pointer to fa_profiles
alter table public.fa_profiles
  add column if not exists tier text not null default 'basic'
    check (tier in ('basic', 'pro', 'ultra')),
  add column if not exists fa_code text unique,    -- shareable code, e.g. 'V8K3M2P'
  add column if not exists team_lead_id uuid references auth.users(id);
-- team_lead_id: Basic's lead is a Pro, Pro's lead is an Ultra,
--               Ultra's lead is null (or a Super Admin).

create index if not exists fa_profiles_team_lead_idx
  on public.fa_profiles(team_lead_id);

-- Backfill: generate fa_code for existing FAs
update public.fa_profiles
  set fa_code = 'V' || substr(md5(user_id::text), 1, 6)
  where fa_code is null;

-- Add status fields to clients
alter table public.clients
  add column if not exists current_status text not null default 'appointment'
    check (current_status in (
      'appointment',    -- นัดทำแผน
      'fact_finding',   -- เก็บข้อมูลเรียบร้อย
      'proposed',       -- นำเสนอแผน
      'done',           -- Done
      'follow',         -- Follow
      'deny',           -- Deny
      'other'           -- Other (with free-form note)
    )),
  add column if not exists status_note text,
  add column if not exists status_updated_at timestamptz default now(),
  add column if not exists last_activity_at timestamptz default now();
```

### 2.2 New tables

```sql
-- Team invitations (A2 self-service flow)
create table public.fa_team_invitations (
  id              uuid primary key default gen_random_uuid(),
  inviter_id      uuid not null references auth.users(id),
  invitee_fa_code text not null,                      -- code typed by inviter
  invitee_id      uuid references auth.users(id),     -- resolved on first read
  status          text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
  message         text,                                -- optional note
  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  expires_at      timestamptz not null default (now() + interval '7 days')
);

create index fa_team_invitations_invitee_pending_idx
  on public.fa_team_invitations(invitee_id, status)
  where status = 'pending';

create index fa_team_invitations_inviter_idx
  on public.fa_team_invitations(inviter_id, created_at desc);
```

> **Note:** we use both `team_lead_id` (single FK) for fast read RLS and
> `fa_team_invitations` for the invite flow. After an invite is accepted,
> the invitee's `team_lead_id` is set to the inviter. We don't need a
> many-to-many junction table because each FA has exactly one lead.

### 2.3 RLS — visibility via tier + team_lead chain

The recursive function from v0 still applies but now follows `team_lead_id`:

```sql
create or replace function public.fa_can_view_data_of(
  viewer_id uuid, target_fa_id uuid
) returns boolean
language sql stable as $$
  with recursive descendants(id) as (
    select viewer_id
    union all
    select fp.user_id
    from public.fa_profiles fp
    join descendants d on fp.team_lead_id = d.id
  )
  select exists (select 1 from descendants where id = target_fa_id);
$$;
```

This returns true when:
- viewer == target (own data)
- target is a direct subordinate (Pro viewing their Basic)
- target is a transitive subordinate (Ultra viewing their Pro's Basics)

Update RLS on every table that has FA-owned data:

```sql
drop policy if exists "clients_visible_select" on public.clients;
create policy "clients_visible_select" on public.clients
  for select using (
    public.fa_can_view_data_of(auth.uid(), fa_user_id)
  );
```

Same pattern for `cashflow_items`, `plan_data`, `fa_team_invitations`.

### 2.4 Write permissions

- Basic: can write only their own clients
- Pro: can write own clients + read team's clients (NO write — to prevent
  accidental edits to a Basic's data; Phase 2 may add controlled "review
  mode")
- Ultra: same as Pro — read-only on subordinate data

```sql
-- Phase 1: only owner can write
create policy "clients_owner_update" on public.clients
  for update using (fa_user_id = auth.uid())
  with check (fa_user_id = auth.uid());

create policy "clients_owner_insert" on public.clients
  for insert with check (fa_user_id = auth.uid());
```

### 2.5 Migration plan

Migrations 015-018 add the tier + status + invitation columns/tables. Run
them once against the (currently empty) production DB before any user data
exists.

```
015_fa_tier_and_code.sql
016_clients_status_fields.sql
017_fa_team_invitations.sql
018_rls_hierarchical_visibility.sql
```

---

## 3. Phase 1 Pages (final list — 6 pages)

Effort: **S** = 1-2 days · **M** = 3-5 days · **L** = 1-2 weeks

### 3.1 `/dashboard` — Tier-aware Home — **M**
What you see depends on tier:

**Basic:**
- KPI cards: total clients, by status (count of each of 7 statuses)
- Recent activity (last 5 client status updates I made)
- Pending invitations: incoming (e.g. "FA Pro X invited you")
- Quick action: "+ New Client", "Open Quick Plan"

**Pro:**
- All Basic's KPIs scoped to own + team data
- "My team" panel: list of Basics in team with their client counts
- Pending invitations sent (outgoing)

**Ultra:**
- Pro's KPIs scoped to own + Pros + transitive
- "Pros under me" panel
- Roll-up across the whole tree

### 3.2 `/clients` — Tier-aware Client List — **M**
Single table view. Columns:
- Name (firstname + nickname)
- Status (badge with color per status)
- Last activity (relative time)
- Owning FA (only shown when viewer is Pro/Ultra to distinguish own vs
  team's clients)
- Actions: open, mark status

Filters:
- Status dropdown (all + 7 statuses)
- "My clients only" toggle (Pro+Ultra) to hide team clients
- Free-text search (name or fa_code)

### 3.3 `/clients/[id]` — Client Detail — **L**
Master page for one client. Tabs:

1. **Overview** — basic info, current status (with toggle to change), last
   activity, key stats
2. **Modules** — accordion of planning modules (cashflow, balance,
   retirement, tax, insurance, education, goals). Each module is the
   existing calculator UI pulled out of `/calculators/*` and dropped
   inline.
3. **Status & Notes** — change current_status, edit status_note, view
   status history (Phase 2 — for now, just current status + note)
4. **Reports** — list of generated reports (Phase 1: just download links;
   Phase 2: compare versions)

⚠️ Module migration: the 13 calculators currently under `/calculators/*`
keep their compute logic but their UIs get re-themed and embedded as tab
content. No rewriting of math.

### 3.4 `/team` — Team Management (Pro + Ultra only) — **M**
Two halves:

**Top: My Team Members**
- Table of FAs whose team_lead_id == me
- Per-row: name, fa_code, tier, client count, last activity
- Click → navigate to `/team/agents/[id]` which shows their dashboard
  (read-only)

**Bottom: Invite a New Team Member**
- Input field: "ใส่รหัส FA" (e.g. "V8K3M2P")
- Optional message
- "Send Invitation" button → creates `fa_team_invitations` row
- Below: list of pending invitations sent (with status: pending / accepted
  / rejected / expired)

Visibility: Pros see Basics they can invite. Ultras see Pros they can
invite. (Validation: tier of invitee must be exactly 1 below inviter's
tier — enforced server-side on accept.)

### 3.5 `/inbox/invitations` — Incoming Invitations — **S**
Any FA logged in. Shows:
- Pending invitations addressed to my fa_code
- Per-row: inviter name, message, expires_at countdown
- Buttons: Accept (sets my team_lead_id) / Reject (mark rejected)

Notification badge in top nav when count > 0.

### 3.6 `/quick-plan` — Existing — **S**
Keep as-is. Minor adjustments:
- Remove FA-specific banner (not all visitors are FAs anymore)
- Result page CTA "ดูแผนเต็ม" → if logged-in, opens `/clients/new`
  pre-filled; if anonymous, shows "ติดต่อ FA Victory"

---

## 4. Out of Scope for Phase 1 (revised)

### Deferred to Phase 2
- Client Portal (with magic-link login)
- Pipeline state machine (with stages and conversion analytics)
- Plan Quality scoring engine (24 rules)
- AI insight summaries (FA-only when it ships)
- Status history tracking (timeline of status changes)
- Status-based dashboard cards (counts per stage)
- Cross-team visibility (a FA being in two teams)
- Activity heatmaps and coaching insights
- Scenario comparison
- Report Builder (Phase 1 ships a basic single-template export only)

### Deferred to Phase 3+
- Mobile native apps
- Calendar / scheduling
- Document library
- Subscription / billing UI
- AI chatbot for clients
- Multi-language support
- White-label deployments

---

## 5. Phase 1 Sprint Plan (5 weeks)

### Week 1 (May 7-13): Discovery + Migrations
- [x] v1 doc locked (this file)
- [ ] Migrations 015-018 written + tested locally
- [ ] RLS performance test with 200 FAs + 1000 clients (synthetic data)
- [ ] Wireframes for 6 pages (low-fi acceptable)
- [ ] Victory communication: launch shifts to mid/late June

### Week 2 (May 14-20): Auth shell + Dashboard
- [ ] Layout shell with tier-aware nav
- [ ] `/dashboard` for Basic
- [ ] `/dashboard` for Pro (added panels)
- [ ] `/dashboard` for Ultra (full roll-up)
- [ ] Test data: seed 30 Victory FAs in dev DB

### Week 3 (May 21-27): Clients list + invitations
- [ ] `/clients` list (tier-aware filtering)
- [ ] `/team` page with team list + invitation form
- [ ] `/inbox/invitations` with accept/reject
- [ ] End-to-end: Pro invites Basic, Basic accepts, Pro now sees Basic's
  clients

### Week 4 (May 28 - Jun 3): Client Detail + module migration
- [ ] `/clients/[id]` with tabs (Overview, Modules, Status, Reports)
- [ ] Migrate 7 modules into Modules tab (keep compute logic)
- [ ] Status toggle UI + free-form note
- [ ] Quick Plan CTA rewire

### Week 5 (Jun 4-10): QA + Polish + Soft Launch
- [ ] Internal QA pass
- [ ] Bug bash with 3-5 friendly Victory FAs
- [ ] Hotfixes
- [ ] Deploy to wealthplanner.finance
- [ ] Soft launch to ~30 FAs
- [ ] Iterate on feedback before opening to all 200

### Week 6 (Jun 11-17): Buffer + full launch
- [ ] Reserved for slippage
- [ ] Full Victory rollout if soft launch is clean

---

## 6. Locked Tech Decisions (unchanged from v0)

| Concern | Choice |
|---|---|
| Frontend framework | Next.js 16 (existing) |
| State | Zustand (existing) + URL state for filters |
| Styling | Tailwind v4 + CSS variables for tokens |
| Backend | Supabase (existing) |
| Auth | Supabase Auth (existing) |
| Charts | Recharts (existing) |
| Hosting | Vercel (existing) |

PDF export and Anthropic API are **deferred** to Phase 2.

---

## 7. Risk Register (Phase 1)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Solo dev burnout | High | High | Sustainable pace 8-10h/d × 6d/w; weekly checkpoint |
| Scope creep into Phase 2 features | Medium | High | This doc + "Out of Scope" list as veto |
| Victory rejects ~1 month launch slip | Low | High | Frame as smaller delay than v0 (was 2 months); show working dashboard end of week 2 |
| RLS recursion slow at scale | Low | Medium | Test in week 1; switch to materialized closure table if needed |
| Status taxonomy doesn't match how FAs work | Medium | Low | Free-form note + 'other' option safety valve; iterate post-soft-launch |
| Module re-theming breaks existing math | Low | High | Keep compute logic untouched; only rewrite UI shells |

---

## 8. Open Questions Status

All v0 critical questions are now answered:

| # | Question | Answer |
|---|---|---|
| 1 | Pipeline stages | **Deferred to Phase 2.** Phase 1 uses 7 manual statuses (appointment, fact_finding, proposed, done, follow, deny, other) |
| 2 | Portal auth | **Email magic link only** (Phase 2) |
| 3 | AI insight visibility | FA-only (Phase 2) |
| 4 | Plan Quality rules | **Deferred to Phase 2** (24 rules drafted, awaiting domain stability) |
| 5 | Report templates | Build from scratch — Phase 1 ships single basic template |
| 6 | Hierarchy model | **3-tier FA (Basic/Pro/Ultra) with self-service A2 invite flow** |
| 7 | Allianz inside data | TBD — not blocking |

---

## 9. Document Changelog

- **2026-05-07 v1** — Architecture locked. Scope reduced from 8w/3-workspace
  to 5w/single-workspace based on product owner review. Pipeline, Plan
  Quality, Client Portal, AI Insights all deferred to Phase 2.
  Status taxonomy finalized (7 values + free-form note). Hierarchy
  finalized (Basic/Pro/Ultra + Super Admin) with self-service A2
  invitation flow.

- **2026-05-07 v0** — initial draft (8 weeks, 3 workspaces, 10 pages).

---

*End of Discovery Doc v1 — LOCKED*
