"use client";

/**
 * AppShell — top-level layout wrapper.
 *
 * Renders a fixed left <Sidebar> for desktop (lg+) and offsets the main
 * content to match. On the print-only /report route, the shell steps
 * completely out of the way so the page can render at A4 width with
 * no navigation chrome.
 *
 * Below lg: the sidebar is hidden entirely and each page keeps its
 * existing header / bottom-tab navigation — no change to tablet-portrait
 * or narrower breakpoints.
 */

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const hideShell = pathname.startsWith("/report");

  if (hideShell) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-dvh">
      <Sidebar />
      <main className="lg:pl-[272px] min-h-dvh">{children}</main>
    </div>
  );
}
