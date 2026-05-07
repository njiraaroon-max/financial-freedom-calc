# WealthPlanner Phase 1 — Wireframes v1

> Companion to [discovery-doc-v1.md](./discovery-doc-v1.md). Low-fi ASCII
> wireframes for the 6 Phase 1 pages. The point is to align on **layout
> regions and information density**, NOT pixel-perfect design.
>
> Visual style is locked from the existing app: white background, navy
> primary (#0f1e33), soft-blue accents, gold sparingly for CTAs. Card-
> based dashboard. Match the Victory Pyramid pages we already shipped.

---

## Table of contents

1. [Shared layout shell](#1-shared-layout-shell)
2. [/dashboard (3 tier variants)](#2-dashboard)
3. [/clients (list)](#3-clients-list)
4. [/clients/[id] (detail with tabs)](#4-clientsid-detail)
5. [/team (Pro + Ultra only)](#5-team)
6. [/inbox/invitations](#6-inboxinvitations)
7. [/quick-plan (already shipped — minor rewire)](#7-quick-plan)

---

## 1. Shared Layout Shell

Every authenticated page renders inside this:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ▣ WealthPlanner   [🔍 Search clients/FAs]    [🔔 N] [Avatar ▾]      │
├────────────┬─────────────────────────────────────────────────────────┤
│            │                                                         │
│  📊 Dash   │                                                         │
│  👥 Clients│                                                         │
│  ⚡ Quick  │                Page content area                        │
│            │                (changes per route)                      │
│  ─── Pro+ ─│                                                         │
│  🌐 Team   │                                                         │
│  📨 Inbox •│ ← red dot when pending invitations > 0                  │
│            │                                                         │
│  ─────────│                                                         │
│  ⚙ Profile│                                                         │
│  ↪ Logout │                                                         │
│            │                                                         │
└────────────┴─────────────────────────────────────────────────────────┘
```

**Tier-aware nav rules:**
- Basic: hides "Team" entirely (Inbox stays — Basics receive invites)
- Pro / Ultra: shows everything
- Super Admin: same as Ultra + extra "Admin" link to existing /admin

**Top-right notification bell:** count of pending invitations (same number
as the red dot on Inbox in the sidebar — redundancy is intentional, both
are obvious entry points).

---

## 2. /dashboard

Tier determines which cards appear. Same outer layout, different content.

### 2.1 Basic tier

```
Dashboard                                              [+ New Client]
─────────────────────────────────────────────────────────────────────

┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ ลูกค้า      │  │ นัดทำแผน    │  │ Active      │  │ ปิดเคส      │
│             │  │             │  │ (follow)    │  │             │
│    12       │  │     3       │  │     5       │  │     1       │
│ ทั้งหมด     │  │             │  │             │  │             │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘

Status breakdown
┌──────────────────────────────────────────────────────────────────┐
│ นัดทำแผน 3 ▰▰▰░░░░░░░ 25%                                       │
│ Fact Finding 4 ▰▰▰▰░░░░░░ 33%                                  │
│ นำเสนอแผน 1 ▰░░░░░░░░░ 8%                                       │
│ Done 2  ▰▰░░░░░░░░ 17%                                          │
│ Follow 5 ▰▰▰▰▰░░░░░ 42%                                         │
│ Deny 0 ░░░░░░░░░░ 0%                                            │
│ Other 0 ░░░░░░░░░░ 0%                                           │
└──────────────────────────────────────────────────────────────────┘

Recent activity                                       [See all →]
┌──────────────────────────────────────────────────────────────────┐
│ 2h  คุณสมชาย ใจดี      → moved to "fact_finding"               │
│ 1d  คุณวันดี อยู่สุข   → status note updated                   │
│ 3d  คุณเอ ใหม่ใจ       → new client added                       │
│ 4d  คุณบีบี รักดี      → moved to "proposed"                    │
│ 7d  คุณซีซี ดีจัง     → moved to "follow"                       │
└──────────────────────────────────────────────────────────────────┘

Pending invitations (1)                              [See all →]
┌──────────────────────────────────────────────────────────────────┐
│ FA Pro Wiroj invites you to join their team                      │
│ "Hi, looking for partners in Bangkok area"                       │
│ Expires in 5 days     [Accept] [Reject]                          │
└──────────────────────────────────────────────────────────────────┘

Quick actions
[+ New Client]  [Open Quick Plan]  [View Latest Report]
```

### 2.2 Pro tier (adds team panels)

Same as Basic, plus:

```
My team                                              [Manage team →]
┌──────────────────────────────────────────────────────────────────┐
│ Name              Status active   Total clients   Last activity  │
│ ─────────────────────────────────────────────────────────────── │
│ FA Basic Anucha    ●  active        18              2h ago      │
│ FA Basic Suda      ●  active        14              1d ago      │
│ FA Basic Pong      ⚠  silent 7d+    9               8d ago      │
│ FA Basic Mai       ●  active        22              3h ago      │
│ ─────────────────────────────────────────────────────────────── │
│ Total: 4 Basics · 63 team clients                                │
└──────────────────────────────────────────────────────────────────┘

Outgoing invitations (2 pending)                    [Manage team →]
• To V8K3M2P — sent 2 days ago      [Cancel]
• To VFXR41Q — sent 6 hours ago     [Cancel]
```

### 2.3 Ultra tier (adds tree roll-up)

Same as Pro, plus:

```
Pros under me                                       [Manage team →]
┌──────────────────────────────────────────────────────────────────┐
│ Name              Their team   Total clients   Last activity     │
│ ─────────────────────────────────────────────────────────────── │
│ FA Pro Wiroj       4 Basics      63             2h ago           │
│ FA Pro Pim         3 Basics      41             4h ago           │
│ FA Pro Tom         5 Basics      78             1d ago           │
│ ─────────────────────────────────────────────────────────────── │
│ Total: 3 Pros · 12 Basics · 182 clients                          │
└──────────────────────────────────────────────────────────────────┘

Whole-tree status breakdown
[same component as Basic's status bars but counts everyone in tree]
```

---

## 3. /clients (list)

```
Clients                                                  [+ New]
─────────────────────────────────────────────────────────────────

[🔍 Search by name or fa_code…]

Filters:
[All] [นัดทำแผน 18] [Fact Finding 12] [Proposed 7] [Done 14] [Follow 22] [Deny 3] [Other 1]

[ ] My clients only        Owner: [All FAs ▾]    [↧ Export CSV]

┌──────────────────────────────────────────────────────────────────┐
│ Name                Status         Owner       Last activity     │
│ ─────────────────────────────────────────────────────────────── │
│ 👤 คุณ A           🟡 fact_finding (Me)         2h ago    [→]   │
│ 👤 คุณ B           🟢 active        Anucha      4h ago    [→]   │
│ 👤 คุณ C           🔵 proposed      Suda        1d ago    [→]   │
│ 👤 คุณ D           ⚪ deny          (Me)         3d ago    [→]   │
│ ...                                                              │
│ ─────────────────────────────────────────────────────────────── │
│                                            [< 1 2 3 4 ... >]    │
└──────────────────────────────────────────────────────────────────┘
```

**Tier behaviour:**
- Basic: Owner column hidden (always = Me); "My clients only" toggle hidden
- Pro: Owner column shown; toggle visible (default OFF — see all team)
- Ultra: Owner column shown; "Owner" filter dropdown lists all Pros + Basics in tree

**Status legend (color tokens):**
- 🟡 yellow: appointment, fact_finding, follow
- 🔵 blue: proposed
- 🟢 green: done, active
- ⚪ gray: deny, other

---

## 4. /clients/[id] (detail)

Master page for one client. Tabs along the top.

```
← Back to clients                                    [⚙ Edit profile]
─────────────────────────────────────────────────────────────────────

[Avatar]  คุณสมชาย ใจดี  ·  อายุ 35 · ชาย · เจ้าของกิจการ
          Status: 🟡 fact_finding · Last activity 2h ago · Owner: Me

[Overview] [Modules] [Status & Notes] [Reports]
═════════════════════════════════════════════════════════════════════

▼ Overview tab

  Snapshot
  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
  │ Net worth      │ │ Monthly cashflow│ │ Saving ratio   │
  │  ฿2.4M         │ │  +฿18,000       │ │   24%          │
  └────────────────┘ └────────────────┘ └────────────────┘

  Quick checkup status (modules complete)
  ┌──────────────────────────────────────────────────────────────┐
  │ ✅ Personal info        ✅ Cashflow        ⚠ Balance sheet  │
  │ ✅ Insurance            ❌ Retirement      ❌ Tax            │
  │ ❌ Education            ❌ Goals                              │
  └──────────────────────────────────────────────────────────────┘

  Latest report:  draft v3 (2 days ago) [Open] [Generate new]
```

```
▼ Modules tab

  ┌──────────────────────────────────────────────────────────────┐
  │ ▶ ข้อมูลส่วนตัว              ✅ complete       [Edit]       │
  └──────────────────────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────────────────────┐
  │ ▼ งบกระแสเงินสด               ✅ complete       [Edit]       │
  │   [embedded current /calculators/cashflow content here]     │
  └──────────────────────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────────────────────┐
  │ ▶ งบดุล                       ⚠ incomplete     [Edit]       │
  └──────────────────────────────────────────────────────────────┘
  ... (7 modules total: cashflow, balance, retirement, tax,
        insurance, education, goals)
```

```
▼ Status & Notes tab

  Current status
  ┌──────────────────────────────────────────────────────────────┐
  │ ( ) นัดทำแผน                                                  │
  │ (●) เก็บข้อมูลเรียบร้อย                                        │
  │ ( ) นำเสนอแผน                                                 │
  │ ( ) Done                                                      │
  │ ( ) Follow                                                    │
  │ ( ) Deny                                                      │
  │ ( ) Other → [____________________________________]           │
  │                                                               │
  │ Note (optional):                                              │
  │ ┌──────────────────────────────────────────────────────────┐│
  │ │ Met at coffee shop, gathered first round of paperwork.   ││
  │ │ Will call back next Tuesday for life insurance details.  ││
  │ └──────────────────────────────────────────────────────────┘│
  │                                                  [Save]      │
  └──────────────────────────────────────────────────────────────┘

  Last changed: 2h ago — moved from "appointment" to "fact_finding"
```

```
▼ Reports tab

  ┌──────────────────────────────────────────────────────────────┐
  │ Generated reports                            [+ Generate new]│
  │ ─────────────────────────────────────────────────────────── │
  │ 2 days ago — full plan v3                      [PDF] [Open] │
  │ 1 week ago — full plan v2                      [PDF] [Open] │
  │ 2 weeks ago — quick summary v1                 [PDF] [Open] │
  └──────────────────────────────────────────────────────────────┘
```

**Read-only behaviour for Pro/Ultra viewing a Basic's client:**
- "Edit" buttons hidden in Modules tab
- Status & Notes tab is read-only with banner: "View only — owned by Anucha"

---

## 5. /team

Pro and Ultra only. Hidden from sidebar for Basic.

```
Team management                                  [+ Invite member]
─────────────────────────────────────────────────────────────────

My team (4 members)
┌──────────────────────────────────────────────────────────────────┐
│ Name              fa_code   Joined    Clients   Last active     │
│ ─────────────────────────────────────────────────────────────── │
│ FA Basic Anucha   V8K3M2P   2 mo ago   18       2h ago          │
│ FA Basic Suda     VABC123   1 mo ago   14       1d ago          │
│ FA Basic Pong     VXYZ789   3 mo ago   9  ⚠     8d ago          │
│ FA Basic Mai      VFXR41Q   2 wk ago   22       3h ago          │
└──────────────────────────────────────────────────────────────────┘

⚠ Pong hasn't logged activity in 8 days

Invitations sent
┌──────────────────────────────────────────────────────────────────┐
│ Status      Invitee code    Sent       Expires       Actions    │
│ ─────────────────────────────────────────────────────────────── │
│ ⏳ pending   V0NEW01         2d ago     in 5 days    [Cancel]   │
│ ⏳ pending   V0NEW02         6h ago     in 6 days    [Cancel]   │
│ ✅ accepted  V8K3M2P         2 mo ago   —            —          │
│ ❌ rejected  V0NOPE1         1 mo ago   —            —          │
└──────────────────────────────────────────────────────────────────┘
```

### 5.1 Invite modal

Triggered by [+ Invite member]:

```
┌──────────────────────────────────────────────────────────────────┐
│  Invite a Basic FA to your team                            [✕]   │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  FA Code  [   V _ _ _ _ _ _   ]   [Lookup]                      │
│           ┌─ ✓ V8K3M2P → Anucha Sukjai ──────┐                  │
│           │  Tier: Basic                     │                  │
│           │  Currently in: no team           │                  │
│           └────────────────────────────────────┘                  │
│                                                                  │
│  Message (optional)                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Hi Anucha, I lead the Sukhumvit team — would love to    │   │
│  │ have you join us. Reach out if you have questions.       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Invitation expires in 7 days.                                   │
│                                                                  │
│                                       [Cancel]   [Send invite]   │
└──────────────────────────────────────────────────────────────────┘
```

**Validation (server-side on insert):**
- fa_code must resolve to an existing fa_profile
- Invitee tier must be exactly 1 below inviter's tier
- Invitee must not already have a team_lead_id (NULL only)
- No existing pending invitation between this pair

---

## 6. /inbox/invitations

```
Inbox                                                Invitations (1)
─────────────────────────────────────────────────────────────────

Pending
┌──────────────────────────────────────────────────────────────────┐
│ FA Pro Wiroj Sangsak                                             │
│ "Hi, looking for partners in Bangkok area"                       │
│ Sent 2 days ago · Expires in 5 days                              │
│                              [Reject]   [Accept and join team]   │
└──────────────────────────────────────────────────────────────────┘

History
┌──────────────────────────────────────────────────────────────────┐
│ ❌ rejected — FA Pro Tom Chana       3 weeks ago                 │
│ ✅ accepted — FA Pro Wong Phisut     6 months ago (since left)   │
│ ⏰ expired  — FA Pro Bee Niran        1 year ago                 │
└──────────────────────────────────────────────────────────────────┘
```

**Accept flow:**
1. Click "Accept and join team"
2. Confirmation modal: "You'll be joining Wiroj's team. Your clients
   will become visible to Wiroj. Continue?"
3. On confirm: invitation status → 'accepted', invitee's team_lead_id
   set to inviter, redirect to /dashboard

**Reject flow:**
1. Click "Reject"
2. No confirmation needed (lightweight action)
3. Invitation status → 'rejected'

---

## 7. /quick-plan (existing — minor rewire)

Already shipped at the URL. Phase 1 changes are tiny:

- Result page CTA "ดูแผนเต็มของ {layer}" — when user is logged in,
  links to `/clients/new?prefill=quickplan&dob=...&gender=...&income=...`
  instead of `/calculators/sales/{layer}`
- When user is NOT logged in: existing CTA stays ("ติดต่อ FA Victory")
- Banner at top of Step 1: drop the Victory branding (the page is now
  the public WealthPlanner front door, not a Victory-only thing)
- Otherwise: visual is unchanged

---

## 8. Component inventory

Components reused from current codebase (no rewrite):

| Component               | From                                  |
|-------------------------|---------------------------------------|
| ThaiDatePicker          | `src/components/ThaiDatePicker.tsx`   |
| MoneyInput              | `src/components/MoneyInput.tsx`       |
| Existing nav AppShell   | `src/components/AppShell.tsx`         |
| All planning calculators| `src/lib/finance/*`, `src/lib/insurance/*` |
| Pyramid layer pages     | `src/app/calculators/sales/*`         |
| Quick Plan flow         | `src/app/quick-plan/page.tsx`         |

New components to build for Phase 1:

| Component               | Used in                              |
|-------------------------|--------------------------------------|
| StatusBadge             | clients list, client detail, dashboard |
| StatusToggle            | client detail Status & Notes tab    |
| StatusBreakdownBar      | dashboard                            |
| TeamMemberRow           | dashboard team panel, /team list    |
| InvitationCard          | inbox, dashboard pending invites    |
| InviteByCodeForm        | /team modal                          |
| ModuleAccordion         | client detail Modules tab           |
| ActivityFeedItem        | dashboard recent activity           |

---

## 9. Out of wireframe scope (Phase 2)

Pages NOT wireframed because they're explicitly Phase 2:

- Client Portal (`/portal/*`)
- Plan Quality Checklist
- Scenario Comparison
- Coaching insights
- Pipeline kanban view
- AI insight panels
- Report Builder (Phase 1 = single template, generated from Reports tab)

---

## Changelog

- **2026-05-07 v1** — initial wireframes, all 6 Phase 1 pages.
