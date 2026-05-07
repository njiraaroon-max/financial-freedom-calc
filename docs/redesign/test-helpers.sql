-- ============================================================
-- Phase 1 test helpers — set tier / inspect invitations
-- ============================================================
-- Use this in Supabase SQL Editor while building/testing /team
-- and /inbox/invitations. Each block is independent — paste only
-- the one you need.
-- ============================================================


-- ── 1. Promote myself to Pro ─────────────────────────────────
-- After running this, /team appears in the Sidebar and you can
-- send invitations. Replace the email if needed; one row update.
update public.fa_profiles
   set tier = 'pro'
 where email = 'YOUR_EMAIL_HERE@example.com';


-- ── 2. Promote myself to Ultra ───────────────────────────────
update public.fa_profiles
   set tier = 'ultra'
 where email = 'YOUR_EMAIL_HERE@example.com';


-- ── 3. Reset myself back to Basic ────────────────────────────
update public.fa_profiles
   set tier = 'basic',
       team_lead_id = null
 where email = 'YOUR_EMAIL_HERE@example.com';


-- ── 4. List all FAs with their tier + fa_code ────────────────
-- Useful to see who exists in the system + grab fa_codes for
-- invitation testing. Run as project owner (bypasses RLS).
select email, tier, fa_code, team_lead_id, role
  from public.fa_profiles
 order by tier desc, email;


-- ── 5. List all team invitations ─────────────────────────────
-- See pending / accepted / rejected / expired / cancelled rows.
select
  id,
  inviter_id,
  invitee_fa_code,
  invitee_id,
  status,
  message,
  created_at,
  responded_at,
  expires_at
from public.fa_team_invitations
order by created_at desc;


-- ── 6. Force-expire a stuck pending invitation ───────────────
-- If a pending invite never gets accepted/rejected, manually
-- bump it to expired so the inviter can re-send.
update public.fa_team_invitations
   set status = 'expired',
       responded_at = now()
 where status = 'pending'
   and expires_at < now();


-- ── 7. Manually bind a Basic to a Pro (no invite flow) ───────
-- Bypass the invitation flow — useful for quickly seeding a team
-- when testing the Pro dashboard. Replace the two emails.
update public.fa_profiles
   set team_lead_id = (
     select user_id from public.fa_profiles
      where email = 'PRO_EMAIL@example.com'
   )
 where email = 'BASIC_EMAIL@example.com';


-- ── 8. Detach a Basic from their Pro ─────────────────────────
update public.fa_profiles
   set team_lead_id = null
 where email = 'BASIC_EMAIL@example.com';
