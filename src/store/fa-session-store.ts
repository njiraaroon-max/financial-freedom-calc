"use client";

/**
 * FA Session Store — the signed-in FA's own profile row + their organization.
 *
 * Separate from `useProfileStore` (which holds *client* demographics, not FA
 * account data). This store is loaded once per session by `FaSessionSync`
 * after login and refreshed when the auth user changes.
 *
 * Read-only from a component's perspective: if you need to mutate fields
 * like `skin`, `features`, or `organization_id`, go through the admin page
 * (those fields are guarded by `protect_role_status` trigger anyway).
 * `planning_mode` is the only field an FA can change themselves — the
 * setter below writes straight to Supabase and mirrors into local state.
 *
 * Not persisted to localStorage: every session re-fetches from Supabase
 * so we never serve stale `skin` / `features` if an admin just updated them.
 */

import { create } from "zustand";
import type {
  FeatureFlags,
  PlanningMode,
  Skin,
} from "@/lib/supabase/database.types";

/** Shape used by the rest of the app — a flat merge of fa_profiles + org. */
export interface FaSession {
  userId: string;
  email: string;
  displayName: string | null;
  role: "fa" | "admin";
  status: "pending" | "approved" | "rejected";
  expiresAt: string | null;

  // Multi-tenant fields (from migration 007)
  skin: Skin;
  planningMode: PlanningMode;
  features: FeatureFlags;

  organization: {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    logoUrl: string | null;
    logoDarkUrl: string | null;
    faviconUrl: string | null;
    colorPrimary: string;
    colorPrimaryDark: string | null;
    colorAccent: string | null;
    fontDisplay: string | null;
    fontBody: string | null;
    defaultSkin: Skin;
    navConfig: Record<string, unknown>;
  };
}

interface FaSessionState {
  session: FaSession | null;
  loading: boolean;
  error: string | null;

  /**
   * Demo Mode — when true, sales-mode UIs (Victory Pyramid layers)
   * scope all input edits to local component state instead of writing
   * back to the global profile/insurance stores. Used by Victory FAs
   * who want to demo the calculators to a prospect (not a client)
   * without polluting the real client's saved data.
   *
   * Stored in-memory only — not persisted, not synced to Supabase.
   * Resets to false on every page reload (safer default = "Real").
   *
   * UI surface: toggle in the Settings menu, with a visible badge in
   * the Pyramid header so the customer can SEE that their data isn't
   * being saved (trust signal: "Demo · ไม่บันทึก").
   */
  demoMode: boolean;

  // Set the whole session (called by FaSessionSync after fetch).
  setSession: (session: FaSession | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Local mirror of a successful Supabase update. DOES NOT write to the DB —
  // the caller (a profile-settings page) is responsible for that; we only
  // mirror on success so the UI reflects the change immediately.
  setPlanningMode: (mode: PlanningMode) => void;

  setDemoMode: (demoMode: boolean) => void;

  clear: () => void;
}

export const useFaSessionStore = create<FaSessionState>((set) => ({
  session: null,
  loading: true, // start in loading state — no session until FaSessionSync resolves
  error: null,
  demoMode: false, // safe default — Real Mode unless FA explicitly toggles

  setSession: (session) => set({ session, loading: false, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),

  setPlanningMode: (mode) =>
    set((state) =>
      state.session
        ? { session: { ...state.session, planningMode: mode } }
        : state,
    ),

  setDemoMode: (demoMode) => set({ demoMode }),

  // Always reset demo mode on sign-out so the next FA doesn't inherit it.
  clear: () => set({ session: null, loading: false, error: null, demoMode: false }),
}));

// ─── Convenience selectors ──────────────────────────────────────────────
// Import these into components instead of subscribing to the whole store,
// so React only re-renders when the specific field changes.

/** `'legacy' | 'professional'` — drives which Home page is rendered. */
export const useSkin = () =>
  useFaSessionStore((s) => s.session?.skin ?? "legacy");

/** `'modular' | 'comprehensive'` — default planning flow. */
export const usePlanningMode = () =>
  useFaSessionStore((s) => s.session?.planningMode ?? "comprehensive");

/**
 * Read one feature flag. Returns `false` (or the supplied fallback) if the
 * session isn't loaded yet — safer default than `true` because it means
 * gated UI stays hidden during the loading flicker.
 */
export function useFeatureFlag(
  key: keyof FeatureFlags,
  fallback: boolean = false,
): boolean {
  return useFaSessionStore((s) => {
    const value = s.session?.features?.[key];
    return typeof value === "boolean" ? value : fallback;
  });
}

/** Numeric feature flag reader (e.g. `client_limit`). */
export function useFeatureNumber(
  key: keyof FeatureFlags,
  fallback: number = 0,
): number {
  return useFaSessionStore((s) => {
    const value = s.session?.features?.[key];
    return typeof value === "number" ? value : fallback;
  });
}

/** Organization branding for CSS-variable injection + logo/navbar UIs. */
export const useOrganization = () =>
  useFaSessionStore((s) => s.session?.organization ?? null);

/**
 * Demo Mode — true when the FA has flipped to "Demo" in the Settings
 * menu. Sales-mode UIs (Victory Pyramid layers) check this before
 * writing edits back to the shared profile/insurance stores; in Demo
 * Mode they keep edits in component-local state only, so a prospect
 * demo doesn't pollute a real client's saved record.
 */
export const useDemoMode = () => useFaSessionStore((s) => s.demoMode);

// ─── Skin cache (anti-flash) ────────────────────────────────────────────
// We deliberately don't persist the whole session (see top-of-file note —
// admins need to be able to flip an FA's skin server-side and have it
// take effect on next login, so the auth-gated DB row is the source of
// truth). But caching just the `skin` string is safe: it's not sensitive,
// it changes rarely, and without it every cold page load flashes the
// wrong Home component for 100–500ms while FaSessionSync awaits Supabase.
//
// Flow:
//   1. FaSessionSync writes the fresh skin to localStorage on each
//      successful load (and clears it on sign-out).
//   2. page.tsx reads this synchronously on the first render to pick
//      which Home to show while `loading` is still true.

const SKIN_CACHE_KEY = "ffc-skin-cache";

/** Reads the cached skin synchronously. Safe during SSR (returns null). */
export function readCachedSkin(): Skin | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(SKIN_CACHE_KEY);
    return v === "professional" || v === "legacy" ? v : null;
  } catch {
    return null;
  }
}

/** Writes (or clears) the skin cache. Called by FaSessionSync only. */
export function writeCachedSkin(skin: Skin | null): void {
  if (typeof window === "undefined") return;
  try {
    if (skin) window.localStorage.setItem(SKIN_CACHE_KEY, skin);
    else window.localStorage.removeItem(SKIN_CACHE_KEY);
  } catch {
    /* ignore */
  }
}
