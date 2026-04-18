"use client";

/**
 * Sidebar — fixed left navigation rail for desktop (≥1024px / lg).
 *
 * Two modes:
 *  - Expanded (pinned, default)   → 272px, icons + labels
 *  - Collapsed (pinned)           →  64px, icons only, hover grows back to 272 as overlay
 *
 * Pin state persists in localStorage. Hover-expand is an overlay:
 * it does NOT push the main content, so pages don't jump.
 *
 * Always hidden below `lg:`. Rendered by <AppShell>, which skips on /report.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home,
  UserCircle,
  Target,
  Wallet,
  Scale,
  ShieldAlert,
  Palmtree,
  Receipt,
  Shield,
  GraduationCap,
  LineChart,
  LayoutGrid,
  HeartPulse,
  FileText,
  Users,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useProfileStore } from "@/store/profile-store";

const STORAGE_KEY = "ffc-sidebar-collapsed";
const EXPANDED_W = "17rem"; // 272px
const COLLAPSED_W = "4rem"; //  64px

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  color?: string;
}

const MAIN_NAV: NavItem[] = [
  { name: "ข้อมูลส่วนตัว", href: "/calculators/personal-info", icon: UserCircle, color: "text-rose-500" },
  { name: "เป้าหมายชีวิต", href: "/calculators/goals", icon: Target, color: "text-amber-500" },
  { name: "Cash Flow", href: "/calculators/cashflow", icon: Wallet, color: "text-indigo-500" },
  { name: "Balance Sheet", href: "/calculators/balance-sheet", icon: Scale, color: "text-purple-500" },
  { name: "เงินสำรองฉุกเฉิน", href: "/calculators/emergency-fund", icon: ShieldAlert, color: "text-teal-500" },
  { name: "เกษียณ", href: "/calculators/retirement", icon: Palmtree, color: "text-cyan-500" },
  { name: "ภาษี", href: "/calculators/tax", icon: Receipt, color: "text-violet-500" },
  { name: "จัดการความเสี่ยง", href: "/calculators/insurance", icon: Shield, color: "text-emerald-500" },
  { name: "การศึกษาบุตร", href: "/calculators/education", icon: GraduationCap, color: "text-blue-500" },
  { name: "CF Projection", href: "/calculators/cf-projection", icon: LineChart, color: "text-sky-500" },
];

const REPORTS_NAV: NavItem[] = [
  { name: "สรุปแผน", href: "/summary", icon: LayoutGrid, color: "text-indigo-500" },
  { name: "สุขภาพทางการเงิน", href: "/financial-health", icon: HeartPulse, color: "text-emerald-500" },
  { name: "รายงาน (Report)", href: "/report", icon: FileText, color: "text-slate-600" },
];

export default function Sidebar() {
  const pathname = usePathname() || "/";
  const profile = useProfileStore();
  const firstName = profile.name ? profile.name.split(" ")[0] : "";

  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [mounted, setMounted] = useState(false);
  // When the user clicks the toggle to collapse, their cursor is still
  // inside the sidebar so `hovered` stays true and the rail would refuse
  // to shrink. Suppress hover-expand until the mouse leaves once.
  const [suppressHover, setSuppressHover] = useState(false);

  // Read persisted pin state on mount
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  // Persist + update --sidebar-w so AppShell <main> can respond
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
    document.documentElement.style.setProperty(
      "--sidebar-w",
      collapsed ? COLLAPSED_W : EXPANDED_W
    );
  }, [collapsed, mounted]);

  // Visual expansion = pinned-open OR (mouse hovering AND not just-collapsed)
  const expanded = !collapsed || (hovered && !suppressHover);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        // Mouse left the rail — future hovers should expand again
        setSuppressHover(false);
      }}
      aria-label="Main navigation"
      data-expanded={expanded}
      className={`hidden lg:flex fixed left-0 top-0 h-dvh glass-strong border-r border-white/40 flex-col z-[9000] overflow-y-auto overflow-x-hidden transition-[width] duration-200 ease-out ${
        collapsed && hovered ? "shadow-2xl shadow-indigo-900/20" : ""
      }`}
      style={{ width: expanded ? EXPANDED_W : COLLAPSED_W }}
    >
      {/* ── Brand + toggle row ───────────────────────────────── */}
      <div className="flex items-center gap-1 px-2 pt-3 pb-1">
        <Link
          href="/"
          className={`flex items-center gap-2.5 flex-1 min-w-0 py-2 px-2 rounded-xl transition ${
            pathname === "/" ? "bg-white/60" : "hover:bg-white/40"
          }`}
        >
          <img
            src="/character/icon-home.png"
            alt="Financial Friend"
            className="w-9 h-9 object-contain shrink-0 drop-shadow"
          />
          <div
            className={`min-w-0 overflow-hidden whitespace-nowrap transition-opacity duration-150 ${
              expanded ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="text-[13px] font-bold leading-tight truncate">
              Financial Friend
            </div>
            <div className="text-[10px] text-gray-500">วางแผนแบบองค์รวม</div>
          </div>
        </Link>
        <button
          onClick={() => {
            // If we're about to collapse, suppress hover so the rail
            // visually shrinks even though the mouse is still on it.
            if (!collapsed) setSuppressHover(true);
            setCollapsed((c) => !c);
          }}
          aria-label={collapsed ? "ขยาย sidebar" : "ยุบ sidebar"}
          title={collapsed ? "ขยาย sidebar" : "ยุบ sidebar"}
          className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-white/60 transition ${
            expanded ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      {/* ── User chip ───────────────────────────────────────── */}
      {firstName && (
        <Link
          href="/profile"
          title={`คุณ${firstName} — ดูโปรไฟล์`}
          className={`flex items-center gap-3 mx-2 mt-1 px-2.5 py-2 rounded-xl transition ${
            isActive("/profile") ? "bg-white/60" : "hover:bg-white/40"
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <div
            className={`flex-1 min-w-0 overflow-hidden whitespace-nowrap transition-opacity duration-150 ${
              expanded ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="text-xs font-semibold truncate">คุณ{firstName}</div>
            <div className="text-[10px] text-gray-500">ดูโปรไฟล์</div>
          </div>
        </Link>
      )}

      {/* ── Nav groups ──────────────────────────────────────── */}
      <div className="mx-2 mt-3">
        <NavGroup label="หน้าหลัก" expanded={expanded}>
          <NavRow
            item={{ name: "Dashboard", href: "/", icon: Home, color: "text-indigo-500" }}
            active={pathname === "/"}
            expanded={expanded}
          />
        </NavGroup>

        <NavGroup label="Modules" expanded={expanded}>
          {MAIN_NAV.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} expanded={expanded} />
          ))}
        </NavGroup>

        <NavGroup label="Reports" expanded={expanded}>
          {REPORTS_NAV.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} expanded={expanded} />
          ))}
        </NavGroup>
      </div>

      {/* ── Footer — clients ────────────────────────────────── */}
      <div className="mt-auto mx-2 mb-3">
        <NavGroup expanded={expanded}>
          <NavRow
            item={{ name: "จัดการลูกค้า", href: "/clients", icon: Users, color: "text-gray-500" }}
            active={isActive("/clients")}
            expanded={expanded}
          />
        </NavGroup>
        <div
          className={`px-3 pt-2 text-[9px] text-gray-400 text-center overflow-hidden whitespace-nowrap transition-opacity ${
            expanded ? "opacity-100" : "opacity-0"
          }`}
        >
          v1.0 · Financial Friend
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function NavGroup({
  label,
  expanded,
  children,
}: {
  label?: string;
  expanded: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      {label && (
        <div
          className={`text-[10px] uppercase tracking-wider font-bold text-gray-400 px-3 pt-3 pb-1 overflow-hidden whitespace-nowrap transition-opacity duration-150 ${
            expanded ? "opacity-100 h-auto" : "opacity-0 h-0 pt-0 pb-0"
          }`}
        >
          {label}
        </div>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function NavRow({
  item,
  active,
  expanded,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.name}
      className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg transition text-sm whitespace-nowrap ${
        active
          ? "bg-white/70 text-gray-900 font-semibold shadow-sm"
          : "text-gray-700 hover:bg-white/40"
      }`}
    >
      {/* Active indicator bar on the far left — visible in both states */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-indigo-500" />
      )}
      <Icon
        size={18}
        className={`${item.color || "text-gray-500"} shrink-0 ${
          active ? "" : "opacity-80 group-hover:opacity-100"
        }`}
      />
      <span
        className={`truncate overflow-hidden transition-opacity duration-150 ${
          expanded ? "opacity-100" : "opacity-0"
        }`}
      >
        {item.name}
      </span>
    </Link>
  );
}
