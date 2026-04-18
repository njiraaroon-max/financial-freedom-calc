"use client";

/**
 * Sidebar — fixed left navigation rail for desktop (≥1024px / lg).
 *
 * Always hidden below `lg:` so iPad-portrait and phone fall back to each
 * page's own header + the home RadialDashboard's bottom tabs.
 *
 * Rendered by <AppShell>, which skips rendering on /report (print layout).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { useProfileStore } from "@/store/profile-store";

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

  // A path is active if it matches exactly or starts with it + "/"
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className="hidden lg:flex fixed left-0 top-0 h-dvh w-[272px] glass-strong border-r border-white/40 flex-col z-30 overflow-y-auto"
      aria-label="Main navigation"
    >
      {/* Brand */}
      <Link
        href="/"
        className={`flex items-center gap-3 px-4 py-4 mx-2 mt-3 rounded-xl transition ${
          pathname === "/" ? "bg-white/60" : "hover:bg-white/40"
        }`}
      >
        <img
          src="/character/icon-home.png"
          alt="Financial Friend"
          className="w-11 h-11 object-contain drop-shadow"
        />
        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight">Financial Friend</div>
          <div className="text-[10px] text-gray-500 mt-0.5">วางแผนแบบองค์รวม</div>
        </div>
      </Link>

      {/* User profile chip */}
      {firstName && (
        <Link
          href="/profile"
          className={`flex items-center gap-3 mx-2 mt-2 px-3 py-2.5 rounded-xl transition ${
            isActive("/profile") ? "bg-white/60" : "hover:bg-white/40"
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate">คุณ{firstName}</div>
            <div className="text-[10px] text-gray-500">ดูโปรไฟล์</div>
          </div>
        </Link>
      )}

      {/* Home link — only show when not on home */}
      <div className="mx-2 mt-3">
        <NavGroup label="หน้าหลัก">
          <NavRow item={{ name: "Dashboard", href: "/", icon: Home, color: "text-indigo-500" }} active={pathname === "/"} />
        </NavGroup>

        <NavGroup label="Modules">
          {MAIN_NAV.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </NavGroup>

        <NavGroup label="Reports">
          {REPORTS_NAV.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </NavGroup>
      </div>

      {/* Footer — client list */}
      <div className="mt-auto mx-2 mb-3">
        <NavGroup>
          <NavRow
            item={{ name: "จัดการลูกค้า", href: "/clients", icon: Users, color: "text-gray-500" }}
            active={isActive("/clients")}
          />
        </NavGroup>
        <div className="px-3 pt-2 text-[9px] text-gray-400 text-center">
          v1.0 · Financial Friend
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function NavGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      {label && (
        <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400 px-3 pt-3 pb-1">
          {label}
        </div>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition text-sm ${
        active
          ? "bg-white/70 text-gray-900 font-semibold shadow-sm"
          : "text-gray-700 hover:bg-white/40"
      }`}
    >
      <Icon
        size={17}
        className={`${item.color || "text-gray-500"} shrink-0 ${
          active ? "" : "opacity-80 group-hover:opacity-100"
        }`}
      />
      <span className="truncate">{item.name}</span>
      {active && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />
      )}
    </Link>
  );
}
