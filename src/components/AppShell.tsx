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

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import UserMenu from "./UserMenu";
import ClientDataSync from "./ClientDataSync";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const hideShell =
    pathname.startsWith("/report") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth");

  if (hideShell) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-dvh isolate">
      {/* Main padding follows the pinned sidebar width (default 17rem / 272px).
          Hover-expand is overlay-only so content does NOT shift when hovering. */}
      <main
        className="relative z-0 min-h-dvh transition-[padding] duration-200 ease-out lg:pl-[var(--sidebar-w,17rem)]"
      >
        {children}
      </main>
      <Sidebar />
      <UserMenu />
      <ClientDataSync />
    </div>
  );
}
