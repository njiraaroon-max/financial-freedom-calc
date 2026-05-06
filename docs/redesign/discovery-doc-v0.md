# WealthPlanner Restructure — Discovery Doc v0

> **Status:** Draft 0 — pending product owner review
> **Author:** Nutt Jiraaroon + Claude (paired)
> **Date created:** 2026-05-07
> **Target launch:** 2026-07-08 (8 weeks from start)
> **Current launch (cancelled):** 2026-05-16/17

---

## 0. Why this exists

WealthPlanner today is a calculator collection — useful, but FAs export numbers
to Excel anyway because the app doesn't help them **manage clients, track team
performance, or hand a clean report to a customer**. The Victory Group leadership
will fund a team-management feature set if we reframe the product as a
**Financial Planning Operating System** with a hierarchical view (AVP → AL →
Agent), a client-facing portal, and pipeline analytics.

The May 16-17 launch is being deferred to **2026-07-08** to ship the
restructure as the FAs' first impression — migrating data after onboarding
200 FAs would be 10x harder than restructuring before any production data
exists.

---

## 1. Architecture Overview

### 1.1 Three workspaces, one app

```
                  ┌──────────────────────────────┐
                  │   wealthplanner.finance      │
                  │   (single Next.js app)       │
                  └──────────────┬───────────────┘
                                 │
                ┌────────────────┼────────────────┐
                ▼                ▼                ▼
         ┌──────────┐     ┌──────────┐     ┌──────────┐
         │  Client  │     │ Planner  │     │   Team   │
         │Workspace │     │Workspace │     │ Command  │
         └──────────┘     └──────────┘     └──────────┘
              │                │                │
       /portal/*         /planner/*      /team/*
       (client login)   (FA login)       (AL/AVP login)
```

Each workspace has its own URL prefix, layout component, and role gate. They
share the same authentication system and Supabase backend.

### 1.2 Roles & access matrix

| Role     | Sees Client Workspace | Sees Planner Workspace | Sees Team Center |
|----------|:---------------------:|:----------------------:|:----------------:|
| Client   | Own data only         | —                      | —                |
| Agent    | Own clients (read)    | Own clients (full)     | —                |
| AL       | Own + downline (read) | Own + downline (full)  | Downline only    |
| AVP      | All in org (read)     | All in org (full)      | Full org         |
| Admin    | (system only — no UI in Phase 1) |             |                  |

**Hierarchy:** Each `fa_profile` has a nullable `parent_fa_id`. Visibility
queries traverse this tree via a recursive RLS function.

### 1.3 URL routing scheme

```
/                                  → role-aware redirect (Agent → /planner,
                                     AL/AVP → /team, Client → /portal)

/quick-plan                        → public 5-min checkup (unchanged from
                                     current — kept as standalone lead-gen)

/portal/                           → client home (after client login)
/portal/health-score               → Financial Health 360
/portal/action-plan                → Priority Action Plan
/portal/progress                   → Progress Tracking
/portal/report                     → Latest delivered report

/planner/                          → FA dashboard (default after login)
/planner/clients                   → client list with pipeline
/planner/clients/[id]              → Client Detail Workspace
/planner/clients/[id]/[module]     → e.g. /balance-sheet, /retirement
/planner/clients/[id]/scenarios    → Scenario Comparison
/planner/clients/[id]/report       → Report Builder
/planner/follow-ups                → Follow-up tasks list

/team/                             → Team Command Center home
/team/pipeline                     → org-wide pipeline view
/team/agents/[id]                  → individual FA performance
/team/case-review                  → cases flagged for review
/team/coaching                     → coaching insights

/login, /signup, /forgot-password  → unchanged
/auth/callback, /auth/signout      → unchanged
```

### 1.4 Layout shells

Three top-level layouts, each with its own nav:

- **`/portal/layout.tsx`** — minimal, customer-facing, large type, no jargon
- **`/planner/layout.tsx`** — sidebar nav (clients / follow-ups / settings),
  card-based content area
- **`/team/layout.tsx`** — wide dashboard layout, KPIs at top, scrollable
  panels

Shared header (logo, user menu, search) lives in a top-level `AppShell`
component that renders inside any of the three layouts.

---

## 2. Data Model

### 2.1 Current schema (keep)

| Table | Purpose | Phase 2 changes |
|---|---|---|
| `auth.users` | Supabase auth | + new entry per Client portal user |
| `fa_profiles` | FA metadata | **+ parent_fa_id, role_level** |
| `clients` | End-consumer records | **+ pipeline_stage, last_activity_at, plan_quality_score** |
| `cashflow_items` | Income/expense rows | unchanged |
| `plan_data` | JSONB blob per domain | + 2 new domains |
| `organizations` | Multi-tenant brand | unchanged |

### 2.2 New tables (Phase 2)

```sql
-- Maps which FA owns/serves a client (current: clients.fa_user_id is the only
-- link). For Phase 2 we keep that as primary owner BUT also support transfer
-- history and cross-FA visibility (e.g. AVP reviewing an Agent's case).
create table public.fa_client_assignments (
  fa_user_id  uuid not null references auth.users(id),
  client_id   uuid not null references public.clients(id) on delete cascade,
  role        text not null check (role in ('owner','reviewer','observer')),
  assigned_at timestamptz not null default now(),
  primary key (fa_user_id, client_id, role)
);

-- Client portal users — separate auth identity from the FA that owns them.
-- A client.id maps to one auth.users.id when the FA invites them to the portal.
create table public.client_portal_links (
  client_id      uuid primary key references public.clients(id) on delete cascade,
  client_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by_fa  uuid not null references auth.users(id),
  invited_at     timestamptz not null default now(),
  activated_at   timestamptz
);

-- Activity log — every meaningful FA/Client action. Drives Team Command
-- Center, coaching insights, and "last seen" indicators.
create table public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null references auth.users(id),
  actor_role  text not null,                  -- 'fa' | 'client' | 'system'
  client_id   uuid references public.clients(id) on delete set null,
  action      text not null,                  -- 'plan.updated' | 'meeting.held' ...
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index activity_logs_client_id_idx on public.activity_logs(client_id);
create index activity_logs_actor_id_idx on public.activity_logs(actor_id, created_at desc);

-- Follow-up tasks the FA owes a client.
create table public.follow_up_tasks (
  id          uuid primary key default gen_random_uuid(),
  fa_user_id  uuid not null references auth.users(id),
  client_id   uuid not null references public.clients(id) on delete cascade,
  title       text not null,
  due_at      timestamptz,
  status      text not null default 'open',   -- 'open' | 'done' | 'skipped'
  notes       text,
  created_at  timestamptz not null default now(),
  completed_at timestamptz
);

-- Saved scenarios for comparison — different parameter sets producing
-- different projections, owned per-client.
create table public.scenarios (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  name         text not null,                 -- 'Conservative' | 'Aggressive'
  description  text,
  inputs       jsonb not null,                -- entire input set for replay
  results      jsonb not null,                -- snapshot of computed outputs
  is_baseline  boolean not null default false,
  created_at   timestamptz not null default now()
);

-- AI insights cache — generated summaries to avoid re-running the LLM
-- every time the dashboard renders.
create table public.ai_insights (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  scope       text not null,                  -- 'health_score' | 'action_plan' | 'gap_analysis'
  summary     text not null,                  -- markdown, ~200-400 words
  generated_at timestamptz not null default now(),
  generated_by_model text,                    -- 'claude-sonnet-4-5' etc.
  inputs_hash text not null,                  -- SHA of inputs that produced it
  unique (client_id, scope)
);
```

### 2.3 Column additions (Phase 2 migration)

```sql
-- Hierarchy + role tier
alter table public.fa_profiles
  add column if not exists parent_fa_id uuid references auth.users(id),
  add column if not exists role_level text not null default 'agent'
    check (role_level in ('agent','al','avp'));

create index if not exists fa_profiles_parent_idx
  on public.fa_profiles(parent_fa_id);

-- Pipeline + quality + last activity on clients
alter table public.clients
  add column if not exists pipeline_stage text not null default 'lead'
    check (pipeline_stage in (
      'lead', 'discovery', 'plan_drafted',
      'plan_presented', 'committed', 'won', 'archived'
    )),
  add column if not exists plan_quality_score int,            -- 0-100
  add column if not exists last_activity_at timestamptz,
  add column if not exists portal_invited_at timestamptz;

-- New plan_data domains
-- (no schema change — domain is just a string. Add: 'risk_management',
-- 'goals_progress' as planner-only domains)
```

### 2.4 RLS — hierarchical visibility

The hardest part. Need a recursive function:

```sql
-- Returns true if `viewer_id` can see `target_fa_id`'s data — true when
-- viewer == target, or viewer is an ancestor in the parent_fa_id chain.
create or replace function public.fa_can_view(
  viewer_id uuid, target_fa_id uuid
) returns boolean
language sql stable as $$
  with recursive ancestors(id) as (
    select target_fa_id
    union all
    select fp.parent_fa_id
    from public.fa_profiles fp
    join ancestors a on a.id = fp.user_id
    where fp.parent_fa_id is not null
  )
  select exists (select 1 from ancestors where id = viewer_id);
$$;
```

Update existing RLS policies on `clients` to use this:

```sql
drop policy if exists "clients_own_select" on public.clients;
create policy "clients_visible_select" on public.clients
  for select using (
    fa_user_id = auth.uid()
    or public.fa_can_view(auth.uid(), fa_user_id)
  );
```

Same pattern for `cashflow_items`, `plan_data`, `activity_logs`,
`follow_up_tasks`.

⚠️ **Performance:** the recursive CTE runs per row. Need to test with 200 FAs
+ 1000 clients. If slow → materialize ancestor sets in a side table that
refreshes on parent_fa_id changes.

### 2.5 Migration strategy

Since launch is being moved out, **no production data exists yet** — this
migration runs against an empty production DB. We can do destructive changes
without worry.

1. Migrations 015-022 add the new tables and columns
2. Re-create RLS policies on old tables to use `fa_can_view`
3. Seed Victory's hierarchy (manually script: AVP at top, ALs under, agents
   under ALs)
4. No data backfill needed — clean slate

---

## 3. Page-by-Page Spec

Effort tags: **S** = 1-2 days · **M** = 3-5 days · **L** = 1-2 weeks · **XL** = 2-3 weeks

### 3.1 Quick Financial Checkup (`/quick-plan`) — **S**
Existing `/quick-plan` route. Phase 2 changes:
- Pre-fill from logged-in client portal user (not just FA's profile-store)
- "Save to portal" CTA for prospects who want to come back
- Result page links to **Action Plan** instead of /calculators/sales/*
- Restyle to match Client Workspace tokens (already 80% there)

### 3.2 Financial Life Map (`/portal/`, `/planner/clients/[id]`) — **L**
Visual overview of where the client stands across all 5 Pyramid layers,
rendered as an interactive pyramid graphic with status icons (✅ ⚠️ ❌)
on each tier.

Components:
- Pyramid SVG (extend current Victory pyramid)
- Per-layer status card (click → drill into module)
- "Update last reviewed" timestamp

Data: `plan_data` (all domains) + `clients.last_activity_at`

### 3.3 Financial Health 360 Dashboard (`/portal/health-score`) — **L**
Customer-facing snapshot:
- One headline number (0-100 score) + grade (A/B/C/D)
- 5 sub-scores (one per Pyramid layer)
- 3-month trend chart (sparkline)
- AI-generated 200-word summary ("คุณกำลังไปได้ดีในเรื่อง... ที่ควรเร่งคือ...")
- "Talk to your FA" CTA → opens chat or schedule link

Data: aggregated from all `plan_data` domains + `ai_insights.scope='health_score'`

### 3.4 Priority Action Plan (`/portal/action-plan`) — **M**
Top 3-5 actions ranked by impact. Each item has:
- Icon + title (e.g. "เพิ่มเงินสำรองฉุกเฉินอีก ฿120,000")
- Why it matters (1 line)
- Expected impact on score (+X points)
- "Mark done" toggle (writes to `follow_up_tasks` with status='done')

Engine: rule-based ranker over plan_data, similar to Pyramid Score logic
already in `/quick-plan`.

### 3.5 Scenario Comparison (`/planner/clients/[id]/scenarios`) — **L**
Side-by-side projection of 2-3 named scenarios (e.g. "Current trajectory" vs
"With ฿15k/mo more savings").

Components:
- Scenario list (left rail)
- Comparison table (key metrics per year)
- Charts overlay (retirement balance, cumulative savings)
- "Save scenario" + "Make baseline" actions

Data: `scenarios` table + replay through existing compute engines

### 3.6 Client Detail Workspace (`/planner/clients/[id]`) — **L**
The FA's home for one client. Tabs:
- **Overview** — Financial Life Map + key metrics + last activity
- **Modules** — accordion of all 7 planning domains (cashflow, balance,
  retirement, tax, insurance, education, goals)
- **Scenarios** — list + create
- **Reports** — generated history
- **Activity** — log of all events on this client
- **Notes** — private FA notes

Data: master query joining clients + all related tables

### 3.7 Planner Dashboard (`/planner/`) — **L**
FA's home. Cards:
- **Pipeline** — kanban-lite: counts per `pipeline_stage`
- **Today's follow-ups** — top 5 from `follow_up_tasks` due ≤ today
- **Recent activity** — last 10 actions across owned clients
- **My quality score** — average `plan_quality_score` across clients
- **Quick links** — new client, latest report, reports drafts

### 3.8 Team Command Center (`/team/`) — **XL**
The big new feature. Three layouts depending on role:

**For AVP:**
- Org-wide KPIs (total clients, conversion %, avg quality)
- Drill-down: AL list → Agent list → Client list
- Heatmap: agent activity over last 30 days
- Cases flagged for review (low quality + high urgency)

**For AL:**
- Same as AVP but scoped to downline
- Coaching prompts: "3 of your 7 agents haven't logged activity this week"

**For Agent:**
- Redirected to `/planner` (no Team view)

### 3.9 Plan Quality Checklist (`/planner/clients/[id]/quality`) — **M**
Inline-rendered checklist on the Client Detail page. Rules engine:
- Has cashflow data ✓
- Has balance sheet ✓
- Has emergency fund analysis ✓
- Retirement projection complete ✓
- Insurance gap analysis done ✓
- ...20-30 rules total

Each rule has weight; sum → `plan_quality_score`. Score visible to FA + AL/AVP.

### 3.10 Client Portal (`/portal/`) — **L**
Separate authentication flow. Phase 1 features:
- Magic-link email login (no password — simpler for non-tech clients)
- Read-only views of: Financial Life Map, Health Score, Action Plan, Reports
- Comment/question form per page (writes to `activity_logs`)
- "Schedule a call" link

⚠️ Auth complexity — see §4.1.

### 3.11 Report Builder (`/planner/clients/[id]/report`) — **L**
Two outputs from one source:
- **Client report** — friendly, photo-rich PDF, ~10 pages
- **Planner report** — technical, dense, ~25 pages with appendices

Template engine: server-rendered HTML → PDF via Puppeteer or Playwright.
Reuses existing report logic from current `/report` page.

---

## 4. Critical Questions to Validate

These need product-owner answers BEFORE Phase A starts. Answers shape data
model and UI.

### 4.1 Client Portal authentication
- **Magic link email**? (recommended — Supabase has it built-in)
- LINE Login? (familiar to Thai users but extra OAuth setup)
- SMS OTP? (Thai phone-first — but cost per OTP ~฿1)
- → **Default recommendation:** magic link email + LINE Login as opt-in

### 4.2 Pipeline stages
- The 7 stages I drafted (lead → discovery → plan_drafted → plan_presented →
  committed → won → archived) — does this match how Victory FAs actually
  work?
- Should AL/AVP be able to customize per-org?
- → **Open question — needs Victory feedback in week 1**

### 4.3 AI insight scope
- Use Claude API or GPT? (Claude — already aligned with development workflow)
- Generate on-demand or batch nightly?
- Cache invalidation: regenerate when inputs hash changes
- Cost estimate: 200 FAs × 5 clients × 3 insights × ~2k tokens = ~6M tokens/month ≈ ฿800-1500/month
- → **Default: Claude on-demand, cache by inputs_hash**

### 4.4 Team hierarchy
- Max depth: 3 (Agent / AL / AVP) — confirmed
- Lateral visibility: NO (AL cannot see another AL's downline) — confirmed
- Transfer client between FAs: needed in Phase 2? (recommend yes — common
  case when agent leaves)

### 4.5 Plan Quality scoring
- Static weights or per-org configurable?
- Should clients see their quality score (no — it's an internal QA metric)
- → **Default: static weights v1, configurable in Phase 3**

### 4.6 Subscription / billing
- Phase 2 = NOT building. Victory pays flat fee outside the app.
- Phase 3+ = consider Stripe integration

### 4.7 Migration & cutover
- Current production has no FA data yet (Victory hasn't onboarded)
- Cutover = drop the existing schema, re-run migrations, ship new app
- Old `/calculators/*` routes: keep for 30 days as redirects to new
  `/planner/clients/[id]/[module]` URLs (so any external links don't 404)

---

## 5. Phasing & Sprint Plan

### Week 1 (May 7-13) — **Discovery + Architecture**
- [ ] Doc review with product owner (this doc)
- [ ] Answer critical questions §4
- [ ] Wireframe each of 10 pages (low-fi, ASCII or hand-sketch acceptable)
- [ ] Migration scripts 015-022 written + tested locally
- [ ] Anthropic API key set up + cost dashboard
- [ ] Victory communication: launch → 8 July with rationale

### Week 2-4 (May 14 – Jun 4) — **Phase A: Client Workspace**
Goal: a client (and FA running through it) can see their entire financial
position end-to-end.

- Week 2: portal layout + auth + Quick Plan rewire + Health Score 360
- Week 3: Action Plan + Financial Life Map + Progress Tracking
- Week 4: Client Portal polish + 5-client end-to-end test

### Week 5-7 (Jun 5 – Jun 25) — **Phase B: Planner Workspace**
Goal: an FA can manage their full caseload.

- Week 5: Planner Dashboard + Client list + pipeline kanban
- Week 6: Client Detail Workspace (tabs) + Module migration from
  /calculators/* + Plan Quality Checklist
- Week 7: Scenario Comparison + Report Builder + Follow-up tasks

### Week 8 (Jun 26 – Jul 2) — **Phase C: Team Command Center**
Goal: an AL/AVP can monitor downline performance.

- Days 1-2: Team layout + role gating + RLS for hierarchy
- Days 3-4: Pipeline overview + agent drill-down
- Days 5-6: Activity heatmap + case review flagging
- Day 7: Coaching insights MVP (3-4 canned insights based on activity logs)

### Week 9 (Jul 3 – Jul 8) — **QA + Polish + Soft Launch**
- Day 1-2: Internal QA pass on all 10 pages
- Day 3: Bug bash with 3 friendly Victory FAs
- Day 4: Hotfix bugs from bug bash
- Day 5: Final smoke test, comms ready
- Day 6: Deploy to wealthplanner.finance
- Day 7: Onboard Victory's 200 FAs

### Cadence rules
- Every Phase has a hard end date — if behind by 2 days, **cut features** not
  shift dates
- Every Friday: progress review against this doc + adjust next week
- Every page must be merge-ready (typecheck + build) before moving on

---

## 6. NOT Building in Phase 2

Documenting these explicitly to prevent scope creep. All deferred to Phase 3+:

- ❌ Mobile native app (iOS/Android) — responsive web only
- ❌ Calendar / scheduling system (use external Calendly/LINE)
- ❌ Document library (use Google Drive links instead)
- ❌ Subscription / billing UI (Stripe etc — manual invoicing)
- ❌ AI chatbot for clients (just AI summaries, no conversation)
- ❌ Multi-language support (Thai only — English copy will appear sparingly)
- ❌ Course / education content marketplace
- ❌ Public marketing site (homepage stays minimal)
- ❌ Push notifications / email digests (only transactional emails)
- ❌ Granular permissions per-feature (3 roles is enough)
- ❌ White-label deployments for non-Victory orgs
- ❌ Insurance product database (keep Allianz only)
- ❌ Cross-FA collaboration on a single client (one owner only)

---

## 7. Tech Decisions Locked

| Concern | Choice | Rationale |
|---|---|---|
| Frontend framework | Next.js 16 (existing) | Already there, App Router fits |
| State | Zustand (existing) + URL state for filters | Don't add Redux/Jotai |
| Styling | Tailwind v4 + CSS variables for tokens | Already there |
| Backend | Supabase (existing) | RLS handles role-based access |
| Auth | Supabase Auth (existing) + magic link for portal | Built-in |
| AI | Anthropic Claude API | Aligns with existing dev workflow |
| Charts | Recharts (existing) | Don't switch — works fine |
| PDF | Puppeteer (new) or Playwright | Server-rendered HTML → PDF |
| Hosting | Vercel (existing) | No change |

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Solo dev burnout | High | High | Sustainable pace 8-10h/d × 6d/w; weekly checkpoint |
| Scope creep | High | High | This doc + "NOT Building" list as veto reference |
| Victory rejects launch delay | Medium | High | Frame as "more value coming" + show demo of Phase A end of week 4 |
| RLS hierarchy queries slow | Medium | Medium | Test at 200×1000 scale week 1; materialize if needed |
| AI API costs balloon | Low | Medium | Cache by inputs_hash; monthly budget cap |
| Phase A drags into Phase B | Medium | Medium | Hard 4-week cap on Phase A; cut features if needed |
| Portal auth complexity | Medium | Medium | Start with magic link only; add LINE later |
| Migration breaks existing /calculators URLs | Low | Low | 30-day redirect layer |

---

## 9. Open Questions for Product Owner (Nutt)

Please answer before Friday May 9 — these block week 1 wireframing:

1. **Pipeline stages** — does the 7-stage list match Victory's actual sales
   process? Names + order OK?
2. **Portal auth** — start with magic link only? OR include LINE Login from
   day 1?
3. **AI insights — visible to client?** Or planner-only with shareable
   summary?
4. **Plan Quality** — do you have a draft list of "what makes a complete
   plan"? Or should I propose 20-30 rules?
5. **Report templates** — do you have an existing PDF template (Word, Canva,
   Figma) or starting from scratch?
6. **Victory hierarchy data** — can you provide the actual AVP/AL/Agent
   structure (200 FAs) by Jul 1 so we can seed?
7. **Allianz inside data** — what data do we have access to that's NOT in the
   public Allianz product catalog? (forms? rate tables? underwriting data?)

---

## 10. Document Lifecycle

- **v0** (this) — draft, will iterate this week with Nutt
- **v1** — locked architecture, accepted by Nutt before Phase A starts
- **v1.x** — minor updates as decisions are made (record in Changelog below)

### Changelog
- 2026-05-07 v0 — initial draft

---

*End of Discovery Doc v0*
