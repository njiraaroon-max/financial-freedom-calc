"use client";

/**
 * /calculators/sales/annuity — Saving · Annuity layer (Pyramid tier 3).
 *
 * Wraps both Allianz tax-deductible annuities:
 *   • MAFA9005 (5-pay, annuity 60-90, entry 40-55)
 *   • MAPA85A55 (pay-until-55, annuity 55-85, entry 25-50)
 *
 * Sales pitch: "ออมเพื่อบำนาญ + ลดหย่อนภาษี ฿200k/ปี" — combines
 * retirement safety with tax efficiency. The headline number is the
 * monthly annuity income at retirement, not the SA itself.
 */

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  PiggyBank,
  Calendar,
  Users,
  ArrowDown,
  ArrowUp,
  TrendingUp,
  Award,
  Receipt,
  CheckCircle2,
  Printer,
  Share2,
  Info,
  Sparkles,
  Target,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import FlagGate from "@/components/FlagGate";
import { useProfileStore } from "@/store/profile-store";
import {
  computeAnnuity,
  type AnnuityProductResult,
} from "@/types/annuity-saving";
import {
  ProgressNav,
  ActHeader,
  VerdictCard,
  SummaryBullet,
  Disclaimer,
  NextActButton,
  CustomerLine,
  useActiveAct,
  PAL,
  fmtBaht,
  fmtBahtShort,
} from "@/components/sales/SalesShell";

// ═══════════════════════════════════════════════════════════════════
// Page entry
// ═══════════════════════════════════════════════════════════════════

export default function AnnuityPage() {
  return (
    <FlagGate
      flag="victory_insurance_tools"
      fallbackEnabled={false}
      deniedTitle="ฟีเจอร์นี้สำหรับ Victory เท่านั้น"
      backHref="/"
      backLabel="กลับหน้าหลัก"
    >
      <AnnuityInner />
    </FlagGate>
  );
}

function AnnuityInner() {
  const profile = useProfileStore();

  const [dob, setDob] = useState(profile.birthDate || "");
  const [gender, setGender] = useState<"M" | "F">(profile.gender ?? "M");
  // Customer thinks in "บำนาญรายเดือน ตอนเกษียณ" — derive SA from that.
  // Annuity per year = 10% × SA → so SA = monthlyGoal × 12 / 0.10
  const [monthlyGoal, setMonthlyGoal] = useState<number>(20_000);

  const entryAge = useMemo(() => calcAge(dob), [dob]);
  const sumAssured = monthlyGoal * 12 / 0.10; // 10% of SA per year = annuity

  const compute = useMemo(() => {
    if (entryAge == null) return null;
    return computeAnnuity({ entryAge, gender, sumAssured });
  }, [entryAge, gender, sumAssured]);

  // Pick the recommended product (or first available)
  const recommendedProduct: AnnuityProductResult | null = useMemo(() => {
    if (!compute || compute.products.length === 0) return null;
    if (compute.recommended) {
      return compute.products.find((p) => p.product === compute.recommended) ?? compute.products[0];
    }
    return compute.products[0];
  }, [compute]);

  // Sticky-nav refs
  const refs = {
    1: useRef<HTMLElement | null>(null),
    2: useRef<HTMLElement | null>(null),
    3: useRef<HTMLElement | null>(null),
    4: useRef<HTMLElement | null>(null),
    5: useRef<HTMLElement | null>(null),
  };
  const activeAct = useActiveAct(refs);
  const jump = (a: 1 | 2 | 3 | 4 | 5) =>
    refs[a].current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-screen" style={{ background: "#fafaf7" }}>
      <PageHeader
        title="ออมเพื่อบำนาญ"
        subtitle="Saving · Annuity"
        backHref="/"
        icon={<PiggyBank size={18} style={{ color: PAL.green }} />}
      />

      <ProgressNav
        active={activeAct}
        onJump={jump}
        labels={["เริ่ม", "สรุป", "Timeline", "เทียบ", "Action Plan"]}
      />

      <div className="px-4 md:px-8 max-w-3xl mx-auto pb-24 space-y-12">
        <Act1
          ref={refs[1]}
          dob={dob}
          setDob={setDob}
          gender={gender}
          setGender={setGender}
          monthlyGoal={monthlyGoal}
          setMonthlyGoal={setMonthlyGoal}
          entryAge={entryAge}
          onNext={() => jump(2)}
        />

        {recommendedProduct ? (
          <>
            <Act2 ref={refs[2]} product={recommendedProduct} entryAge={entryAge!} gender={gender} onNext={() => jump(3)} />
            <Act3 ref={refs[3]} product={recommendedProduct} onNext={() => jump(4)} />
            <Act4 ref={refs[4]} products={compute!.products} recommended={compute!.recommended} onNext={() => jump(5)} />
            <Act5 ref={refs[5]} product={recommendedProduct} entryAge={entryAge!} />
          </>
        ) : (
          <ErrorBlock entryAge={entryAge} />
        )}
      </div>
    </div>
  );
}

function ErrorBlock({ entryAge }: { entryAge: number | null }) {
  const msg = entryAge == null
    ? "กรุณากรอกวันเกิดเพื่อดูแผน"
    : entryAge < 25 || entryAge > 55
      ? `อายุ ${entryAge} อยู่นอกช่วงที่ Allianz รับสมัครบำนาญ (25-55 ปี)`
      : "ไม่พบผลิตภัณฑ์บำนาญที่เหมาะ";
  return (
    <div className="rounded-xl p-4 border flex items-start gap-2 bg-amber-50 border-amber-200">
      <Info size={16} className="shrink-0 mt-0.5 text-amber-700" />
      <div className="text-[13px] text-amber-900">{msg}</div>
    </div>
  );
}

function calcAge(dobIso: string): number | null {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let y = today.getFullYear() - dob.getFullYear();
  let m = today.getMonth() - dob.getMonth();
  const d = today.getDate() - dob.getDate();
  if (d < 0) m--;
  if (m < 0) { y--; m += 12; }
  return m >= 6 ? y + 1 : y;
}

// ═══════════════════════════════════════════════════════════════════
// ACT 1 — Hello (DOB / Gender / Monthly annuity goal)
// ═══════════════════════════════════════════════════════════════════

const Act1 = forwardRef<
  HTMLElement,
  {
    dob: string; setDob: (v: string) => void;
    gender: "M" | "F"; setGender: (v: "M" | "F") => void;
    monthlyGoal: number; setMonthlyGoal: (v: number) => void;
    entryAge: number | null;
    onNext: () => void;
  }
>(function Act1({ dob, setDob, gender, setGender, monthlyGoal, setMonthlyGoal, entryAge, onNext }, ref) {
  const GOAL_CHIPS = [10_000, 20_000, 30_000, 50_000, 100_000];

  return (
    <section ref={ref} data-act={1} className="pt-6 scroll-mt-16">
      <ActHeader actNumber={1} title="วางแผนบำนาญของคุณ" subtitle="ตอนเกษียณ อยากได้บำนาญเดือนละเท่าไหร่?" />

      <div
        className="rounded-2xl p-5 md:p-6"
        style={{
          background: `linear-gradient(135deg, ${PAL.deepNavy} 0%, ${PAL.navy} 100%)`,
          color: "white",
        }}
      >
        <div className="text-[11px] font-bold tracking-[0.2em] mb-1" style={{ color: PAL.green }}>
          ANNUITY · TAX DEDUCTIBLE
        </div>
        <h2 className="text-lg font-bold leading-snug mb-1">
          ออมสั้น รับบำนาญยาว — ลดหย่อนภาษีได้ ฿200,000/ปี
        </h2>
        <p className="text-[13px] opacity-80 leading-relaxed">
          จ่ายช่วงทำงาน · รับบำนาญรายปี 10% ของทุน ตั้งแต่อายุ 55 หรือ 60 จนถึง 85-90 ปี
        </p>
      </div>

      <div className="bg-white rounded-2xl p-5 mt-4 space-y-5 shadow-sm border border-gray-100">
        <div>
          <label className="text-[12px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
            <Calendar size={13} /> วันเกิด
          </label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full text-base font-semibold bg-gray-50 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-emerald-500 transition"
          />
          {entryAge != null && (
            <div className="text-[12px] text-gray-500 mt-1.5">อายุ {entryAge} ปี</div>
          )}
        </div>

        <div>
          <label className="text-[12px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
            <Users size={13} /> เพศ
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["M", "F"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`py-2.5 rounded-xl border-2 text-sm font-bold transition ${
                  gender === g
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-gray-200 hover:border-gray-300 text-gray-500"
                }`}
              >
                {g === "M" ? "ชาย" : "หญิง"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[12px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
            <Target size={13} /> บำนาญที่อยากได้ตอนเกษียณ (เดือน)
          </label>
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {GOAL_CHIPS.map((g) => (
              <button
                key={g}
                onClick={() => setMonthlyGoal(g)}
                className={`py-2 rounded-lg border text-[12px] font-bold transition ${
                  monthlyGoal === g
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-gray-200 hover:border-gray-300 text-gray-500"
                }`}
              >
                ฿{(g / 1000).toFixed(0)}k
              </button>
            ))}
          </div>
          <div className="text-[11px] text-gray-400">
            = ทุนประกัน ฿{fmtBaht((monthlyGoal * 12) / 0.10)} (บำนาญรายปี = 10% ของทุน)
          </div>
        </div>
      </div>

      {entryAge != null && (
        <NextActButton
          onClick={onNext}
          label="ดูแผนบำนาญของคุณ →"
          variant="navy"
          icon={<Sparkles size={16} />}
        />
      )}
    </section>
  );
});

// ═══════════════════════════════════════════════════════════════════
// ACT 2 — Verdict
// ═══════════════════════════════════════════════════════════════════

const Act2 = forwardRef<
  HTMLElement,
  { product: AnnuityProductResult; entryAge: number; gender: "M" | "F"; onNext: () => void }
>(function Act2({ product, entryAge, gender, onNext }, ref) {
  // Use 3.30% scenario as the headline (it's the higher of the two
  // published scenarios — most optimistic but still labeled "ประมาณการ").
  const middle = product.scenarios[1] ?? product.scenarios[0];
  return (
    <section ref={ref} data-act={2} className="scroll-mt-16">
      <ActHeader actNumber={2} title="แผนสุทธิของคุณ" subtitle="3 คำถามที่ลูกค้าอยากรู้" />
      <CustomerLine
        gender={gender}
        age={entryAge}
        extra={`บำนาญเป้าหมาย ฿${fmtBahtShort(product.annuityPerYear / 12)}/เดือน`}
      />

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <VerdictCard
          tone="red" icon={<ArrowDown size={14} />}
          label="จ่าย"
          mainValue={`฿${fmtBahtShort(product.annualPremium)}`}
          mainSub={`× ${product.payYears} ปี`}
          footer={`รวม ฿${fmtBahtShort(product.totalPremium)}`}
        />
        <VerdictCard
          tone="green" icon={<ArrowUp size={14} />}
          label="ได้บำนาญ"
          mainValue={`฿${fmtBahtShort(product.annuityPerYear)}`}
          mainSub={`× ${product.annuityYears} ปี (อายุ ${product.annuityStartAge}-${product.annuityEndAge})`}
          footer={`รวม ฿${fmtBahtShort(product.totalGuaranteedAnnuity)} (การันตี)`}
        />
        <VerdictCard
          tone="gold" icon={<Award size={14} />}
          label="ทำกำไร"
          mainValue={`${middle.multiple.toFixed(2)}x`}
          mainSub={`@ ปันผล ${(middle.investmentReturn * 100).toFixed(2)}%`}
          footer={`+฿${fmtBahtShort(middle.net)} สุทธิ`}
        />
      </div>

      <div
        className="mt-4 rounded-2xl p-4 text-center"
        style={{ background: PAL.greenSoft, borderLeft: `3px solid ${PAL.green}` }}
      >
        <div className="text-[13px] leading-relaxed" style={{ color: PAL.deepNavy }}>
          💚 <span className="font-bold">บำนาญแน่นอนตลอด {product.annuityYears} ปี</span> + ลดหย่อนภาษี ฿{fmtBaht(product.taxDeductibleAnnualPremium)}/ปี
        </div>
        <div className="text-[11px] text-gray-500 mt-1">
          {product.productLabel} · ไม่ต้องตรวจสุขภาพ ไม่ต้องตอบคำถามสุขภาพ
        </div>
      </div>

      <NextActButton
        onClick={onNext}
        label="ดู Timeline ทั้งหมด →"
        icon={<TrendingUp size={16} />}
      />
    </section>
  );
});

// ═══════════════════════════════════════════════════════════════════
// ACT 3 — Timeline (paying years → annuity years)
// ═══════════════════════════════════════════════════════════════════

const Act3 = forwardRef<
  HTMLElement,
  { product: AnnuityProductResult; onNext: () => void }
>(function Act3({ product, onNext }, ref) {
  return (
    <section ref={ref} data-act={3} className="scroll-mt-16">
      <ActHeader actNumber={3} title="📅 Timeline ของแผน" subtitle="ช่วงจ่าย vs ช่วงรับบำนาญ" />

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <TimelineChart product={product} />

        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-xl p-3 border" style={{ background: PAL.redSoft, borderColor: PAL.red }}>
            <div className="text-[10px] font-bold tracking-[0.15em]" style={{ color: PAL.red }}>
              💸 ช่วงจ่ายเบี้ย
            </div>
            <div className="text-base font-extrabold mt-1" style={{ color: PAL.deepNavy }}>
              {product.payYears} ปี
            </div>
            <div className="text-[12px] text-gray-600 mt-1 leading-tight">
              ฿{fmtBahtShort(product.annualPremium)}/ปี <br />
              รวม ฿{fmtBahtShort(product.totalPremium)}
            </div>
          </div>
          <div className="rounded-xl p-3 border" style={{ background: PAL.greenSoft, borderColor: PAL.green }}>
            <div className="text-[10px] font-bold tracking-[0.15em]" style={{ color: PAL.green }}>
              💰 ช่วงรับบำนาญ
            </div>
            <div className="text-base font-extrabold mt-1" style={{ color: PAL.deepNavy }}>
              {product.annuityYears} ปี
            </div>
            <div className="text-[12px] text-gray-600 mt-1 leading-tight">
              อายุ {product.annuityStartAge}-{product.annuityEndAge}<br />
              ฿{fmtBahtShort(product.annuityPerYear)}/ปี (การันตี)
            </div>
          </div>
        </div>
      </div>

      {/* Scenarios with multiplier */}
      <div className="mt-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="text-[11px] font-bold text-gray-500 mb-2">ประมาณการตามผลตอบแทนการลงทุน</div>
        <div className="space-y-2">
          {/* Guaranteed row */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <div className="text-[12px] font-bold text-gray-800">การันตี (ไม่รวมปันผล)</div>
              <div className="text-[11px] text-gray-500">
                บำนาญรวม ฿{fmtBahtShort(product.totalGuaranteedAnnuity)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-extrabold" style={{ color: product.netGuaranteed >= 0 ? PAL.green : PAL.red }}>
                {product.netGuaranteed >= 0 ? "+" : "-"}฿{fmtBahtShort(Math.abs(product.netGuaranteed))}
              </div>
              <div className="text-[10px] text-gray-500">{(product.totalGuaranteedAnnuity / product.totalPremium).toFixed(2)}x</div>
            </div>
          </div>
          {/* Dividend scenarios */}
          {product.scenarios.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <div>
                <div className="text-[12px] font-bold text-gray-800">+ ปันผล @ {(s.investmentReturn * 100).toFixed(2)}%</div>
                <div className="text-[11px] text-gray-500">
                  บำนาญรวม ฿{fmtBahtShort(s.totalAnnuity)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold" style={{ color: PAL.green }}>
                  +฿{fmtBahtShort(s.net)}
                </div>
                <div className="text-[10px] font-bold" style={{ color: PAL.goldDark }}>{s.multiple.toFixed(2)}x</div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-gray-400 mt-2 leading-relaxed">
          📌 ปันผลเป็นการประมาณการ ไม่การันตี · บริษัทพิจารณาตามผลการลงทุนแต่ละปี
        </div>
      </div>

      <NextActButton onClick={onNext} label="เปรียบเทียบกับผลิตภัณฑ์อื่น →" />
    </section>
  );
});

// Simple horizontal timeline visualization
function TimelineChart({ product }: { product: AnnuityProductResult }) {
  const W = 720, H = 100;
  const pad = { l: 16, r: 16, t: 30, b: 25 };
  const innerW = W - pad.l - pad.r;
  // Map: year 0 (entry) → year (annuityEndAge - entryAge) on x axis
  // We don't know the entry age here, but we can use payYears + (annuityEnd - annuityStart)
  // Entry age = annuityStart - payYears (for MAFA9005: 60-5=55 NO, 5-pay anyone of 40-55) ... actually for MAPA85A55 entry = 55 - payYears.
  // For visualization we just show: payPhase (red) → gap (gray) → annuityPhase (green)
  // For MAFA9005: pay 5y, gap (60 - entryAge - 5), annuity 31y
  // For MAPA85A55: pay (55-entryAge)y, no gap, annuity 31y
  // Simplest: draw 2 bars proportional
  const totalSegments = product.payYears + product.annuityYears;
  const payWidth = (product.payYears / totalSegments) * innerW;
  const annuityWidth = (product.annuityYears / totalSegments) * innerW;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* Pay segment */}
      <rect x={pad.l} y={pad.t} width={payWidth} height={28} fill={PAL.red} rx={3} />
      <text x={pad.l + payWidth / 2} y={pad.t + 18} textAnchor="middle"
            className="text-[12px] font-bold fill-white">
        จ่ายเบี้ย {product.payYears} ปี
      </text>
      {/* Annuity segment */}
      <rect x={pad.l + payWidth + 4} y={pad.t} width={annuityWidth - 4} height={28} fill={PAL.green} rx={3} />
      <text x={pad.l + payWidth + (annuityWidth / 2)} y={pad.t + 18} textAnchor="middle"
            className="text-[12px] font-bold fill-white">
        รับบำนาญ {product.annuityYears} ปี
      </text>
      {/* Labels under */}
      <text x={pad.l} y={pad.t + 48} className="text-[10px] fill-gray-500">
        เริ่ม
      </text>
      <text x={pad.l + payWidth} y={pad.t + 48} textAnchor="middle" className="text-[10px] fill-gray-500">
        อายุ {product.annuityStartAge}
      </text>
      <text x={W - pad.r} y={pad.t + 48} textAnchor="end" className="text-[10px] fill-gray-500">
        อายุ {product.annuityEndAge}
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACT 4 — Compare both products (MAFA9005 vs MAPA85A55)
// ═══════════════════════════════════════════════════════════════════

const Act4 = forwardRef<
  HTMLElement,
  {
    products: AnnuityProductResult[];
    recommended: "MAFA9005" | "MAPA85A55" | null;
    onNext: () => void;
  }
>(function Act4({ products, recommended, onNext }, ref) {
  return (
    <section ref={ref} data-act={4} className="scroll-mt-16">
      <ActHeader
        actNumber={4}
        title="⚖ ผลิตภัณฑ์ไหนเหมาะกับคุณ"
        subtitle={products.length === 1 ? "อายุนี้รับสมัครได้แค่ตัวเดียว" : "อายุนี้รับสมัครได้ทั้ง 2 ตัว"}
      />

      <div className={`grid grid-cols-1 ${products.length > 1 ? "md:grid-cols-2" : ""} gap-3`}>
        {products.map((p) => {
          const isRec = recommended === p.product;
          return (
            <div
              key={p.product}
              className="bg-white rounded-2xl p-4 shadow-sm border-2 relative"
              style={{ borderColor: isRec ? PAL.green : "#e5e7eb" }}
            >
              {isRec && (
                <div
                  className="absolute -top-2 left-3 px-2 py-0.5 rounded text-[10px] font-bold tracking-[0.15em]"
                  style={{ background: PAL.green, color: "white" }}
                >
                  ★ แนะนำ
                </div>
              )}
              <div className="text-[10px] font-bold tracking-[0.15em] text-gray-500">
                {p.product}
              </div>
              <div className="text-base font-bold mt-0.5" style={{ color: PAL.deepNavy }}>
                {p.productLabel}
              </div>
              <div className="text-[12px] text-gray-500 mt-0.5">
                จ่าย {p.payYears} ปี · บำนาญ {p.annuityYears} ปี (อายุ {p.annuityStartAge}-{p.annuityEndAge})
              </div>

              <div className="mt-3 space-y-1.5">
                <CompareRow label="เบี้ย/ปี" value={`฿${fmtBahtShort(p.annualPremium)}`} />
                <CompareRow label="รวมจ่าย" value={`฿${fmtBahtShort(p.totalPremium)}`} />
                <CompareRow label="บำนาญ/ปี (การันตี)" value={`฿${fmtBahtShort(p.annuityPerYear)}`} />
                <CompareRow label="รวมบำนาญ (การันตี)" value={`฿${fmtBahtShort(p.totalGuaranteedAnnuity)}`} />
                <CompareRow
                  label="กำไรสุทธิ (@ 3.30%)"
                  value={`+฿${fmtBahtShort((p.scenarios[1] ?? p.scenarios[0]).net)}`}
                  highlight
                />
                <CompareRow
                  label="ทำกำไร"
                  value={`${(p.scenarios[1] ?? p.scenarios[0]).multiple.toFixed(2)}x`}
                  highlight
                />
              </div>
            </div>
          );
        })}
      </div>

      {products.length === 2 && recommended && (
        <div
          className="mt-3 rounded-xl p-3.5 border flex items-start gap-2"
          style={{ background: PAL.greenSoft, borderColor: PAL.green }}
        >
          <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: PAL.green }} />
          <div className="text-[12px] text-gray-700 leading-relaxed">
            <span className="font-bold" style={{ color: PAL.deepNavy }}>แนะนำ {products.find((p) => p.product === recommended)?.productLabel}</span>{" "}
            เพราะเริ่มรับบำนาญที่อายุ {products.find((p) => p.product === recommended)?.annuityStartAge} ปี
            (เร็วกว่าอีกตัว 5 ปี) — เหมาะกับคนที่อยากเกษียณเร็ว
          </div>
        </div>
      )}

      <NextActButton onClick={onNext} label="ดูสรุปแผน →" />
    </section>
  );
});

function CompareRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <div className={`text-[12px] ${highlight ? "font-bold text-emerald-700" : "text-gray-600"}`}>{label}</div>
      <div
        className={`text-sm font-extrabold tabular-nums ${highlight ? "text-emerald-700" : ""}`}
        style={{ color: highlight ? undefined : PAL.deepNavy }}
      >
        {value}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACT 5 — Summary
// ═══════════════════════════════════════════════════════════════════

const Act5 = forwardRef<
  HTMLElement,
  { product: AnnuityProductResult; entryAge: number }
>(function Act5({ product, entryAge }, ref) {
  const profile = useProfileStore();
  const middle = product.scenarios[1] ?? product.scenarios[0];
  const customerName = profile.name || "คุณ";

  return (
    <section ref={ref} data-act={5} className="scroll-mt-16">
      <ActHeader actNumber={5} title="📋 สรุปแผนสำหรับคุณ" subtitle="ก่อนตัดสินใจ" />

      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${PAL.green} 0%, #047857 100%)` }}
          >
            <PiggyBank size={22} className="text-white" />
          </div>
          <div>
            <div className="text-base font-bold" style={{ color: PAL.deepNavy }}>{customerName}</div>
            <div className="text-[12px] text-gray-500">
              {product.productLabel} · อายุ {entryAge}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <SummaryBullet
            icon={<ArrowDown size={14} className="text-rose-600" />}
            title="จ่ายเบี้ยประกัน"
            body={`฿${fmtBaht(product.annualPremium)}/ปี × ${product.payYears} ปี (รวม ฿${fmtBaht(product.totalPremium)})`}
            sub={`ตั้งแต่อายุ ${entryAge} → ${entryAge + product.payYears - 1}`}
          />
          <SummaryBullet
            icon={<ArrowUp size={14} className="text-emerald-600" />}
            title={`รับบำนาญตั้งแต่อายุ ${product.annuityStartAge}`}
            body={`฿${fmtBaht(product.annuityPerYear)}/ปี การันตี × ${product.annuityYears} ปี`}
            sub={`= ฿${fmtBaht(product.annuityPerYear / 12)}/เดือน · รวมการันตี ฿${fmtBaht(product.totalGuaranteedAnnuity)}`}
          />
          <SummaryBullet
            icon={<Award size={14} className="text-amber-600" />}
            title="ประมาณการรวม @ ปันผล 3.30%"
            body={`฿${fmtBaht(middle.totalAnnuity)} (กำไรสุทธิ +฿${fmtBaht(middle.net)})`}
            sub={`ทำกำไร ${middle.multiple.toFixed(2)} เท่าของเบี้ย`}
          />
          <SummaryBullet
            icon={<Receipt size={14} className="text-violet-600" />}
            title="ลดหย่อนภาษีบำนาญ"
            body={`฿${fmtBaht(product.taxDeductibleAnnualPremium)}/ปี (สูงสุด ฿200k)`}
            sub="แยกต่างหากจากลดหย่อนประกันชีวิตทั่วไป (฿100k)"
          />
        </div>

        <div className="mt-5">
          <Disclaimer
            bullets={[
              "เงินปันผลเป็นการประมาณการ ไม่การันตี",
              "ถ้าเลิกกรมธรรม์ก่อน 10 ปี อาจถูกเรียกคืนสิทธิลดหย่อนภาษี",
              "ผลประโยชน์จริงเป็นไปตามกรมธรรม์ที่บริษัทออกให้",
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <button
          onClick={() => typeof window !== "undefined" && window.print()}
          className="py-3 rounded-xl text-sm font-bold border-2 transition active:scale-[0.99] flex items-center justify-center gap-2"
          style={{ borderColor: PAL.deepNavy, color: PAL.deepNavy }}
        >
          <Printer size={14} /> พิมพ์ / PDF
        </button>
        <button
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.share) {
              navigator.share({
                title: product.productLabel,
                text: `แผนของคุณ: บำนาญ ฿${fmtBahtShort(product.annuityPerYear / 12)}/เดือน ตั้งแต่อายุ ${product.annuityStartAge}`,
              });
            }
          }}
          className="py-3 rounded-xl text-sm font-bold transition active:scale-[0.99] flex items-center justify-center gap-2"
          style={{ background: PAL.deepNavy, color: "white" }}
        >
          <Share2 size={14} /> ส่งสรุปให้ลูกค้า
        </button>
      </div>

      <Link href="/" className="block mt-3 py-2.5 rounded-xl text-[12px] text-center text-gray-500 hover:text-gray-700">
        ← กลับ Pyramid
      </Link>
    </section>
  );
});
