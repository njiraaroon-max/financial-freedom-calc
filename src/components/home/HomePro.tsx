"use client";

/**
 * HomePro — premium "private banking" dashboard for the professional skin.
 *
 * Target aesthetic: private wealth management platform (Apple Wallet /
 * top-tier fintech dashboard / Dribbble-grade fintech). Not a SaaS.
 *
 * Layout (top-down):
 *   Hero (full-bleed deep navy)
 *     • Floating top nav (transparent-on-navy)
 *     • Logo + headline + subtext + twin CTAs (Start / Continue)
 *   Insight panel (4 live metrics floating on glass, overlaps hero)
 *     • Net Worth · Monthly Surplus · Protection · Retirement
 *   Mode selector (2 glass cards — Comprehensive has soft gold halo)
 *   Tool modules grouped by pillar (Foundation · Protection · Optimization · Future)
 *
 * Key rules followed:
 *   • No thick borders — depth carried by layered soft shadows
 *   • No status dots / checkmarks — "no checklist feeling"
 *   • Royal-blue icons on `softBlue` tint (rgba(11,78,162,0.06))
 *   • Generous whitespace; subtitle opacity ~0.7
 *   • 0.25s ease transitions on all interactive elements
 *   • Gold used exclusively as glow — never as a solid border/fill
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  UserCircle,
  Users,
  FileBarChart,
  Wallet,
  Target,
  Scale,
  ShieldAlert,
  Shield,
  Receipt,
  Palmtree,
  GraduationCap,
  CreditCard,
  TrendingUp,
  LineChart,
  LayoutGrid,
  Layers,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Plus,
  Coins,
  Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useOrganization,
  usePlanningMode,
  useFaSessionStore,
} from "@/store/fa-session-store";
import { useProfileStore } from "@/store/profile-store";
import { useCashFlowStore } from "@/store/cashflow-store";
import { useBalanceSheetStore } from "@/store/balance-sheet-store";
import { useInsuranceStore } from "@/store/insurance-store";
import { useRetirementStore } from "@/store/retirement-store";

// ─── Luxury palette ────────────────────────────────────────────────
const PALETTE = {
  deepNavy: "#041833",
  primaryNavy: "#062B5F",
  heroNavyEnd: "#0B3A78",
  royalBlue: "#0B4EA2",
  softBlue: "rgba(11,78,162,0.06)",
  softBlueStrong: "rgba(11,78,162,0.12)",
  gold: "#D6B56D",
  goldSoft: "#E8D3A0",
  bg: "#F6F8FB",
  card: "rgba(255,255,255,0.85)",
  textPrimary: "#172033",
  textSub: "#667085",
  hairline: "rgba(23, 32, 51, 0.06)",
};

// Shared shadow tokens — stacked to create "glass floating in space" depth.
// Every card shadow ends with a 1px white inset at the top — this is the
// "sheen" that makes cards read as glass catching light. It's the single
// biggest difference between SaaS-flat and Apple-Wallet-grade surfaces.
const SHEEN = "0 1px 0 rgba(255,255,255,0.9) inset";

const SHADOWS = {
  // Module cards — layered ambient + directional + colored tint, capped
  // with the top sheen so the card catches overhead light.
  module: `0 1px 2px rgba(23,32,51,0.04), 0 6px 20px rgba(23,32,51,0.06), 0 18px 40px -24px rgba(6,43,95,0.14), ${SHEEN}`,
  moduleHover: `0 2px 6px rgba(23,32,51,0.06), 0 14px 40px rgba(23,32,51,0.10), 0 32px 60px -24px rgba(6,43,95,0.22), ${SHEEN}`,
  // Insight stat cards
  statCard: `0 1px 2px rgba(23,32,51,0.04), 0 6px 20px rgba(23,32,51,0.05), ${SHEEN}`,
  // Glassmorphic cards (mode selector + insight wrapper)
  glass: `0 10px 30px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.5) inset`,
  // Featured (Comprehensive) mode card — deeper drop + soft gold halo,
  // no hard border. Gold-tinted top sheen (instead of the plain white
  // sheen other cards have) gives the card a 1px champagne edge-light
  // that reads as "premium" without shouting.
  glassFeatured: `0 20px 60px rgba(0,0,0,0.15), 0 0 30px rgba(214,181,109,0.15), 0 1px 0 rgba(238,212,156,0.7) inset, 0 2px 8px rgba(214,181,109,0.12) inset`,
  // Primary CTA (white button on navy hero)
  ctaPrimary: `0 12px 32px rgba(0,0,0,0.22), 0 1px 2px rgba(0,0,0,0.08), ${SHEEN}`,
};

// Inline SVG noise used as a `url()` background layer. 3% opacity film
// grain — invisible individually but hugely lifts the hero from "flat CGI
// gradient" to "photographic lit-surface". Data-URL so it ships in the
// bundle without an HTTP round-trip.
const NOISE_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>
       <filter id='n'>
         <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>
         <feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 0'/>
       </filter>
       <rect width='100%' height='100%' filter='url(#n)' opacity='1'/>
     </svg>`,
  );

// ─── Tool catalogues ───────────────────────────────────────────────
type Tool = {
  name: string;
  description: string;
  icon: LucideIcon;
  href: string;
};

const MODULAR_TOOLS: Tool[] = [
  { name: "Personal Info", description: "ข้อมูลส่วนตัว", icon: UserCircle, href: "/calculators/personal-info" },
  { name: "Risk Management", description: "จัดการความเสี่ยง", icon: Shield, href: "/calculators/insurance" },
  { name: "Tax", description: "วางแผนภาษี", icon: Receipt, href: "/calculators/tax" },
  { name: "Retirement", description: "วางแผนเกษียณ", icon: Palmtree, href: "/calculators/retirement" },
  { name: "Education", description: "การศึกษาบุตร", icon: GraduationCap, href: "/calculators/education" },
];

// Comprehensive view groups the 12 tools into 4 pillars so the grid reads
// as a curated advisory workflow. Foundation is the entry pillar and gets
// larger cards than the others — the spec specifically calls out "Foundation
// (larger cards)".
type ToolGroup = {
  label: string;
  thai: string;
  tools: Tool[];
  emphasis?: "large"; // Foundation pillar gets larger cards
};

const TOOL_GROUPS: ToolGroup[] = [
  {
    label: "Foundation",
    thai: "ข้อมูลพื้นฐาน",
    emphasis: "large",
    tools: [
      { name: "Personal Info", description: "ข้อมูลส่วนตัว", icon: UserCircle, href: "/calculators/personal-info" },
      { name: "Goals", description: "เป้าหมายชีวิต", icon: Target, href: "/calculators/goals" },
      { name: "Cash Flow", description: "รายรับ-รายจ่าย", icon: Wallet, href: "/calculators/cashflow" },
      { name: "Balance Sheet", description: "งบดุลส่วนบุคคล", icon: Scale, href: "/calculators/balance-sheet" },
    ],
  },
  {
    label: "Protection",
    thai: "การป้องกันความเสี่ยง",
    tools: [
      { name: "Emergency", description: "เงินสำรองฉุกเฉิน", icon: ShieldAlert, href: "/calculators/emergency-fund" },
      { name: "Risk Management", description: "จัดการความเสี่ยง", icon: Shield, href: "/calculators/insurance" },
    ],
  },
  {
    label: "Optimization",
    thai: "ปรับประสิทธิภาพ",
    tools: [
      { name: "Tax", description: "วางแผนภาษี", icon: Receipt, href: "/calculators/tax" },
      { name: "Debt", description: "วางแผนปลดหนี้", icon: CreditCard, href: "/calculators/debt" },
      { name: "Investment", description: "ลงทุนเพื่อเป้าหมาย", icon: TrendingUp, href: "/calculators/investment" },
    ],
  },
  {
    label: "Future Planning",
    thai: "วางแผนอนาคต",
    tools: [
      { name: "Retirement", description: "วางแผนเกษียณ", icon: Palmtree, href: "/calculators/retirement" },
      { name: "Education", description: "การศึกษาบุตร", icon: GraduationCap, href: "/calculators/education" },
      { name: "CF Projection", description: "ประมาณการเงินสด", icon: LineChart, href: "/calculators/cf-projection" },
    ],
  },
];

// ─── Live insights ─────────────────────────────────────────────────
interface ClientInsights {
  netWorth: number | null;
  monthlySurplus: number | null;
  policiesCount: number;
  retirementSet: boolean;
}

function useClientInsights(): ClientInsights {
  const assets = useBalanceSheetStore((s) => s.assets);
  const liabilities = useBalanceSheetStore((s) => s.liabilities);
  const incomes = useCashFlowStore((s) => s.incomes);
  const expenses = useCashFlowStore((s) => s.expenses);
  const policiesCount = useInsuranceStore((s) => s.policies.length);
  const investmentPlansCount = useRetirementStore(
    (s) => s.investmentPlans.length,
  );

  const totalAssets = assets.reduce((s, a) => s + (a.value || 0), 0);
  const totalLiab = liabilities.reduce((s, l) => s + (l.value || 0), 0);
  const hasBalanceData = totalAssets > 0 || totalLiab > 0;

  const annualIncome = incomes.reduce(
    (s, i) => s + i.amounts.reduce((x, y) => x + (y || 0), 0),
    0,
  );
  const annualExpenses = expenses.reduce(
    (s, e) => s + e.amounts.reduce((x, y) => x + (y || 0), 0),
    0,
  );
  const hasCashflowData = annualIncome > 0 || annualExpenses > 0;

  return {
    netWorth: hasBalanceData ? totalAssets - totalLiab : null,
    monthlySurplus: hasCashflowData ? (annualIncome - annualExpenses) / 12 : null,
    policiesCount,
    retirementSet: investmentPlansCount > 0,
  };
}

// ─── Formatters ────────────────────────────────────────────────────
const thbCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
function fmtTHB(v: number | null, opts: { compactAlways?: boolean } = {}): string {
  if (v === null) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const body =
    opts.compactAlways || abs >= 1_000_000
      ? thbCompact.format(abs)
      : abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${sign}฿${body}`;
}

// ═══════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════
export default function HomePro() {
  const org = useOrganization();
  const planningMode = usePlanningMode();
  const setPlanningMode = useFaSessionStore((s) => s.setPlanningMode);
  const features = useFaSessionStore((s) => s.session?.features ?? null);
  const clientName = useProfileStore((s) => s.name);
  const birthDate = useProfileStore((s) => s.birthDate);
  const firstName = clientName ? clientName.split(" ")[0] : "";
  const insights = useClientInsights();

  // Admin-controlled mode gates. Missing key → treat as enabled so
  // existing FAs aren't silently locked out when flags are added.
  const modularEnabled = features?.mode_modular_enabled !== false;
  const comprehensiveEnabled = features?.mode_comprehensive_enabled !== false;

  // Auto-fallback: if the FA's current mode was just disabled by admin,
  // flip to whichever mode is still on. (If both disabled, we leave the
  // state alone and render a banner — the cards themselves are locked.)
  useEffect(() => {
    if (planningMode === "modular" && !modularEnabled && comprehensiveEnabled) {
      setPlanningMode("comprehensive");
    } else if (
      planningMode === "comprehensive" &&
      !comprehensiveEnabled &&
      modularEnabled
    ) {
      setPlanningMode("modular");
    }
  }, [planningMode, modularEnabled, comprehensiveEnabled, setPlanningMode]);

  const bothDisabled = !modularEnabled && !comprehensiveEnabled;

  // "Start New Plan" is only shown when the client's foundational info is
  // missing — once name + birthDate are filled the FA is deep into the
  // workflow and the CTA becomes noise. (We use the same hasProfile rule
  // as the legacy useToolsFilled hook so both surfaces stay consistent.)
  const hasProfile = !!(clientName && birthDate);

  const orgName = org?.name ?? "Victory Group";
  const logoUrl = org?.logoDarkUrl ?? org?.logoUrl ?? null;

  return (
    <div
      className="min-h-dvh"
      style={{
        background: PALETTE.bg,
        color: PALETTE.textPrimary,
        fontFamily:
          "var(--brand-font-body), var(--font-prompt), 'IBM Plex Sans Thai', system-ui, sans-serif",
      }}
    >
      {/* ═══ 1+2. Hero with floating top nav ═════════════════════════ */}
      <Hero
        logoUrl={logoUrl}
        orgName={orgName}
        firstName={firstName}
        showStartCta={!hasProfile}
      />

      {/* ═══ 3. Insight panel (overlaps hero) ════════════════════════ */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 -mt-16 md:-mt-20 relative z-20">
        <InsightPanel insights={insights} clientName={clientName} />
      </section>

      {/* ═══ 4. Mode selector ════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 mt-14 md:mt-20">
        <SectionHeader
          kicker="Planning Style"
          title="เลือกรูปแบบการวางแผน"
          subtitle="เริ่มจากโมดูลเดี่ยวที่จับประเด็น หรือวางแผนองค์รวมเต็มรูปแบบ"
        />
        {bothDisabled && (
          <div
            className="mt-6 rounded-2xl px-5 py-4 flex items-start gap-3"
            style={{
              background: "rgba(214,181,109,0.10)",
              border: `1px solid ${PALETTE.hairline}`,
              color: PALETTE.textPrimary,
            }}
          >
            <Lock size={16} style={{ marginTop: 2, color: PALETTE.royalBlue }} />
            <div className="text-[13.5px] leading-[1.6]">
              โหมดการวางแผนทั้งสองถูกปิดใช้งานสำหรับบัญชีของคุณ — กรุณาติดต่อ
              ผู้ดูแลระบบเพื่อเปิดใช้งาน
            </div>
          </div>
        )}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          <ModeCard
            active={planningMode === "modular" && modularEnabled}
            disabled={!modularEnabled}
            onSelect={() => setPlanningMode("modular")}
            icon={Layers}
            label="Modular"
            thai="วางแผนเฉพาะจุด"
            description="เลือกเฉพาะหัวข้อที่ต้องการ เช่น ภาษี เกษียณ ประกัน การศึกษา เหมาะกับการให้คำปรึกษาเจาะจง"
            badge="5 เครื่องมือ"
          />
          <ModeCard
            active={planningMode === "comprehensive" && comprehensiveEnabled}
            disabled={!comprehensiveEnabled}
            onSelect={() => setPlanningMode("comprehensive")}
            icon={LayoutGrid}
            label="Comprehensive"
            thai="วางแผนองค์รวม"
            description="วิเคราะห์ครบ 12 มิติ เหมาะกับ Financial Review หรือการทำแผนเต็มรูปแบบให้ลูกค้า"
            badge="12 เครื่องมือ"
            featured
          />
        </div>
      </section>

      {/* ═══ 5. Tool modules ═════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 mt-16 md:mt-24 pb-20">
        <SectionHeader
          kicker="Planning Tools"
          title={
            planningMode === "modular"
              ? "เครื่องมือแบบโมดูล"
              : "เครื่องมือองค์รวม"
          }
          subtitle={
            planningMode === "modular"
              ? "5 เครื่องมือหลักสำหรับการวางแผนแบบเฉพาะจุด"
              : "12 เครื่องมือ จัดกลุ่มตาม 4 เสาหลักของการวางแผนการเงิน"
          }
        />

        {planningMode === "modular" ? (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 md:gap-6">
            {MODULAR_TOOLS.map((tool) => (
              <ToolCard key={tool.href} tool={tool} />
            ))}
          </div>
        ) : (
          <div className="mt-8 space-y-12 md:space-y-16">
            {TOOL_GROUPS.map((group) => (
              <ToolGroupSection key={group.label} group={group} />
            ))}
          </div>
        )}
      </section>

      <footer
        className="max-w-6xl mx-auto px-6 md:px-10 pb-12 text-center text-xs"
        style={{ color: PALETTE.textSub, opacity: 0.6 }}
      >
        Victory Group · Personal Wealth Planning Suite
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

// ─── Hero (with embedded top nav) ───────────────────────────────────
function Hero({
  logoUrl,
  orgName,
  firstName,
  showStartCta,
}: {
  logoUrl: string | null;
  orgName: string;
  firstName: string;
  /** Hide the "Start New Plan" CTA once the client's profile is filled. */
  showStartCta: boolean;
}) {
  // ─── Parallax cursor tracking ─────────────────────────────────
  // Track the cursor's normalized position inside the hero (0..1 on
  // each axis, centered origin so range is -0.5..+0.5). We update a
  // `ref` rather than React state inside the rAF so we don't
  // re-render every mouse move — transforms are applied via inline
  // CSS variables read by the logo + aurora layers.
  const heroRef = useRef<HTMLElement>(null);
  const [mount, setMount] = useState(false);

  useEffect(() => {
    // Trigger entrance animations on the first client tick. Hidden
    // elements flash to visible only once styles are resolved.
    const id = requestAnimationFrame(() => setMount(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    // Respect reduced-motion preference — skip parallax entirely.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    let frame = 0;
    const onMove = (e: MouseEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        // Clamp to [-0.5, 0.5] just in case pointer is outside bounds.
        const cx = Math.max(-0.5, Math.min(0.5, x));
        const cy = Math.max(-0.5, Math.min(0.5, y));
        el.style.setProperty("--px", cx.toFixed(3));
        el.style.setProperty("--py", cy.toFixed(3));
      });
    };
    const onLeave = () => {
      el.style.setProperty("--px", "0");
      el.style.setProperty("--py", "0");
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      ref={heroRef}
      className={`relative overflow-hidden ${mount ? "hero-mounted" : ""}`}
      style={{
        // CSS vars updated by the parallax effect. Start at 0 so the
        // hero renders identically server vs client until the first
        // mousemove lands.
        ["--px" as string]: "0",
        ["--py" as string]: "0",
        // Cinematic lighting: two radial highlights layered over the base
        // diagonal navy gradient. Top-left light is brighter (acts as the
        // "key light"), top-right is cooler fill. Together they give the
        // hero an illuminated, three-dimensional feel — not flat navy.
        background: [
          "radial-gradient(circle at 20% 10%, rgba(255,255,255,0.15), transparent 40%)",
          "radial-gradient(circle at 80% 30%, rgba(255,255,255,0.08), transparent 50%)",
          `linear-gradient(135deg, ${PALETTE.deepNavy} 0%, ${PALETTE.heroNavyEnd} 100%)`,
        ].join(", "),
      }}
    >
      {/* ── Aurora blobs (Level 2 cinematic layer) ──────────────────
          Three heavily blurred colored blobs floating over the base
          gradient. Same trick Apple Wallet / Stripe use to make a navy
          hero feel alive — the blobs don't read as shapes, they read
          as "light of different temperatures pooling on a surface".
          Slow, subtle drift animation so the hero breathes. */}
      <div
        aria-hidden
        className="absolute pointer-events-none hero-aurora-a"
        style={{
          top: "-10%",
          left: "-8%",
          width: "55%",
          height: "70%",
          background:
            "radial-gradient(circle, rgba(11,78,162,0.45) 0%, rgba(11,78,162,0.18) 40%, transparent 70%)",
          filter: "blur(60px)",
          mixBlendMode: "screen",
          opacity: 0.85,
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none hero-aurora-b"
        style={{
          top: "-15%",
          right: "-10%",
          width: "50%",
          height: "70%",
          background:
            "radial-gradient(circle, rgba(214,181,109,0.25) 0%, rgba(214,181,109,0.10) 40%, transparent 70%)",
          filter: "blur(70px)",
          mixBlendMode: "screen",
          opacity: 0.75,
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none hero-aurora-c"
        style={{
          bottom: "-20%",
          left: "30%",
          width: "45%",
          height: "60%",
          background:
            "radial-gradient(circle, rgba(120,100,200,0.22) 0%, rgba(120,100,200,0.08) 40%, transparent 70%)",
          filter: "blur(80px)",
          mixBlendMode: "screen",
          opacity: 0.7,
        }}
      />

      {/* Film-grain noise overlay — opacity 0.035. Invisible pixel-by-pixel
          but gives the navy gradient a photographic, "real surface" feel
          instead of the digital-flat look a clean gradient always has.
          Placed AFTER the aurora blobs so the grain sits on top of the
          colored light, unifying everything as one "textured surface". */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("${NOISE_SVG}")`,
          backgroundSize: "240px 240px",
          opacity: 0.035,
          mixBlendMode: "overlay",
        }}
      />

      {/* Animation definitions for the whole hero. styled-jsx only allows
          ONE <style jsx> tag per component tree, so every keyframe/rule
          the hero needs lives in this single block. */}
      <style jsx>{`
        .hero-aurora-a {
          animation: aurora-a 32s ease-in-out infinite alternate;
        }
        .hero-aurora-b {
          animation: aurora-b 40s ease-in-out infinite alternate;
        }
        .hero-aurora-c {
          animation: aurora-c 36s ease-in-out infinite alternate;
        }
        :global(.kicker-underline) {
          animation: gold-shimmer 5.5s ease-in-out infinite;
        }
        /* Entrance stagger — each element keeps its final transform
           via "forwards" and reads its own delay from the --delay var
           that each item sets inline. Start hidden so there's no FOUC
           flash before the animation kicks in. */
        :global(.hero-stagger) {
          opacity: 0;
          transform: translateY(14px);
          animation: fade-up 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          animation-delay: var(--delay, 0ms);
        }
        @keyframes aurora-a {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(5%, 4%);
          }
        }
        @keyframes aurora-b {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(-6%, 3%);
          }
        }
        @keyframes aurora-c {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(-4%, -6%);
          }
        }
        @keyframes gold-shimmer {
          0%,
          100% {
            background-position: 100% 0;
          }
          50% {
            background-position: 0% 0;
          }
        }
        @keyframes fade-up {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        /* Logo levitation — gentle 7s vertical bob. Transform runs on
           the <img> itself (the outer wrapper already uses transform
           for parallax, so nesting the float one layer in lets both
           compose without CSS conflict). The filter also breathes:
           when the logo rises, the drop-shadow spreads + softens to
           sell greater distance from the ground; when it settles, the
           shadow tightens back. */
        :global(.logo-float) {
          animation: logo-float 7s ease-in-out infinite;
          will-change: transform, filter;
        }
        @keyframes logo-float {
          0%,
          100% {
            transform: translateY(0);
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6))
              drop-shadow(0 14px 28px rgba(0, 0, 0, 0.65))
              drop-shadow(0 34px 70px rgba(2, 12, 28, 0.8));
          }
          50% {
            transform: translateY(-12px);
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))
              drop-shadow(0 22px 40px rgba(0, 0, 0, 0.55))
              drop-shadow(0 46px 95px rgba(2, 12, 28, 0.68));
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-aurora-a,
          .hero-aurora-b,
          .hero-aurora-c,
          :global(.kicker-underline),
          :global(.hero-stagger),
          :global(.logo-float) {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>

      {/* Bottom vignette — darkens the lower edge so the insight panel
          reads as "floating above" the hero surface. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-56 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(4,24,51,0.45) 100%)",
        }}
      />

      {/* Gold light pool bleed — a soft warm halo at the hero's bottom
          that extends slightly past the edge, so the top of the insight
          panel (which overlaps the hero) catches a trace of gold light.
          Stage-lighting effect — the eye reads it as "the gold halo in
          the hero still lingers below", tying the two sections together. */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          left: "50%",
          bottom: "-120px",
          width: "80%",
          maxWidth: "900px",
          height: "260px",
          transform: "translateX(-50%)",
          background:
            "radial-gradient(ellipse at center, rgba(214,181,109,0.18) 0%, rgba(214,181,109,0.08) 35%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />

      {/* Top nav — floats on the navy, transparent background so the
          cinematic gradient reads clean. It's NOT sticky: when the user
          scrolls past the hero there's no header following them, which
          is the private-banking convention (vs SaaS sticky nav). */}
      <TopNav firstName={firstName} />

      {/* Hero content */}
      <div className="relative max-w-6xl mx-auto px-6 md:px-10 pt-10 md:pt-14 pb-32 md:pb-44">
        <div className="max-w-2xl">
          {/* Logo mark above the headline — with a soft white glow behind
              it so the silver V reads as "lit from within". Tight spacing
              between logo and title as specced.

              Layered back-to-front:
                • Conic gold strip — thin geometric light-ray behind the
                  logo. Visible on close inspection as a faint gold arc;
                  gives the composition a "minted" premium feel (like
                  the guilloché pattern on luxury watches / bank notes).
                • White radial halo — the "lit from within" glow.
                • Logo itself with drop-shadow. */}
          {logoUrl && (
            <div
              className="relative block w-fit mb-5 md:mb-6 hero-stagger"
              style={{
                // Parallax — logo drifts toward the cursor by up to ±10px
                // on each axis. Small enough to feel "alive" not "wobbly".
                transform:
                  "translate(calc(var(--px, 0) * 10px), calc(var(--py, 0) * 10px))",
                transition: "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
                ["--delay" as string]: "60ms",
              }}
            >
              {/* Dark backdrop pool — a soft radial of ultra-dark navy
                  BEHIND the logo. Deepens the hero gradient right at
                  the logo's footprint so the white mark pops forward.
                  Classic "spotlight in reverse" — instead of lighting
                  the subject we darken the background directly behind
                  it, which lifts contrast without adding any glow
                  that would compete with the logo itself. Rendered
                  first so it sits furthest back in the stacking order. */}
              <div
                aria-hidden
                className="absolute inset-0 -m-10 md:-m-14 rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, rgba(2,12,28,0.55) 0%, rgba(2,12,28,0.28) 35%, transparent 70%)",
                  filter: "blur(24px)",
                }}
              />
              {/* Conic accent strip — ultra-subtle gold sweep. Kept very
                  tight + very low opacity so the WHITE logo in front
                  gets maximum contrast against the navy hero; a strong
                  halo would wash the logo out rather than frame it.
                  Still parallax-shifts opposite the logo for a hint of
                  3D depth when the cursor moves. */}
              <div
                aria-hidden
                className="absolute inset-0 -m-2 rounded-full pointer-events-none"
                style={{
                  background: `conic-gradient(from 210deg, transparent 0deg, rgba(214,181,109,0.10) 40deg, rgba(214,181,109,0.03) 90deg, transparent 150deg, transparent 210deg, rgba(214,181,109,0.08) 260deg, transparent 320deg)`,
                  filter: "blur(12px)",
                  opacity: 0.4,
                  transform:
                    "translate(calc(var(--px, 0) * -16px), calc(var(--py, 0) * -16px))",
                  transition: "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)",
                }}
              />
              {/* (White halo removed — a white glow behind a white logo
                  reduces contrast rather than adds to it. The logo's
                  drop-shadow on the <img> below carries the depth.) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={orgName}
                className="relative h-40 md:h-56 lg:h-64 w-auto object-contain logo-float"
              />
              {/* The `logo-float` keyframe (defined in <style jsx> below)
                  owns both the Y translation AND the drop-shadow chain so
                  the shadow breathes in sync with the bob — setting
                  `filter` inline here would override the animated filter
                  on every frame. */}
            </div>
          )}

          {/* Kicker with a thin gold underline — micro-detail that reads
              as "engraved", typical of private-banking mastheads. */}
          <div
            className="block w-fit mb-3 hero-stagger"
            style={{ ["--delay" as string]: "160ms" }}
          >
            <span
              className="block text-[13px] md:text-[14px] font-semibold tracking-[0.3em] uppercase"
              style={{ color: PALETTE.goldSoft }}
            >
              Personal Wealth Planning
            </span>
            <div
              aria-hidden
              className="mt-2 h-[1.5px] kicker-underline"
              style={{
                width: "80%",
                background: `linear-gradient(90deg, transparent 0%, ${PALETTE.gold} 30%, rgba(255,255,255,0.8) 50%, ${PALETTE.gold} 70%, transparent 100%)`,
                backgroundSize: "300% 100%",
              }}
            />
          </div>

          <h1
            className="text-[32px] md:text-[48px] font-semibold leading-[1.12] text-white hero-stagger"
            style={{
              letterSpacing: "0.01em",
              fontFamily:
                "var(--brand-font-display), var(--font-prompt), 'IBM Plex Sans Thai', system-ui, sans-serif",
              ["--delay" as string]: "260ms",
            }}
          >
            Victory Group
            <br />
            <span style={{ color: PALETTE.goldSoft, fontWeight: 400 }}>
              Planning Suite
            </span>
          </h1>

          <p
            className="mt-5 text-[15px] md:text-base leading-[1.7] max-w-xl hero-stagger"
            style={{
              color: "rgba(255,255,255,0.72)",
              ["--delay" as string]: "380ms",
            }}
          >
            ออกแบบแผนการเงินครบวงจร จากข้อมูลลูกค้า สู่คำแนะนำที่นำไปใช้ได้จริง —
            แพลตฟอร์มสำหรับที่ปรึกษาการเงินระดับมืออาชีพ
          </p>

          {/* CTA area — conditional. Once the client's profile is filled
              the FA is already mid-workflow and a "Start New Plan" button
              just adds noise, so we hide it. "Continue Client Plan" was
              removed entirely per the design brief — the insight panel
              below is the actual continuation surface. */}
          {showStartCta && (
            <div
              className="mt-9 flex flex-wrap items-center gap-3 hero-stagger"
              style={{ ["--delay" as string]: "500ms" }}
            >
              <Link
                href="/calculators/personal-info"
                className="group inline-flex items-center gap-2 pl-6 pr-5 h-12 rounded-full text-sm font-semibold tracking-[0.01em]"
                style={{
                  background: "#FFFFFF",
                  color: PALETTE.primaryNavy,
                  boxShadow: SHADOWS.ctaPrimary,
                  transition: "all 0.25s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 18px 44px rgba(0,0,0,0.28), 0 1px 2px rgba(0,0,0,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = SHADOWS.ctaPrimary;
                }}
              >
                <Plus size={16} strokeWidth={2.25} />
                Start New Plan
                <ArrowRight
                  size={16}
                  strokeWidth={2}
                  className="transition-transform duration-[250ms] group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Top nav (floats on hero) ───────────────────────────────────────
function TopNav({ firstName }: { firstName: string }) {
  return (
    <div className="relative max-w-6xl mx-auto px-6 md:px-10 pt-6 md:pt-7">
      <div className="flex items-center justify-between">
        {/* Intentionally empty left slot — the big illuminated logo below
            in the hero body does all the brand work. Putting a textmark
            here duplicated the wordmark and cheapened the composition. */}
        <div aria-hidden />

        <nav className="flex items-center gap-1 md:gap-2">
          <TopNavLink href="/clients" icon={Users} label="Clients" />
          <TopNavLink href="/summary" icon={FileBarChart} label="Reports" />
          <Link
            href="/calculators/personal-info"
            className="flex items-center gap-2 pl-2 pr-3.5 h-9 rounded-full ml-1"
            style={{
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.16)",
              color: "#FFFFFF",
              transition: "all 0.25s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.16)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.10)";
            }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{
                background: `linear-gradient(135deg, ${PALETTE.goldSoft}, ${PALETTE.gold})`,
                color: "#4A3914",
              }}
            >
              {firstName ? firstName.charAt(0).toUpperCase() : "A"}
            </div>
            <span className="hidden sm:inline text-[13px] font-medium">
              {firstName ? `คุณ${firstName}` : "Profile"}
            </span>
          </Link>
        </nav>
      </div>
    </div>
  );
}

function TopNavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 px-3 h-9 rounded-full text-[13px] font-medium"
      style={{
        color: "rgba(255,255,255,0.75)",
        transition: "all 0.25s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "#FFFFFF";
        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "rgba(255,255,255,0.75)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      <Icon size={15} strokeWidth={1.75} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

// ─── Section header ────────────────────────────────────────────────
function SectionHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <span
        className="text-[11px] font-semibold tracking-[0.22em] uppercase"
        style={{ color: PALETTE.royalBlue }}
      >
        {kicker}
      </span>
      <h2
        className="text-[22px] md:text-[26px] font-semibold mt-2"
        style={{
          color: PALETTE.textPrimary,
          letterSpacing: "0.005em",
          fontFamily:
            "var(--brand-font-display), var(--font-prompt), 'IBM Plex Sans Thai', system-ui, sans-serif",
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="mt-2 text-[14px] leading-relaxed max-w-2xl"
          style={{ color: PALETTE.textSub, opacity: 0.7 }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ─── Insight panel ──────────────────────────────────────────────────
function InsightPanel({
  insights,
  clientName,
}: {
  insights: ClientInsights;
  clientName: string;
}) {
  const items: InsightItem[] = [
    {
      label: "Net Worth",
      thai: "ความมั่งคั่งสุทธิ",
      icon: Wallet,
      value: fmtTHB(insights.netWorth),
      hint:
        insights.netWorth === null
          ? "ยังไม่มีข้อมูล"
          : insights.netWorth >= 0
            ? "สินทรัพย์สุทธิ"
            : "หนี้สินสูงกว่าสินทรัพย์",
      tone:
        insights.netWorth === null
          ? "muted"
          : insights.netWorth >= 0
            ? "positive"
            : "warning",
    },
    {
      label: "Monthly Surplus",
      thai: "เงินออมต่อเดือน",
      icon: Coins,
      value:
        insights.monthlySurplus === null
          ? "—"
          : fmtTHB(insights.monthlySurplus),
      hint:
        insights.monthlySurplus === null
          ? "ยังไม่มีข้อมูล"
          : insights.monthlySurplus >= 0
            ? "รายรับ−รายจ่าย"
            : "ใช้เกินรายรับ",
      tone:
        insights.monthlySurplus === null
          ? "muted"
          : insights.monthlySurplus > 0
            ? "positive"
            : insights.monthlySurplus === 0
              ? "neutral"
              : "warning",
    },
    {
      label: "Protection",
      thai: "ความคุ้มครอง",
      icon: Shield,
      value:
        insights.policiesCount > 0
          ? `${insights.policiesCount} กรมธรรม์`
          : "—",
      hint: insights.policiesCount > 0 ? "มีกรมธรรม์ที่คุ้มครอง" : "ยังไม่ได้ประเมิน",
      tone: insights.policiesCount > 0 ? "positive" : "muted",
    },
    {
      label: "Retirement",
      thai: "แผนเกษียณ",
      icon: Sparkles,
      value: insights.retirementSet ? "จัดสรรแล้ว" : "—",
      hint: insights.retirementSet ? "มีแผนการลงทุน" : "ยังไม่ได้วาง",
      tone: insights.retirementSet ? "positive" : "muted",
    },
  ];

  return (
    <div
      className="rounded-[24px] p-5 md:p-7"
      style={{
        background: PALETTE.card,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: SHADOWS.glass,
      }}
    >
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <span
            className="text-[11px] font-semibold tracking-[0.22em] uppercase"
            style={{ color: PALETTE.royalBlue }}
          >
            Client Insight
          </span>
          <div
            className="text-[16px] font-semibold mt-1"
            style={{
              color: PALETTE.textPrimary,
              letterSpacing: "0.005em",
            }}
          >
            {clientName ? `คุณ${clientName.split(" ")[0]}` : "ภาพรวมลูกค้า"}
          </div>
        </div>
        <Link
          href="/summary"
          className="flex items-center gap-1 text-xs font-medium"
          style={{
            color: PALETTE.royalBlue,
            transition: "all 0.25s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.gap = "6px")}
          onMouseLeave={(e) => (e.currentTarget.style.gap = "4px")}
        >
          ดูรายงานเต็ม
          <ArrowRight size={13} strokeWidth={2} />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {items.map((item) => (
          <InsightCard key={item.label} {...item} />
        ))}
      </div>
    </div>
  );
}

type InsightTone = "positive" | "neutral" | "warning" | "muted";
interface InsightItem {
  label: string;
  thai: string;
  icon: LucideIcon;
  value: string;
  hint: string;
  tone: InsightTone;
}

function InsightCard({ label, thai, icon: Icon, value, hint, tone }: InsightItem) {
  // Tone dot — a single colored pixel next to the hint. Much more refined
  // than colored bars or heavy accents. Bloomberg-terminal-esque.
  const toneDot: Record<InsightTone, string> = {
    positive: "#2E7D5B",
    neutral: PALETTE.royalBlue,
    warning: "#B4873C",
    muted: "rgba(102,112,133,0.35)",
  };

  return (
    <div
      className="rounded-2xl p-5 md:p-6"
      style={{
        background: "#FFFFFF",
        boxShadow: SHADOWS.statCard,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: PALETTE.softBlue }}
        >
          <Icon
            size={16}
            strokeWidth={1.75}
            style={{ color: PALETTE.royalBlue }}
          />
        </div>
        <span
          className="text-[10px] font-semibold tracking-[0.18em] uppercase"
          style={{ color: PALETTE.textSub, opacity: 0.7 }}
        >
          {label}
        </span>
      </div>

      <div
        className="text-[22px] md:text-[26px] font-semibold leading-tight"
        style={{
          color: PALETTE.textPrimary,
          letterSpacing: "0.005em",
          fontFamily:
            "var(--brand-font-display), var(--font-prompt), 'IBM Plex Sans Thai', system-ui, sans-serif",
          // Tabular figures — every digit occupies the same horizontal
          // space, so amounts align vertically in a grid of four insight
          // cards. Bloomberg / banking convention.
          fontVariantNumeric: "tabular-nums",
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {value}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: toneDot[tone] }}
          aria-hidden
        />
        <span
          className="text-[11.5px]"
          style={{ color: PALETTE.textSub, opacity: 0.75 }}
        >
          {hint} · {thai}
        </span>
      </div>
    </div>
  );
}

// ─── Mode card ──────────────────────────────────────────────────────
interface ModeCardProps {
  active: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  label: string;
  thai: string;
  description: string;
  badge: string;
  featured?: boolean;
  /** Admin has turned this mode off for the FA — card is non-interactive. */
  disabled?: boolean;
}

function ModeCard({
  active,
  onSelect,
  icon: Icon,
  label,
  thai,
  description,
  badge,
  featured = false,
  disabled = false,
}: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      aria-disabled={disabled}
      className="group text-left relative flex flex-col gap-4 p-7 md:p-8 rounded-[22px] disabled:cursor-not-allowed"
      style={{
        background: PALETTE.card,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: featured ? SHADOWS.glassFeatured : SHADOWS.glass,
        transition: "all 0.25s ease",
        opacity: disabled ? 0.55 : 1,
        filter: disabled ? "grayscale(0.4)" : "none",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = featured
          ? "0 28px 70px rgba(0,0,0,0.18), 0 0 40px rgba(214,181,109,0.22), 0 1px 0 rgba(255,255,255,0.5) inset"
          : "0 16px 44px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.4) inset";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = featured
          ? SHADOWS.glassFeatured
          : SHADOWS.glass;
      }}
    >
      {/* Lock overlay badge — sits top-right corner when admin disabled */}
      {disabled && (
        <div
          className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-[0.14em] uppercase z-10"
          style={{
            background: "rgba(11,78,162,0.10)",
            color: PALETTE.royalBlue,
            border: `1px solid ${PALETTE.hairline}`,
          }}
          title="ผู้ดูแลระบบปิดการใช้งานโหมดนี้"
        >
          <Lock size={11} strokeWidth={2.2} />
          ปิดใช้งาน
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: active
              ? `linear-gradient(135deg, ${PALETTE.royalBlue}, ${PALETTE.primaryNavy})`
              : PALETTE.softBlue,
            transition: "all 0.25s ease",
          }}
        >
          <Icon
            size={22}
            strokeWidth={1.75}
            style={{ color: active ? "#FFFFFF" : PALETTE.royalBlue }}
          />
        </div>
        {/* Badge — translucent pill, subtle. Gold tinted when featured. */}
        <span
          className="text-[10px] font-semibold tracking-[0.18em] uppercase px-3 py-1.5 rounded-full"
          style={{
            background: featured
              ? "rgba(214,181,109,0.18)"
              : "rgba(11,78,162,0.08)",
            color: featured ? "#6B5318" : PALETTE.royalBlue,
            backdropFilter: "blur(6px)",
          }}
        >
          {badge}
        </span>
      </div>

      <div className="mt-2">
        <div
          className="text-[11px] font-semibold tracking-[0.22em] uppercase"
          style={{ color: PALETTE.textSub, opacity: 0.7 }}
        >
          {label}
        </div>
        <div
          className="text-[22px] md:text-[26px] font-semibold mt-1.5"
          style={{
            color: active ? PALETTE.primaryNavy : PALETTE.textPrimary,
            letterSpacing: "0.005em",
            fontFamily:
              "var(--brand-font-display), var(--font-prompt), 'IBM Plex Sans Thai', system-ui, sans-serif",
          }}
        >
          {thai}
        </div>
      </div>

      <p
        className="text-[13.5px] leading-[1.7]"
        style={{ color: PALETTE.textSub, opacity: 0.85 }}
      >
        {description}
      </p>

      <div
        className="flex items-center gap-1.5 text-[12.5px] font-semibold mt-2"
        style={{
          color: active ? PALETTE.royalBlue : PALETTE.textSub,
          opacity: active ? 1 : 0.7,
          transition: "all 0.25s ease",
        }}
      >
        {active ? "กำลังใช้งาน" : "เลือกโหมดนี้"}
        <ArrowRight
          size={14}
          strokeWidth={2}
          className="transition-transform duration-[250ms] group-hover:translate-x-0.5"
        />
      </div>
    </button>
  );
}

// ─── Tool group section ─────────────────────────────────────────────
function ToolGroupSection({ group }: { group: ToolGroup }) {
  const isLarge = group.emphasis === "large";
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-5">
        <span
          className="text-[11px] font-semibold tracking-[0.22em] uppercase"
          style={{ color: PALETTE.royalBlue }}
        >
          {group.label}
        </span>
        <span
          className="text-[13px]"
          style={{ color: PALETTE.textSub, opacity: 0.65 }}
        >
          {group.thai}
        </span>
        <div
          className="flex-1 h-px ml-2"
          style={{ background: PALETTE.hairline }}
        />
      </div>
      <div
        className={
          isLarge
            ? "grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6"
            : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6"
        }
      >
        {group.tools.map((tool) => (
          <ToolCard key={tool.href} tool={tool} emphasis={group.emphasis} />
        ))}
      </div>
    </div>
  );
}

// ─── Tool card ──────────────────────────────────────────────────────
function ToolCard({
  tool,
  emphasis,
}: {
  tool: Tool;
  emphasis?: "large";
}) {
  const isLarge = emphasis === "large";
  return (
    <Link
      href={tool.href}
      className="group relative block rounded-[20px]"
      style={{
        background: "#FFFFFF",
        boxShadow: SHADOWS.module,
        padding: isLarge ? "28px 24px" : "22px 20px",
        transition: "all 0.25s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-6px)";
        e.currentTarget.style.boxShadow = SHADOWS.moduleHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = SHADOWS.module;
      }}
    >
      {/* Icon tile — thin-stroke icon on soft-blue tint. Light visual weight. */}
      <div
        className="rounded-xl flex items-center justify-center mb-5"
        style={{
          width: isLarge ? 52 : 44,
          height: isLarge ? 52 : 44,
          background: PALETTE.softBlue,
          transition: "all 0.25s ease",
        }}
      >
        <tool.icon
          size={isLarge ? 24 : 20}
          strokeWidth={1.6}
          style={{ color: PALETTE.royalBlue }}
        />
      </div>

      <div
        className="font-semibold"
        style={{
          fontSize: isLarge ? 16 : 15,
          color: PALETTE.textPrimary,
          letterSpacing: "0.005em",
        }}
      >
        {tool.name}
      </div>
      <div
        className="mt-1"
        style={{
          fontSize: isLarge ? 13 : 12.5,
          color: PALETTE.textSub,
          opacity: 0.7,
        }}
      >
        {tool.description}
      </div>

      {/* Chevron slides in on hover — the only "indicator" we use. No dots,
          no badges, no checkmarks. Hover alone tells the card you can click. */}
      <div
        className="absolute right-5 bottom-5 opacity-0 -translate-x-1 transition-all duration-[250ms] ease-out group-hover:opacity-100 group-hover:translate-x-0"
        style={{ color: PALETTE.royalBlue }}
      >
        <ChevronRight size={18} strokeWidth={1.75} />
      </div>
    </Link>
  );
}
