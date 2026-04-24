"use client";

/**
 * FaSessionSync — loads the signed-in FA's profile + their organization
 * from Supabase and mirrors them into `useFaSessionStore`.
 *
 * Mounts once in AppShell (behind the pathname gate, so it doesn't fire
 * on /login, /signup, etc.). Responsibilities:
 *
 *  1. Read the current auth user from Supabase.
 *  2. Join `fa_profiles` → `organizations` in a single query (RLS allows
 *     each user to read their own row + their own org).
 *  3. Shape the result into the flat `FaSession` object the store exposes.
 *  4. Inject the org's colors + fonts as CSS variables on <html> so any
 *     professional-skin component can reference them with `var(--brand-…)`.
 *  5. Listen for auth changes (`onAuthStateChange`) so sign-out clears
 *     the session and sign-in on a different account reloads.
 *
 * Renders nothing — pure side effect.
 */

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  useFaSessionStore,
  writeCachedSkin,
  type FaSession,
} from "@/store/fa-session-store";
import type { FeatureFlags } from "@/lib/supabase/database.types";

/** Nested shape returned by the joined select below. */
interface JoinedRow {
  user_id: string;
  email: string;
  display_name: string | null;
  role: "fa" | "admin";
  status: "pending" | "approved" | "rejected";
  expires_at: string | null;
  skin: "legacy" | "professional";
  planning_mode: "modular" | "comprehensive";
  features: FeatureFlags | null;
  organization_id: string;
  organizations: {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    logo_url: string | null;
    logo_dark_url: string | null;
    favicon_url: string | null;
    color_primary: string;
    color_primary_dark: string | null;
    color_accent: string | null;
    font_display: string | null;
    font_body: string | null;
    default_skin: "legacy" | "professional";
    nav_config: Record<string, unknown> | null;
  } | null;
}

function shape(row: JoinedRow): FaSession | null {
  if (!row.organizations) return null; // RLS missed or org deleted — treat as signed-out
  const o = row.organizations;
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    expiresAt: row.expires_at,
    skin: row.skin,
    planningMode: row.planning_mode,
    features: row.features ?? {},
    organization: {
      id: o.id,
      slug: o.slug,
      name: o.name,
      tagline: o.tagline,
      logoUrl: o.logo_url,
      logoDarkUrl: o.logo_dark_url,
      faviconUrl: o.favicon_url,
      colorPrimary: o.color_primary,
      colorPrimaryDark: o.color_primary_dark,
      colorAccent: o.color_accent,
      fontDisplay: o.font_display,
      fontBody: o.font_body,
      defaultSkin: o.default_skin,
      navConfig: o.nav_config ?? {},
    },
  };
}

/**
 * Paint org-branded CSS variables on <html> so any child can read them
 * via `var(--brand-primary)` etc. Falls back to the legacy indigo palette
 * when no session is loaded, so the pre-login / pending pages still look
 * sane. Done imperatively (rather than via a provider + className) so a
 * brand refresh doesn't require every page to opt in.
 */
function applyBrandCssVars(session: FaSession | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const o = session?.organization;
  root.style.setProperty("--brand-primary", o?.colorPrimary ?? "#6366f1");
  root.style.setProperty(
    "--brand-primary-dark",
    o?.colorPrimaryDark ?? "#4f46e5",
  );
  root.style.setProperty("--brand-accent", o?.colorAccent ?? "#a5b4fc");
  // Fonts are exposed so Tailwind arbitrary values (`font-[var(--brand-font-display)]`)
  // or plain inline styles can pick them up. Google Fonts loading itself is
  // handled per-layout (see layout.tsx — we keep IBM Plex Sans Thai as the
  // safe default and let professional-skin pages opt into Oswald/Sarabun).
  root.style.setProperty(
    "--brand-font-display",
    o?.fontDisplay ? `"${o.fontDisplay}"` : "inherit",
  );
  root.style.setProperty(
    "--brand-font-body",
    o?.fontBody ? `"${o.fontBody}"` : "inherit",
  );

  // ── Professional-skin global token override ────────────────────
  // `--color-primary` (and its light/dark siblings) is hardcoded to the
  // app's default indigo (#6366f1) in globals.css. Every legacy page —
  // calculators, sidebar, summary, buttons, radios — reads from that
  // token. When the FA is on the professional skin, we want those same
  // surfaces to take the ORG's brand colors (navy for Victory) instead
  // of the default indigo, so the whole app looks cohesively branded.
  //
  // Rather than rewriting every page, we flip the tokens here in a
  // single place. Legacy users (`skin === 'legacy'`) fall through to
  // the ELSE branch where we reset tokens to their original indigo
  // so their UI stays pixel-identical to what they had before.
  if (session?.skin === "professional" && o) {
    root.style.setProperty("--color-primary", o.colorPrimary);
    root.style.setProperty(
      "--color-primary-dark",
      o.colorPrimaryDark ?? o.colorPrimary,
    );
    root.style.setProperty(
      "--color-primary-light",
      o.colorAccent ?? o.colorPrimary,
    );
  } else {
    // Restore defaults — matters when a user signs out of professional
    // and back in as legacy within the same tab, or for pre-login pages.
    root.style.setProperty("--color-primary", "#6366f1");
    root.style.setProperty("--color-primary-dark", "#4f46e5");
    root.style.setProperty("--color-primary-light", "#818cf8");
  }
}

export default function FaSessionSync() {
  const setSession = useFaSessionStore((s) => s.setSession);
  const setLoading = useFaSessionStore((s) => s.setLoading);
  const setError = useFaSessionStore((s) => s.setError);
  const clear = useFaSessionStore((s) => s.clear);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function loadFor(userId: string | null) {
      if (!userId) {
        clear();
        applyBrandCssVars(null);
        writeCachedSkin(null);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("fa_profiles")
          .select(
            `
            user_id, email, display_name, role, status, expires_at,
            skin, planning_mode, features, organization_id,
            organizations (
              id, slug, name, tagline,
              logo_url, logo_dark_url, favicon_url,
              color_primary, color_primary_dark, color_accent,
              font_display, font_body,
              default_skin, nav_config
            )
          `,
          )
          .eq("user_id", userId)
          .maybeSingle<JoinedRow>();

        if (cancelled) return;
        if (error) throw error;
        if (!data) {
          // Row might not exist yet — the handle_new_user trigger creates
          // it on signup, but in rare bootstrap cases (eg. SQL-created
          // auth user) it may not. Treat as signed-out rather than crash.
          clear();
          applyBrandCssVars(null);
          writeCachedSkin(null);
          return;
        }

        const session = shape(data);
        setSession(session);
        applyBrandCssVars(session);
        // Cache the skin so the next cold load picks the right Home
        // component synchronously, before this Supabase call finishes.
        writeCachedSkin(session?.skin ?? null);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : "Failed to load FA session";
        console.error("[FaSessionSync]", err);
        setError(msg);
        applyBrandCssVars(null);
      }
    }

    // Initial load
    supabase.auth.getUser().then(({ data }) => {
      void loadFor(data.user?.id ?? null);
    });

    // React to sign-in / sign-out / token refresh
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadFor(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // Store setters are stable references; we deliberately do NOT depend on
    // anything that would re-subscribe on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
