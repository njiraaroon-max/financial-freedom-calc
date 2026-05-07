"use client";

/**
 * AppShell — top-level layout wrapper.
 *
 * Renders a fixed left <Sidebar> for desktop (lg+) and offsets the main
 * content by --sidebar-w (set by Sidebar based on pinned collapsed state).
 *
 * On the print-only /report route, the shell steps completely out of the
 * way so the page can render at A4 width with no navigation chrome.
 *
 * Below lg: the sidebar is hidden entirely and each page keeps its
 * existing header / bottom-tab navigation.
 */

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import SidebarPro from "./SidebarPro";
import UserMenu from "./UserMenu";
import ClientDataSync from "./ClientDataSync";
import FaSessionSync from "./FaSessionSync";
import { useFaSessionStore, readCachedSkin } from "@/store/fa-session-store";

// useLayoutEffect warns under SSR. This shim aliases it to useEffect
// on the server so the same hook call is safe in both environments.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";

  // Anti-flash sidebar: see page.tsx for the full explanation. Short
  // version — useState lazy initializers run server-side for "use
  // client" components, so `localStorage` isn't available when the
  // first HTML is built. Reading the cache here inside a layout
  // effect instead ensures the first POST-HYDRATION paint already
  // reflects the correct skin (legacy vs pro), so the sidebar
  // doesn't flash the wrong variant.
  const [cachedSkin, setCachedSkin] = useState<
    "legacy" | "professional" | null
  >(null);
  useIsoLayoutEffect(() => {
    setCachedSkin(readCachedSkin());
  }, []);

  // Read the live session directly (not via useSkin) so we can
  // distinguish "not loaded yet" (session=null, fall through to
  // cache) from "loaded and legacy" (session.skin='legacy', do NOT
  // fall through).
  const sessionSkin = useFaSessionStore((s) => s.session?.skin ?? null);
  const skin = sessionSkin ?? cachedSkin ?? "legacy";
  const hideShell =
    pathname.startsWith("/report") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/pending-approval");

  if (hideShell) {
    return <>{children}</>;
  }

  // Sidebar is now visible on EVERY authenticated route, including
  // the home (`/`) page. Earlier the professional skin hid it on
  // `/` so HomePro could render a full-width hero — but with 200
  // FAs landing cold next week, persistent navigation beats a
  // cinematic landing. The hero just absorbs the sidebar offset
  // like every other page.
  //
  // SidebarPro (the 68px navy-and-gold rail) stays imported but
  // unrendered — kept around for a future opt-in toggle.
  const SidebarComponent = Sidebar;
  void SidebarPro;
  void skin;
  void pathname;

  return (
    <div className="relative min-h-dvh isolate">
      {/* Main padding follows the pinned sidebar width (default 17rem
          / 272px). Hover-expand is overlay-only so content does NOT
          shift when the user hovers the rail. */}
      <main className="relative z-0 min-h-dvh transition-[padding] duration-200 ease-out lg:pl-[var(--sidebar-w,17rem)]">
        {children}
      </main>
      <SidebarComponent />
      <UserMenu />
      <ClientDataSync />
      <FaSessionSync />
    </div>
  );
}
