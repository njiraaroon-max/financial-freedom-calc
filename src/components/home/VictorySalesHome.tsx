"use client";

/**
 * VictorySalesHome — Pyramid sales-mode for Victory's Modular flow.
 * ──────────────────────────────────────────────────────────────────
 * Replaces the standard 5-tile modular grid when:
 *   org.slug === "victory"  AND  planningMode === "modular"  AND
 *   features.victory_insurance_tools === true
 *
 * Layout: scroll-through pyramid (Option B from the UX discussion).
 *   1. Hero with the pyramid SVG visual at the top, all 4 layers
 *      labeled. Demo/Real badge floats at top-right.
 *   2. Below the visual, each layer is a full-width interactive
 *      card. Clicking enters the layer's 5-Act sales journey.
 *   3. Cross-cutting Tax + decision-helper Combo tools sit as a
 *      side row below the main 4 layers.
 *
 * Each layer card follows the same template (consistent UX so FAs
 * can navigate any layer from muscle memory):
 *   [Icon] [Label EN]                [→]
 *          [Label TH]
 *          [1-line pitch — what this layer answers for the customer]
 *          [Status pill: ยังไม่ได้ประเมิน / กำลังพอ / ครบแล้ว]
 *
 * Inline content is intentionally minimal in this shell commit —
 * the actual interactive 5-Act flow lives in per-layer route pages
 * under /calculators/sales/<layer>. Layers we haven't built yet
 * link to a friendly "Coming soon" placeholder so an FA exploring
 * the pyramid never hits a 404.
 */

import Link from "next/link";
import {
  ShieldAlert,    // Emergency
  Heart,          // Life
  HeartPulse,     // Health
  PiggyBank,      // Saving / Annuity
  Crown,          // Wealth Legacy
  Receipt,        // Tax (cross-cutting)
  Sparkles,       // Combo
  ChevronRight,
} from "lucide-react";
import { useOrganization } from "@/store/fa-session-store";
import { useProfileStore } from "@/store/profile-store";

// ─── Palette (Victory navy + gold) ─────────────────────────────────
const PALETTE = {
  deepNavy: "#0f1e33",
  navy: "#1e3a5f",
  gold: "#d6b56d",
  goldDark: "#b89150",
  goldSoft: "rgba(214,181,109,0.10)",
  bg: "#fafaf7",
  surface: "#ffffff",
  hairline: "rgba(15,30,51,0.10)",
  textPrimary: "#0f1e33",
  textSub: "#5a6478",
  textMuted: "#8a92a0",
};

// ─── Layer catalogue ───────────────────────────────────────────────

type LayerStatus = "not_started" | "in_progress" | "complete";

type PyramidLayer = {
  /** Stable key — used as DOM id for scroll-to and as route segment. */
  key: string;
  /** Tier in the pyramid, 1 = base, 4 = top. Used for visual sizing. */
  tier: 1 | 2 | 3 | 4;
  labelEn: string;
  labelTh: string;
  /** One-sentence pitch — what this layer answers for the customer. */
  pitch: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  /** Tailwind/CSS color for the layer's accent (gradient-from). */
  accentFrom: string;
  accentTo: string;
  /** Where the "เริ่มเลย" button goes. */
  href: string;
  /** True when the layer's UI is built and live. */
  ready: boolean;
};

// Note: the Protection tier (#2) holds TWO layers — Life + Health —
// rendered side-by-side in a single tier band. We model them as two
// separate entries with the same tier number so the visual + cards
// can group them together.
const LAYERS: PyramidLayer[] = [
  {
    key: "emergency",
    tier: 1,
    labelEn: "Emergency Fund",
    labelTh: "เงินสำรองฉุกเฉิน",
    pitch: "ตกงาน เจ็บป่วย หรือเหตุไม่คาดฝัน — มีเงินใช้ได้กี่เดือน?",
    Icon: ShieldAlert,
    accentFrom: "#64748b",
    accentTo: "#475569",
    href: "/calculators/sales/emergency",
    ready: true,
  },
  {
    key: "life",
    tier: 2,
    labelEn: "Life Protection",
    labelTh: "ทุนประกันชีวิต",
    pitch: "ถ้าจากไป ครอบครัวต้องการเงินเท่าไหร่ถึงจะอยู่ได้?",
    Icon: Heart,
    accentFrom: "#dc2626",
    accentTo: "#991b1b",
    href: "/calculators/sales/life",
    ready: true,
  },
  {
    key: "health",
    tier: 2,
    labelEn: "Health Protection",
    labelTh: "ประกันสุขภาพ",
    pitch: "ค่ารักษาเพิ่มขึ้นทุกปี — ทุนตอนนี้พอตอนอายุ 70 ไหม?",
    Icon: HeartPulse,
    accentFrom: "#0891b2",
    accentTo: "#0e7490",
    href: "/calculators/sales/health",
    ready: true,
  },
  {
    key: "annuity",
    tier: 3,
    labelEn: "Saving · Annuity",
    labelTh: "ออมเพื่อบำนาญ",
    pitch: "อยากมีบำนาญเท่าไหร่ตอน 60? + ลดหย่อนภาษี ฿200k/ปี",
    Icon: PiggyBank,
    accentFrom: "#10b981",
    accentTo: "#047857",
    href: "/calculators/sales/annuity",
    ready: true,
  },
  {
    key: "legacy",
    tier: 4,
    labelEn: "Wealth Legacy",
    labelTh: "ส่งต่อมรดก",
    pitch: "สร้างเงินก้อนใหญ่ ส่งต่อให้ลูกหลาน + คุ้มครองชีวิต ตลอด 99 ปี",
    Icon: Crown,
    accentFrom: "#d6b56d",
    accentTo: "#b89150",
    href: "/calculators/sales/legacy",
    ready: true, // ✅ live as of commit 2 — 5-Act sales journey ready
  },
];

const SIDE_TOOLS: PyramidLayer[] = [
  {
    key: "tax",
    tier: 1,
    labelEn: "Tax Planning",
    labelTh: "วางแผนภาษี",
    pitch: "เปรียบเทียบลดหย่อนแต่ละกรมธรรม์ + คำนวณภาษีโดยละเอียด",
    Icon: Receipt,
    accentFrom: "#7c3aed",
    accentTo: "#5b21b6",
    href: "/calculators/tax",
    ready: true, // existing tax calculator works
  },
  {
    key: "combo",
    tier: 1,
    labelEn: "Health × Savings Combo",
    labelTh: "เครื่องมือปิดการขาย",
    pitch: "ประกันสุขภาพ \"ฟรี\" — HSMHPDC × MDP 25/20",
    Icon: Sparkles,
    accentFrom: "#f59e0b",
    accentTo: "#b45309",
    href: "/calculators/insurance/health-savings-combo",
    ready: true, // already built
  },
];

// ─── Main component ────────────────────────────────────────────────

export default function VictorySalesHome() {
  const org = useOrganization();
  const profile = useProfileStore();
  const firstName = profile.name ? profile.name.split(" ")[0] : "";
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
      {/* ── 1. Hero with pyramid SVG ─────────────────────────────── */}
      <Hero
        firstName={firstName}
        orgName={orgName}
        logoUrl={logoUrl}
      />

      {/* ── 2. Pyramid layer cards ───────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 md:px-8 -mt-10 relative z-10">
        <PyramidLayers />
      </section>

      {/* ── 2.5 Quick Plan CTA (60-sec public assessment) ───────── */}
      <section className="max-w-5xl mx-auto px-5 md:px-8 mt-10">
        <Link
          href="/quick-plan"
          className="group block rounded-2xl overflow-hidden relative transition hover:scale-[1.01]"
          style={{
            background: `linear-gradient(135deg, ${PALETTE.deepNavy} 0%, ${PALETTE.navy} 100%)`,
            border: `1px solid ${PALETTE.gold}`,
            boxShadow: "0 10px 30px rgba(15,30,51,0.15)",
          }}
        >
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              top: "-20%",
              right: "-10%",
              width: "45%",
              height: "140%",
              background:
                "radial-gradient(circle, rgba(214,181,109,0.28) 0%, transparent 60%)",
              filter: "blur(40px)",
            }}
          />
          <div className="relative px-5 py-5 md:px-7 md:py-6 flex items-center gap-4 md:gap-5">
            <div
              className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${PALETTE.gold} 0%, ${PALETTE.goldDark} 100%)`,
                boxShadow: "0 4px 12px rgba(214,181,109,0.35)",
              }}
            >
              <Sparkles size={22} className="text-white" strokeWidth={2.2} />
            </div>
            <div className="flex-1 text-white min-w-0">
              <div
                className="text-[10px] md:text-[11px] font-bold tracking-[0.2em] mb-1"
                style={{ color: PALETTE.gold }}
              >
                QUICK PLAN · 60 วินาที
              </div>
              <div className="text-base md:text-lg font-bold leading-tight">
                ประเมิน Pyramid Score ของคุณ
              </div>
              <div className="text-xs md:text-sm opacity-75 mt-1 leading-snug">
                ตอบ 4 คำถามสั้นๆ ดูคะแนนและคำแนะนำเฉพาะคุณ
              </div>
            </div>
            <ChevronRight
              size={22}
              className="flex-shrink-0 text-white opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition"
            />
          </div>
        </Link>
      </section>

      {/* ── 3. Side tools (Tax + Combo) ──────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 md:px-8 mt-10 pb-20">
        <div className="text-[11px] font-bold tracking-[0.2em] text-gray-500 mb-3">
          เครื่องมือเสริม
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SIDE_TOOLS.map((t) => (
            <LayerCard key={t.key} layer={t} compact />
          ))}
        </div>
      </section>

      <footer
        className="max-w-5xl mx-auto px-5 md:px-8 pb-8 text-center text-[11px]"
        style={{ color: PALETTE.textSub, opacity: 0.6 }}
      >
        Victory Group · Insurance Sales Suite
      </footer>
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────

function Hero({
  firstName,
  orgName,
  logoUrl,
}: {
  firstName: string;
  orgName: string;
  logoUrl: string | null;
}) {
  return (
    <header
      className="relative overflow-hidden pb-20"
      style={{
        background: `linear-gradient(135deg, ${PALETTE.deepNavy} 0%, ${PALETTE.navy} 100%)`,
        color: "white",
      }}
    >
      {/* Aurora */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "-15%",
          right: "-10%",
          width: "55%",
          height: "70%",
          background:
            "radial-gradient(circle, rgba(214,181,109,0.30) 0%, rgba(214,181,109,0.10) 40%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* Top bar */}
      <div className="max-w-5xl mx-auto px-5 md:px-8 pt-6 flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={orgName}
              className="h-10 w-auto opacity-90"
            />
          ) : (
            <div className="text-sm font-bold tracking-[0.2em] opacity-90">
              {orgName.toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="max-w-5xl mx-auto px-5 md:px-8 pt-10 pb-6 relative">
        <div
          className="text-[11px] font-bold tracking-[0.25em] mb-2"
          style={{ color: PALETTE.gold }}
        >
          INSURANCE SALES SUITE
        </div>
        <h1 className="text-2xl md:text-4xl font-extrabold leading-tight">
          {firstName ? `สวัสดี ${firstName}` : "Pyramid การเงิน"}
        </h1>
        <p className="text-sm md:text-base opacity-80 mt-2 max-w-xl">
          วางแผนการเงินทีละชั้น เริ่มจากฐานที่มั่นคง สู่ยอดที่ส่งต่อความมั่งคั่ง
        </p>
      </div>

      {/* Pyramid SVG visual */}
      <div className="max-w-3xl mx-auto px-5 md:px-8 relative">
        <PyramidSvg />
      </div>
    </header>
  );
}

// ─── Pyramid SVG ───────────────────────────────────────────────────

function PyramidSvg() {
  // Single continuous isoceles triangle, divided into 4 horizontal
  // tiers by internal divider lines. The geometry:
  //
  //   apex     ── (50, 0)  ───────┐
  //              ╱ ╲                │ DISTRIBUTION (gold)
  //             ╱   ╲   ── y=25 ────┤
  //            ╱     ╲              │ SAVING
  //           ╱       ╲ ── y=50 ────┤
  //          ╱         ╲            │ PROTECTION
  //         ╱           ╲ ── y=75 ──┤
  //        ╱             ╲          │ FOUNDATION · INCOME
  //   (0,100)─────────(100,100) ────┘
  //
  // At any y ∈ [0,100], the triangle's width = y, with x extents
  // (50 - y/2) → (50 + y/2). We use this to clip the tier coordinates.
  //
  // Labels render as HTML overlays so Thai text stays selectable and
  // crisp on retina (SVG text antialiasing is uneven).

  const W = 100;
  const H = 100;

  // Tier metadata, top-down. y0/y1 are the % heights from the apex.
  const tiers = [
    { y0: 0,  y1: 25, label: "DISTRIBUTION",          gold: true  },
    { y0: 25, y1: 50, label: "SAVING",                gold: false },
    { y0: 50, y1: 75, label: "PROTECTION",            gold: false },
    { y0: 75, y1: 100, label: "FOUNDATION · INCOME",  gold: false },
  ];

  // Trapezoid points for a tier between y0 and y1.
  const trap = (y0: number, y1: number) =>
    `${50 - y0 / 2},${y0} ${50 + y0 / 2},${y0} ${50 + y1 / 2},${y1} ${50 - y1 / 2},${y1}`;

  return (
    <div className="relative w-full" style={{ aspectRatio: "5/3" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
           className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="navyTier" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="rgba(255,255,255,0.10)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
          </linearGradient>
          <linearGradient id="goldTier" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor={PALETTE.gold} />
            <stop offset="100%" stopColor={PALETTE.goldDark} />
          </linearGradient>
        </defs>

        {/* Tier polygons — fill the triangle continuously, no gaps. */}
        {tiers.map((t, i) => {
          // Apex tier is a triangle (y0=0 collapses to a point), others trapezoids
          const points = t.y0 === 0
            ? `50,0 ${50 + t.y1 / 2},${t.y1} ${50 - t.y1 / 2},${t.y1}`
            : trap(t.y0, t.y1);
          return (
            <polygon
              key={i}
              points={points}
              fill={t.gold ? "url(#goldTier)" : "url(#navyTier)"}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={0.25}
            />
          );
        })}

        {/* Outer triangle outline — thin for crisp edge */}
        <polygon
          points={`50,0 100,100 0,100`}
          fill="none"
          stroke="rgba(255,255,255,0.30)"
          strokeWidth={0.4}
        />
      </svg>

      {/* Tier labels — HTML overlays, centered in each tier band */}
      <div className="absolute inset-0">
        {tiers.map((t, i) => {
          const midY = (t.y0 + t.y1) / 2;
          return (
            <div
              key={i}
              className="absolute left-0 right-0 flex items-center justify-center text-[10px] md:text-[11px] font-bold tracking-[0.2em] pointer-events-none"
              style={{
                top: `${midY}%`,
                transform: "translateY(-50%)",
                color: t.gold ? PALETTE.deepNavy : "rgba(255,255,255,0.85)",
              }}
            >
              {t.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Pyramid layer cards (interactive) ─────────────────────────────

function PyramidLayers() {
  // Render top-down so the customer reads "ยอด → ฐาน" matching the
  // visual — Wealth Legacy first, Emergency last. This is also the
  // sales narrative: "everything below supports the legacy on top."
  const byTier = [4, 3, 2, 1];
  return (
    <div className="space-y-4">
      {byTier.map((tier) => {
        const layersAtTier = LAYERS.filter((l) => l.tier === tier);
        if (layersAtTier.length === 0) return null;

        if (layersAtTier.length === 1) {
          return <LayerCard key={tier} layer={layersAtTier[0]} />;
        }
        // Multiple layers at the same tier → side-by-side grid
        return (
          <div
            key={tier}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {layersAtTier.map((l) => (
              <LayerCard key={l.key} layer={l} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function LayerCard({
  layer,
  compact = false,
}: {
  layer: PyramidLayer;
  compact?: boolean;
}) {
  const cardContent = (
    <div
      className={`rounded-2xl p-5 border transition-all hover:shadow-lg active:scale-[0.99] cursor-pointer flex items-start gap-4 h-full ${
        layer.ready ? "" : "opacity-75"
      }`}
      style={{
        background: PALETTE.surface,
        borderColor: PALETTE.hairline,
      }}
    >
      <div
        className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${layer.accentFrom} 0%, ${layer.accentTo} 100%)`,
        }}
      >
        <layer.Icon size={22} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="text-[10px] font-bold tracking-[0.18em]"
            style={{ color: PALETTE.textMuted }}
          >
            {layer.labelEn.toUpperCase()}
          </div>
          {!layer.ready && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
              SOON
            </span>
          )}
        </div>
        <div
          className="text-base font-bold mt-0.5"
          style={{ color: PALETTE.textPrimary }}
        >
          {layer.labelTh}
        </div>
        {!compact && (
          <div
            className="text-[13px] mt-1.5 leading-relaxed"
            style={{ color: PALETTE.textSub }}
          >
            {layer.pitch}
          </div>
        )}
      </div>
      <ChevronRight
        size={18}
        className="self-center shrink-0"
        style={{ color: layer.ready ? PALETTE.gold : PALETTE.textMuted }}
      />
    </div>
  );

  return layer.ready ? (
    <Link href={layer.href} className="block">
      {cardContent}
    </Link>
  ) : (
    <Link href="/calculators/sales/coming-soon" className="block">
      {cardContent}
    </Link>
  );
}

