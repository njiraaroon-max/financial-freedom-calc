# Phase 1 Restructure — Status Snapshot

> **As of:** 2026-05-08
> **Latest commit:** check `git log -1 main` (was around `cc2bffd` at snapshot time)
> **Production:** https://wealthplanner.finance — auto-deploys from `main`
> **Source of truth:** [discovery-doc-v1.md](./discovery-doc-v1.md) (locked architecture)

This doc is the **handoff brief** — read it first when continuing
work in a new session. It captures everything that's shipped, what's
left, and the active tradeoffs.

---

## 1. What's done — Phase 1 ~95%

### Database (8 migrations applied to production)

| # | File | What |
|---|---|---|
| 015 | `015_fa_tier_and_code.sql` | tier (basic/pro/ultra) + fa_code + team_lead_id on fa_profiles, hierarchy validation trigger |
| 016 | `016_clients_status_fields.sql` | current_status (7-value enum) + status_note + status_updated_at + last_activity_at on clients |
| 017 | `017_fa_team_invitations.sql` | fa_team_invitations table (pending/accepted/rejected/expired/cancelled) |
| 018 | `018_rls_hierarchical_visibility.sql` | First attempt at hierarchical RLS — **REVERTED** in 019 |
| 019 | `019_rls_hotfix_perf.sql` | Strict-owner RLS (faster, simpler) + walk-up fa_can_view_data_of() |
| 020 | `020_team_rpcs.sql` | 5 SECURITY DEFINER RPCs: fa_lookup_public, fa_lookup_by_code, team_members_with_counts, team_client_stats, team_total_counts |
| 021 | `021_client_visibility_rpcs.sql` | get_client_for_viewer + list_visible_clients (cross-FA read with can_edit flag) |
| 022 | `022_relax_basic_lead_rule.sql` | Allow Basic.team_lead → Pro OR Ultra (was Pro-only) |

All 8 are idempotent. If a fresh DB needs setup, run them in order.

### Pages built

| Route | Who sees | What it does |
|---|---|---|
| `/dashboard` | Everyone | Tier-aware KPIs (Basic sees own; Pro adds team rollup; Ultra adds tree rollup); status breakdown bar; quick actions |
| `/clients` | Everyone | Owner-only client list + StatusToggle. Each card has status badge, edit/archive/delete actions |
| `/clients/[id]` | Everyone | 4-tab master detail: Overview, Modules, Status & Notes, Reports. Read-only banner when viewing a subordinate's client |
| `/team` | Pro / Ultra | Team member list (clickable rows → drill-down), invite form, outgoing invitations with Active/History toggle |
| `/team/[fa_id]` | Pro / Ultra | Drill-down: subordinate's profile + their clients (read-only) + 4 stat cards |
| `/inbox/invitations` | Everyone | Pending invitations with Accept/Reject + history |
| `/admin` | Admin only | All FAs + approval workflow (existing legacy page) |
| `/admin/org-chart` | Admin only | 3-view (Table / List / Diagram) tier + team_lead editor |
| `/quick-plan` | Public | Existing 5-min financial assessment (untouched in Phase 1 restructure) |

### Hooks + components added

- `src/hooks/useClients.ts` — owner-only client list
- `src/hooks/useClientStats.ts` — own + team rollup stats for dashboard
- `src/hooks/useTeam.ts` — team members, outgoing invitations, sendInvitation, cancelInvitation
- `src/hooks/useInvitations.ts` — pending/history invitations for inbox
- `src/components/clients/StatusBadge.tsx` — colored pill for the 7 statuses
- `src/components/clients/StatusToggle.tsx` — clickable badge that opens dropdown picker
- `src/lib/supabase/admin.ts` — extended with setFaTier, setFaTeamLead, setFaTeamAssignment

### Sidebar nav (both legacy + professional)

Pro/Ultra now see "ทีม" + "กล่องจดหมาย" entries. Legacy Sidebar got
them first; SidebarPro got them in commit `cc2bffd` (later — earlier
oversight).

### Key UX decisions made along the way

1. **Hierarchy is 3-tier** (basic/pro/ultra) plus admin role separate
2. **Invitation flow is self-service A2** — Pro types fa_code → invitee accepts in inbox → team_lead_id set
3. **Strict-owner RLS** for clients/cashflow/plan_data; cross-FA reads via SECURITY DEFINER RPCs (faster + safer than blanket hierarchical RLS)
4. **/clients = own only**. Drill into subordinates via /team/[fa_id], not via /clients filter
5. **Read-only mode** banner + disabled controls on /clients/[id] when viewing subordinate's client
6. **Manual status tick (7 values)** — not a pipeline state machine. Pipeline deferred to Phase 2
7. **Client Portal deferred to Phase 2** — Quick Plan stays as anonymous lead-gen for now
8. **Plan Quality scoring deferred to Phase 2** — 24 rules drafted in v1 doc

### Copy / labels (locked)

- "FA" (not "FA Basic") for the default tier — feels less like a downgrade
- "FA Pro" for tier 2
- "FA Ultra" for tier 3 (top of org tree, no lead)
- "Team FA Pro" for the Ultra dashboard's "Pros under me" card
- "FA ในทีม" for the Pro dashboard's "Basics in team" card
- 7 client statuses (Thai labels): นัดทำแผน, เก็บข้อมูล (Fact Finding), นำเสนอแผน, Done, Follow, Deny, Other

---

## 2. What's left for Phase 1

### Critical pre-launch (blocker)
- **Soft launch with 3-5 friendly Victory FAs** — surface real-world bugs
- **Onboarding / empty states** — 200 cold FAs need clear "what to do first"

### Important nice-to-have
- **Quick Plan → Client conversion** (1.5 hr) — currently /quick-plan ends in dead end CTA
- **Plan Quality Indicators** (✅⚠❌ per module) — 2 hr, foundation for Phase 2 scoring engine
- **Status note prompt** when status='other' — small UX touch
- **Mobile responsive audit** — FAs use phones in field

### Definitely Phase 2 (don't try in Phase 1)
- Client Portal with magic-link auth
- Pipeline state machine + conversion analytics
- Plan Quality scoring engine (24 rules)
- AI insight summaries
- Module migration (embed calculators inside `/clients/[id]` Modules tab)
- Drag-and-drop on org-chart Diagram view

---

## 3. Open decisions waiting for product owner

None blocking. All v1 critical questions are answered (see v1 doc §8).

The most recent open thread: user is finishing a long session and
asking for handoff prep — that's THIS doc.

---

## 4. Testing setup notes

To test the tier hierarchy, the SQL helper at
[`docs/redesign/test-helpers.sql`](./test-helpers.sql) has copy-paste
blocks for promoting yourself to Pro / Ultra and inspecting team
invitations.

To test cross-FA visibility (Pro sees Basic's clients) you need
either two real FA accounts OR a manual SQL bind:

```sql
-- Bypass invitation flow for testing
update public.fa_profiles
   set team_lead_id = (select user_id from public.fa_profiles where role = 'admin')
 where email = 'BASIC_EMAIL@example.com';
```

The current Victory production DB has 14 FAs all in tier='basic'
plus the admin (ณัฐ, role='admin', tier='ultra'). To exercise the
team flow in real life:

1. Promote 1-2 FAs to 'pro' via /admin/org-chart
2. Assign other Basics to those Pros (or directly to Ultra after
   migration 022 — both work)
3. Re-test the /team and /clients/[id] read-only flows

---

## 5. Known limitations (deliberate)

- **Calculator modules not yet client-scoped** — they read/write to
  Zustand stores that are still global. Active client cookie is set
  but doesn't yet partition the stores. Scheduled for Phase 2.
- **/admin/org-chart Diagram view has no drag-drop** — clicking a
  node hops back to Table view instead. Phase 2 candidate.
- **Subordinate's clients show via list_visible_clients RPC** which
  returns the entire visible set in one query. Fine at <1000 clients
  per Ultra; if Victory grows past that we'd swap to a paginated RPC.

---

## 6. Quick orientation for a new session

1. **Read this doc** + [discovery-doc-v1.md](./discovery-doc-v1.md)
2. **Pull latest:** `git pull` then `git log -10 --oneline` to see
   recent work
3. **Check production:** https://wealthplanner.finance/admin/org-chart
   to see the current org tree
4. **Check Supabase:** verify migrations 015-022 are all applied
5. **Pick up from §2** — anything in "Critical pre-launch" or
   "Important nice-to-have" is a candidate for the next sprint
