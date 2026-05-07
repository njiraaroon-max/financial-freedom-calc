"use client";

/**
 * SidebarPro — luxury private-banking icon rail for the professional skin.
 *
 * Unlike the legacy Sidebar (which has a full 272px expanded state + pin
 * toggle + colorful per-icon tints), this rail is:
 *
 *   • 68px wide, constant — no pin, no hover-expand. The composition
 *     reads as a navy "chrome strip" next to the content, not a
 *     drawer. This matches the Bloomberg / UBS-Neo / JP-Morgan-Wealth
 *     aesthetic where navigation recedes so the data surface leads.
 *
 *   • Deep navy gradient background (brand-primary-dark → brand-primary)
 *     so it functions as a dark frame around the light ivory canvas.
 *     The dark rail gives the whole pro experience a sense of
 *     "stepping into a private office" — very different from the
 *     glassy white legacy rail.
 *
 *   • Gold accents only — champagne left-bar + icon tint for active
 *     state, plus an ultra-thin gold hairline between nav groups.
 *     No multi-color icon palette: luxury brands restrict to 2-3
 *     hues, and we use navy + gold + ivory.
 *
 *   • Mode-aware: when the FA is in `modular` planning mode, only the
 *     5 modular tools are listed. In `comprehensive` mode the full
 *     12-tool catalogue shows. This keeps the rail consistent with
 *     whatever HomePro advertises — no orphan tools in the sidebar
 *     that aren't in the landing.
 *
 *   • Tooltips use the native `title=` attribute. An absolute-positioned
 *     custom tooltip gets clipped because the rail has overflow-y:auto
 *     (once any overflow axis is auto/scroll, the other axis can't be
 *     truly visible). Native tooltip is boring but robust and keeps
 *     the markup clean.
 *
 * AppShell only mounts this when `skin === "professional"` AND the
 * current route is NOT the HomePro landing (where the hero wants the
 * full viewport). So the rail follows the FA everywhere *except* that
 * single cinematic moment.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
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
  Inbox,
  CreditCard,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  useOrganization,
  usePlanningMode,
  useCanManageTeam,
} from "@/store/fa-session-store";

const RAIL_W = "4.25rem"; // 68px — just wide enough for a 40px button + 14px padding each side.
const GOLD = "#D6B56D";
const GOLD_SOFT = "rgba(214,181,109,0.12)";
const HAIRLINE = "rgba(214,181,109,0.16)";

interface Item {
  name: string;
  href: string;
  icon: LucideIcon;
}

// ─── Tool catalogues — mirror HomePro so Modular/Comprehensive mode
//     advertises the same tools the sidebar lists. Order mirrors
//     HomePro's 4-pillar Foundation → Protection → Optimization →
//     Future Planning grouping, collapsed into a single scroll.
const TOOLS_COMPREHENSIVE: Item[] = [
  { name: "ข้อมูลส่วนตัว", href: "/calculators/personal-info", icon: UserCircle },
  { name: "เป้าหมายชีวิต", href: "/calculators/goals", icon: Target },
  { name: "Cash Flow", href: "/calculators/cashflow", icon: Wallet },
  { name: "Balance Sheet", href: "/calculators/balance-sheet", icon: Scale },
  { name: "เงินสำรองฉุกเฉิน", href: "/calculators/emergency-fund", icon: ShieldAlert },
  { name: "จัดการความเสี่ยง", href: "/calculators/insurance", icon: Shield },
  { name: "ภาษี", href: "/calculators/tax", icon: Receipt },
  { name: "วางแผนปลดหนี้", href: "/calculators/debt", icon: CreditCard },
  { name: "ลงทุนเพื่อเป้าหมาย", href: "/calculators/investment", icon: TrendingUp },
  { name: "เกษียณ", href: "/calculators/retirement", icon: Palmtree },
  { name: "การศึกษาบุตร", href: "/calculators/education", icon: GraduationCap },
  { name: "CF Projection", href: "/calculators/cf-projection", icon: LineChart },
];

const TOOLS_MODULAR: Item[] = [
  { name: "ข้อมูลส่วนตัว", href: "/calculators/personal-info", icon: UserCircle },
  { name: "จัดการความเสี่ยง", href: "/calculators/insurance", icon: Shield },
  { name: "ภาษี", href: "/calculators/tax", icon: Receipt },
  { name: "เกษียณ", href: "/calculators/retirement", icon: Palmtree },
  { name: "การศึกษาบุตร", href: "/calculators/education", icon: GraduationCap },
];

const REPORTS: Item[] = [
  { name: "สรุปแผน", href: "/summary", icon: LayoutGrid },
  { name: "สุขภาพทางการเงิน", href: "/financial-health", icon: HeartPulse },
  { name: "รายงาน (Report)", href: "/report", icon: FileText },
];

export default function SidebarPro() {
  const pathname = usePathname() || "/";
  const org = useOrganization();
  const mode = usePlanningMode();
  const canManageTeam = useCanManageTeam();
  const tools = mode === "modular" ? TOOLS_MODULAR : TOOLS_COMPREHENSIVE;
  const brandLogo = org?.logoUrl ?? null;

  // Tell <AppShell> how much left-padding to reserve for <main>. The
  // shell reads `--sidebar-w` from the root element and pads accordingly.
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", RAIL_W);
    return () => {
      document.documentElement.style.removeProperty("--sidebar-w");
    };
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      aria-label="Main navigation"
      className="hidden lg:flex fixed left-0 top-0 h-dvh flex-col items-center z-[9000] overflow-y-auto"
      style={{
        width: RAIL_W,
        // Vertical navy gradient — darker at top, slightly lifted at
        // bottom. Pairs with the hero so the rail feels like the same
        // material continuing up from the homepage.
        background:
          "linear-gradient(180deg, var(--color-primary-dark, #041833) 0%, var(--color-primary, #062B5F) 100%)",
        // Right-edge gold hairline + soft drop shadow to separate rail
        // from the ivory main content.
        boxShadow:
          "inset -1px 0 0 rgba(214,181,109,0.12), 6px 0 24px rgba(0,0,0,0.18)",
      }}
    >
      {/* Brand tile — tenant logo if available, else a Home glyph.
          Clicks to "/" (HomePro). Small (28px image inside 40px tile)
          so it reads as a mark, not a banner. */}
      <Link
        href="/"
        title={org?.name ?? "Dashboard"}
        aria-label={org?.name ?? "Dashboard"}
        className="mt-4 mb-3 flex items-center justify-center w-10 h-10 rounded-xl transition hover:bg-white/10"
      >
        {brandLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brandLogo}
            alt={org?.name ?? "Organization"}
            className="w-7 h-7 object-contain drop-shadow"
          />
        ) : (
          <Home size={20} className="text-white/80" />
        )}
      </Link>

      <Hairline />

      {/* Dashboard */}
      <div className="flex flex-col items-center gap-1 py-2">
        <RailButton
          item={{ name: "Dashboard", href: "/", icon: Home }}
          active={pathname === "/"}
        />
      </div>

      <Hairline />

      {/* Tools (mode-filtered) */}
      <div className="flex flex-col items-center gap-1 py-2">
        {tools.map((it) => (
          <RailButton
            key={it.href}
            item={it}
            active={isActive(it.href)}
          />
        ))}
      </div>

      <Hairline />

      {/* Reports */}
      <div className="flex flex-col items-center gap-1 py-2">
        {REPORTS.map((it) => (
          <RailButton
            key={it.href}
            item={it}
            active={isActive(it.href)}
          />
        ))}
      </div>

      <Hairline />

      {/* Team — Pro/Ultra see /team for managing subordinates;
          everyone sees /inbox/invitations because anyone can be invited. */}
      <div className="flex flex-col items-center gap-1 py-2">
        {canManageTeam && (
          <RailButton
            item={{ name: "ทีม", href: "/team", icon: Users }}
            active={isActive("/team")}
          />
        )}
        <RailButton
          item={{
            name: "กล่องจดหมาย",
            href: "/inbox/invitations",
            icon: Inbox,
          }}
          active={isActive("/inbox")}
        />
      </div>

      {/* Clients — pinned to the bottom. mt-auto pushes everything
          above it flush to the top; a hairline above visually
          separates "per-client" nav from "cross-client" management. */}
      <div className="mt-auto w-full flex flex-col items-center">
        <Hairline />
        <div className="py-2">
          <RailButton
            item={{ name: "จัดการลูกค้า", href: "/clients", icon: Users }}
            active={isActive("/clients")}
          />
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────

/** Thin gold hairline between nav groups — 32px wide, not full rail
 *  width, so the rail reads as a column of "tiles" separated by
 *  gilded micro-dividers rather than one solid strip. */
function Hairline() {
  return (
    <div
      aria-hidden
      className="w-8 h-px my-1 shrink-0"
      style={{ background: HAIRLINE }}
    />
  );
}

/** Single rail button. 40×40 rounded-xl. Inactive: 55% ivory icon that
 *  brightens to pure white on hover + subtle white/10% bg wash. Active:
 *  gold-tinted bg + gold icon + thin gold bar that breaks out to the
 *  left of the rail (hence the negative offset) as a pennant. */
function RailButton({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.name}
      aria-label={item.name}
      aria-current={active ? "page" : undefined}
      className="group relative flex items-center justify-center w-10 h-10 rounded-xl transition hover:bg-white/10"
      // Inline style (specificity 1000) keeps the gold wash on hover
      // too — Tailwind's hover:bg-white/10 is lower specificity.
      style={active ? { background: GOLD_SOFT } : undefined}
    >
      {active && (
        <span
          aria-hidden
          className="absolute -left-[14px] top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r-full"
          style={{
            background: GOLD,
            boxShadow: "0 0 8px rgba(214,181,109,0.6)",
          }}
        />
      )}
      <Icon
        size={18}
        strokeWidth={1.75}
        className={
          active
            ? ""
            : "text-white/55 group-hover:text-white transition-colors"
        }
        style={active ? { color: GOLD } : undefined}
      />
    </Link>
  );
}
