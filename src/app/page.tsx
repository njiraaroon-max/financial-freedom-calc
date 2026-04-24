"use client";

/**
 * Home — thin skin router.
 *
 * Picks which Home to render based on the FA's `skin` preference:
 *   - HomeLegacy (original radial dashboard, for skin='legacy')
 *   - HomePro    (new professional layout, for skin='professional')
 *
 * ── Anti-flash: why we render a splash first ──────────────────────
 *
 * This is a "use client" component, but Next.js still renders it
 * server-side for the initial HTML. That means ANY decision we make
 * based on `localStorage` or the session store runs server-first —
 * where `window` and the fresh Supabase row don't exist yet — and
 * produces HTML that the browser paints IMMEDIATELY. If that HTML
 * contained <HomeLegacy /> (the safe default), Pro users would see
 * the legacy layout flash on every cold load, no matter how fast
 * we read the skin cache during hydration.
 *
 * The fix: render a neutral splash for the first paint so the SSR
 * output commits to NEITHER home. Then `useLayoutEffect` runs
 * synchronously after hydration but BEFORE the browser paints again,
 * reads the cached skin from localStorage, and flips to the right
 * Home. Only the correct Home ever reaches the screen.
 *
 * Once `FaSessionSync` finishes, the real `session.skin` wins — so
 * the cache is only a first-render hint, not a source of truth. That
 * keeps admin-side skin flips honored within ~200ms of the next load.
 */

import { useEffect, useLayoutEffect, useState } from "react";
import {
  useFaSessionStore,
  readCachedSkin,
} from "@/store/fa-session-store";
import HomeLegacy from "@/components/home/HomeLegacy";
import HomePro from "@/components/home/HomePro";

// useLayoutEffect is SSR-unsafe (React warns + noops). Alias to
// useEffect on the server so the same line can run anywhere.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function HomePage() {
  const session = useFaSessionStore((s) => s.session);
  const [cachedSkin, setCachedSkin] = useState<
    "legacy" | "professional" | null
  >(null);
  const [ready, setReady] = useState(false);

  // Read the cache synchronously on mount, before the browser's
  // first post-hydration paint. This is the key line that turns the
  // "legacy flash" into "splash then correct home".
  useIsoLayoutEffect(() => {
    setCachedSkin(readCachedSkin());
    setReady(true);
  }, []);

  // SSR + pre-hydration render: splash. Matches HomePro's page bg
  // (ivory) so the transition for pro users is nearly invisible;
  // legacy users see a ~20ms ivory flash which is strictly nicer
  // than the previous legacy-snap-to-pro behaviour.
  if (!ready) {
    return (
      <div
        className="min-h-dvh"
        style={{ background: "#F6F8FB" }}
        aria-busy="true"
      />
    );
  }

  // Real session wins; cache is the fallback during the Supabase
  // round-trip; legacy is the final fallback for first-ever visits.
  const skin = session?.skin ?? cachedSkin ?? "legacy";
  return skin === "professional" ? <HomePro /> : <HomeLegacy />;
}
