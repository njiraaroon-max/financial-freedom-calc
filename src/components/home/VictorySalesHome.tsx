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

import { useEffect, useState } from "react";
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
  Settings as SettingsIcon,
  X,
  CheckCircle2,
  Lock,
} from "lucide-react";
import {
  useFaSessionStore,
  useDemoMode,
  useOrganization,
} from "@/store/fa-session-store";
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
    ready: false,
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
    ready: false,
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
    ready: false,
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
    ready: false,
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
    ready: false, // will flip true in commit 2
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
  const demoMode = useDemoMode();
  const profile = useProfileStore();
  const firstName = profile.name ? profile.name.split(" ")[0] : "";
  const orgName = org?.name ?? "Victory Group";
  const logoUrl = org?.logoDarkUrl ?? org?.logoUrl ?? null;
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        demoMode={demoMode}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* ── 2. Pyramid layer cards ───────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 md:px-8 -mt-10 relative z-10">
        <PyramidLayers />
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

      {/* ── 4. Settings modal (Demo/Real toggle) ─────────────────── */}
      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}

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
  demoMode,
  onOpenSettings,
}: {
  firstName: string;
  orgName: string;
  logoUrl: string | null;
  demoMode: boolean;
  onOpenSettings: () => void;
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
        <div className="flex items-center gap-2">
          {/* Demo Mode badge — visible to customer for trust */}
          <DemoBadge active={demoMode} />
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg hover:bg-white/10 transition"
            aria-label="ตั้งค่า"
          >
            <SettingsIcon size={18} className="opacity-80" />
          </button>
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

function DemoBadge({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border"
      style={{
        background: "rgba(255,200,100,0.15)",
        borderColor: "rgba(255,200,100,0.4)",
        color: "#ffd285",
      }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: "#ffd285" }}
      />
      DEMO · ไม่บันทึก
    </div>
  );
}

// ─── Pyramid SVG ───────────────────────────────────────────────────

function PyramidSvg() {
  // Each tier is a trapezoid, narrowing toward the top. We render with
  // CSS clip-path on rectangular divs so the layer labels stay HTML
  // (selectable, accessible) rather than baked into SVG text.
  // Tier widths in % of pyramid base width.
  const tiers = [
    { width: 100, label: "FOUNDATION · INCOME" },
    { width: 80, label: "PROTECTION" },
    { width: 60, label: "SAVING" },
    { width: 35, label: "DISTRIBUTION" },
  ];

  return (
    <div className="relative w-full" style={{ aspectRatio: "5/3" }}>
      <div className="absolute inset-0 flex flex-col-reverse items-center justify-end gap-1.5">
        {tiers.map((t, i) => (
          <div
            key={i}
            className="relative flex items-center justify-center text-[10px] md:text-[11px] font-bold tracking-[0.2em]"
            style={{
              width: `${t.width}%`,
              height: `${(100 - i * 4) / tiers.length}%`,
              background: i === tiers.length - 1
                ? `linear-gradient(135deg, ${PALETTE.gold} 0%, ${PALETTE.goldDark} 100%)`
                : "rgba(255,255,255,0.05)",
              border: `1px solid ${i === tiers.length - 1 ? PALETTE.gold : "rgba(255,255,255,0.20)"}`,
              clipPath:
                i === tiers.length - 1
                  ? "polygon(50% 0%, 100% 100%, 0% 100%)" // top = triangle
                  : `polygon(${5 + i * 3}% 0%, ${95 - i * 3}% 0%, 100% 100%, 0% 100%)`,
              color: i === tiers.length - 1 ? PALETTE.deepNavy : "rgba(255,255,255,0.7)",
            }}
          >
            <span className="relative z-10 text-center px-2">
              {t.label}
            </span>
          </div>
        ))}
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

// ─── Settings modal (Demo/Real toggle) ─────────────────────────────

function SettingsModal({ onClose }: { onClose: () => void }) {
  const demoMode = useDemoMode();
  const setDemoMode = useFaSessionStore((s) => s.setDemoMode);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md md:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 px-5 py-4 flex items-center justify-between z-10 md:rounded-t-2xl rounded-t-2xl"
          style={{ background: PALETTE.deepNavy, color: "white" }}
        >
          <div className="flex items-center gap-2">
            <SettingsIcon size={18} />
            <h3 className="text-sm font-bold">ตั้งค่า</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Demo / Real toggle */}
          <div>
            <div className="text-xs font-bold text-gray-700 mb-3">
              โหมดการทำงาน
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDemoMode(false)}
                className={`p-3 rounded-xl border-2 text-left transition ${
                  !demoMode
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2
                    size={14}
                    className={!demoMode ? "text-emerald-600" : "text-gray-300"}
                  />
                  <div className="text-[11px] font-bold tracking-[0.15em] text-gray-700">
                    REAL
                  </div>
                </div>
                <div className="text-sm font-bold mt-1 text-gray-800">
                  ลูกค้าจริง
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                  บันทึกข้อมูลในโปรไฟล์ลูกค้า
                </div>
              </button>
              <button
                onClick={() => setDemoMode(true)}
                className={`p-3 rounded-xl border-2 text-left transition ${
                  demoMode
                    ? "border-amber-500 bg-amber-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Lock
                    size={14}
                    className={demoMode ? "text-amber-600" : "text-gray-300"}
                  />
                  <div className="text-[11px] font-bold tracking-[0.15em] text-gray-700">
                    DEMO
                  </div>
                </div>
                <div className="text-sm font-bold mt-1 text-gray-800">
                  สาธิต / Prospect
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                  ไม่บันทึก ข้อมูลลูกค้าจริงไม่ถูกแก้
                </div>
              </button>
            </div>
            <div className="text-[11px] text-gray-400 mt-2 leading-relaxed">
              {demoMode
                ? "🟡 อยู่ใน Demo Mode — ตัวเลขที่กรอกจะอยู่บนหน้าจอเท่านั้น ไม่บันทึกลงโปรไฟล์ลูกค้า รีเซ็ตเมื่อ refresh หน้า"
                : "🟢 อยู่ใน Real Mode — ตัวเลขที่กรอกจะบันทึกลงโปรไฟล์ลูกค้าตามปกติ"}
            </div>
          </div>

          {/* Future settings can be added here */}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition"
            style={{ background: PALETTE.deepNavy, color: "white" }}
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
}
