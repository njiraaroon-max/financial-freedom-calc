"use client";

/**
 * /calculators/sales/life — Life Protection (Pyramid tier 2 left).
 *
 * Sales pitch: "ถ้าจากไป ครอบครัวต้องการเงินเท่าไหร่?" — uses the
 * DIME framework (Debt + Income × years + Mortgage + Education) to
 * compute recommended SA, then compares against the customer's
 * existing life-coverage to surface the gap.
 *
 * Self-contained — does NOT depend on the full pillar1Analysis store
 * integration so a Demo Mode walk-through with a prospect works
 * without needing them to fill the entire profile first.
 */

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Heart,
  Calendar,
  Users,
  Wallet,
  Baby,
  CreditCard,
  Home,
  ShieldCheck,
  TrendingUp,
  ArrowDown,
  ArrowUp,
  Target,
  Printer,
  Share2,
  Sparkles,
  Award,
  Info,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import FlagGate from "@/components/FlagGate";
import { useDemoMode } from "@/store/fa-session-store";
import { useProfileStore } from "@/store/profile-store";
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

// ─── DIME-based needs analysis ─────────────────────────────────────

interface LifeInputs {
  monthlyIncome: number;
  yearsToSupport: number;
  outstandingDebt: number;
  mortgageBalance: number;
  educationFundNeeded: number;
  existingLifeCoverage: number;
  liquidAssets: number;
}

interface LifeNeedsResult {
  incomeReplacement: number;
  debt: number;
  mortgage: number;
  education: number;
  funeralFund: number;
  totalNeed: number;
  resources: number;
  recommendedSA: number;
  gap: number;
  hasGap: boolean;
  /** Multiple of monthly income that the recommended SA represents. */
  saInMonths: number;
}

const FUNERAL_RESERVE = 200_000; // standard ฿200k Thai baseline

function computeLifeNeeds(inputs: LifeInputs): LifeNeedsResult {
  const incomeReplacement = inputs.monthlyIncome * 12 * inputs.yearsToSupport;
  const totalNeed =
    incomeReplacement +
    inputs.outstandingDebt +
    inputs.mortgageBalance +
    inputs.educationFundNeeded +
    FUNERAL_RESERVE;
  const resources = inputs.liquidAssets + inputs.existingLifeCoverage;
  const recommendedSA = Math.max(0, totalNeed - inputs.liquidAssets);
  const gap = Math.max(0, recommendedSA - inputs.existingLifeCoverage);
  const saInMonths = inputs.monthlyIncome > 0 ? recommendedSA / inputs.monthlyIncome : 0;

  return {
    incomeReplacement,
    debt: inputs.outstandingDebt,
    mortgage: inputs.mortgageBalance,
    education: inputs.educationFundNeeded,
    funeralFund: FUNERAL_RESERVE,
    totalNeed,
    resources,
    recommendedSA,
    gap,
    hasGap: gap > 0,
    saInMonths,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Page entry
// ═══════════════════════════════════════════════════════════════════

export default function LifePage() {
  return (
    <FlagGate
      flag="victory_insurance_tools"
      fallbackEnabled={false}
      deniedTitle="ฟีเจอร์นี้สำหรับ Victory เท่านั้น"
      backHref="/"
      backLabel="กลับหน้าหลัก"
    >
      <LifeInner />
    </FlagGate>
  );
}

function LifeInner() {
  const profile = useProfileStore();
  const demoMode = useDemoMode();

  const [inputs, setInputs] = useState<LifeInputs>({
    monthlyIncome: profile.salary || 50_000,
    yearsToSupport: 10,
    outstandingDebt: 0,
    mortgageBalance: 0,
    educationFundNeeded: 0,
    existingLifeCoverage: 0,
    liquidAssets: 0,
  });

  const result = useMemo(() => computeLifeNeeds(inputs), [inputs]);

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
        title="ทุนประกันชีวิต"
        subtitle="Life Protection (Die too soon)"
        backHref="/"
        icon={<Heart size={18} className="text-rose-500" />}
      />

      <ProgressNav
        active={activeAct}
        onJump={jump}
        labels={["ครอบครัว", "ทุนที่ต้องการ", "Time Machine", "เทียบประกัน", "ปิดดีล"]}
        demoMode={demoMode}
      />

      <div className="px-4 md:px-8 max-w-3xl mx-auto pb-24 space-y-12">
        <Act1 ref={refs[1]} inputs={inputs} setInputs={setInputs} onNext={() => jump(2)} />
        <Act2 ref={refs[2]} result={result} inputs={inputs} onNext={() => jump(3)} />
        <Act3 ref={refs[3]} result={result} inputs={inputs} onNext={() => jump(4)} />
        <Act4 ref={refs[4]} recommendedSA={result.recommendedSA} onNext={() => jump(5)} />
        <Act5 ref={refs[5]} result={result} inputs={inputs} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACT 1 — Family / financial baseline
// ═══════════════════════════════════════════════════════════════════

const Act1 = forwardRef<
  HTMLElement,
  { inputs: LifeInputs; setInputs: (v: LifeInputs) => void; onNext: () => void }
>(function Act1({ inputs, setInputs }, ref) {
  const update = <K extends keyof LifeInputs>(k: K, v: LifeInputs[K]) =>
    setInputs({ ...inputs, [k]: v });

  return (
    <section ref={ref} data-act={1} className="pt-6 scroll-mt-16">
      <ActHeader actNumber={1} title="ครอบครัวและภาระของคุณ" subtitle="ใช้สูตร DIME ตาม CFP" />

      <div
        className="rounded-2xl p-5 md:p-6"
        style={{ background: `linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)`, color: "white" }}
      >
        <div className="text-[11px] font-bold tracking-[0.2em] mb-1 text-rose-200">
          DIE TOO SOON · DIME FORMULA
        </div>
        <h2 className="text-lg font-bold leading-snug mb-1">
          ทุนชีวิตที่ครอบครัว "อยู่ได้" — ไม่ใช่แค่จัดงาน
        </h2>
        <p className="text-[13px] opacity-80 leading-relaxed">
          คำนวณตามสูตร DIME = หนี้ (Debt) + รายได้ทดแทน (Income) + บ้าน (Mortgage) + การศึกษาลูก (Education)
        </p>
      </div>

      <div className="bg-white rounded-2xl p-5 mt-4 space-y-4 shadow-sm border border-gray-100">
        <NumberRow
          icon={<Wallet size={14} className="text-rose-600" />}
          label="รายได้ของคุณต่อเดือน"
          value={inputs.monthlyIncome}
          onChange={(v) => update("monthlyIncome", v)}
          placeholder="50,000"
        />
        <NumberRow
          icon={<Calendar size={14} className="text-blue-600" />}
          label="ครอบครัวต้องการเงินเลี้ยงดูอีกกี่ปี"
          value={inputs.yearsToSupport}
          onChange={(v) => update("yearsToSupport", v)}
          placeholder="10"
          unit="ปี"
        />
        <NumberRow
          icon={<CreditCard size={14} className="text-rose-600" />}
          label="หนี้คงเหลือ (ผ่อนรถ/บัตร/อื่นๆ)"
          value={inputs.outstandingDebt}
          onChange={(v) => update("outstandingDebt", v)}
          placeholder="0"
        />
        <NumberRow
          icon={<Home size={14} className="text-amber-600" />}
          label="ผ่อนบ้านคงเหลือ"
          value={inputs.mortgageBalance}
          onChange={(v) => update("mortgageBalance", v)}
          placeholder="0"
        />
        <NumberRow
          icon={<Baby size={14} className="text-pink-600" />}
          label="ทุนการศึกษาลูก (ที่ต้องการ)"
          value={inputs.educationFundNeeded}
          onChange={(v) => update("educationFundNeeded", v)}
          placeholder="0"
        />
        <div className="pt-3 mt-3 border-t border-gray-200">
          <div className="text-[11px] text-gray-500 mb-2">ทรัพย์สิน + ประกันที่มีอยู่</div>
          <div className="space-y-3">
            <NumberRow
              icon={<ShieldCheck size={14} className="text-emerald-600" />}
              label="ทุนประกันชีวิตที่มีอยู่"
              value={inputs.existingLifeCoverage}
              onChange={(v) => update("existingLifeCoverage", v)}
              placeholder="0"
            />
            <NumberRow
              icon={<Wallet size={14} className="text-emerald-600" />}
              label="เงินสด + ทรัพย์สินขายง่าย"
              value={inputs.liquidAssets}
              onChange={(v) => update("liquidAssets", v)}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      <NextActButton
        onClick={() => {}}
        label="คำนวณทุนที่ครอบครัวต้องการ →"
        icon={<Sparkles size={16} />}
      />
    </section>
  );
});

function NumberRow({
  icon, label, value, onChange, placeholder, unit = "บาท",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (v: number) => void;
  placeholder: string;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <label className="text-[12px] text-gray-600 flex-1">{label}</label>
      <input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        placeholder={placeholder}
        className="w-32 text-right text-sm font-bold bg-gray-50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-rose-400"
      />
      <span className="text-[11px] text-gray-400 w-8">{unit}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACT 2 — Verdict
// ═══════════════════════════════════════════════════════════════════

const Act2 = forwardRef<
  HTMLElement,
  { result: LifeNeedsResult; inputs: LifeInputs; onNext: () => void }
>(function Act2({ result, inputs, onNext }, ref) {
  return (
    <section ref={ref} data-act={2} className="scroll-mt-16">
      <ActHeader actNumber={2} title="ทุนที่ครอบครัวคุณต้องการ" subtitle="คำนวณตามสูตร DIME" />

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <VerdictCard
          tone="amber" icon={<Target size={14} />}
          label="ควรมี"
          mainValue={`฿${fmtBahtShort(result.recommendedSA)}`}
          mainSub={`= ${result.saInMonths.toFixed(0)} เดือนของรายได้`}
          footer="ตามสูตร DIME"
        />
        <VerdictCard
          tone="green" icon={<ShieldCheck size={14} />}
          label="ตอนนี้มี"
          mainValue={`฿${fmtBahtShort(inputs.existingLifeCoverage)}`}
          mainSub="ทุนประกันชีวิตปัจจุบัน"
          footer={inputs.existingLifeCoverage > 0 ? "✓ มี" : "ยังไม่มี"}
        />
        <VerdictCard
          tone={result.hasGap ? "red" : "green"}
          icon={result.hasGap ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
          label={result.hasGap ? "ขาด" : "เกินพอ"}
          mainValue={`฿${fmtBahtShort(Math.abs(result.gap))}`}
          mainSub={result.hasGap ? "ต้องเพิ่ม" : "ไม่จำเป็นต้องซื้อเพิ่ม"}
          footer={result.hasGap ? `(+${((result.gap / inputs.existingLifeCoverage) * 100 || 0).toFixed(0)}%)` : "✓ ครบ"}
        />
      </div>

      {/* DIME breakdown */}
      <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="text-[11px] font-bold text-gray-500 mb-2">ที่มาของตัวเลข ฿{fmtBaht(result.totalNeed)}</div>
        <div className="space-y-1.5 text-[12px]">
          <DimeRow label="D · หนี้คงเหลือ" amt={result.debt} />
          <DimeRow label="I · รายได้ทดแทน (รายได้/ด. × 12 × ปี)" amt={result.incomeReplacement} />
          <DimeRow label="M · ผ่อนบ้าน" amt={result.mortgage} />
          <DimeRow label="E · ทุนการศึกษาลูก" amt={result.education} />
          <DimeRow label="Funeral · ค่าจัดงาน" amt={result.funeralFund} />
          <div className="border-t border-gray-200 mt-1 pt-1.5">
            <DimeRow label="รวมความต้องการ" amt={result.totalNeed} bold />
            <DimeRow label="− ทรัพย์สินขายง่าย" amt={-inputs.liquidAssets} />
            <DimeRow label="= ทุนประกันที่ควรมี" amt={result.recommendedSA} highlight />
          </div>
        </div>
      </div>

      <NextActButton onClick={onNext} label="ดู Time Machine ครอบครัว →" icon={<TrendingUp size={16} />} />
    </section>
  );
});

function DimeRow({ label, amt, bold, highlight }: { label: string; amt: number; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between ${highlight ? "p-1.5 rounded bg-amber-50 text-amber-800" : ""}`}>
      <span className={bold || highlight ? "font-bold" : "text-gray-600"}>{label}</span>
      <span className={`tabular-nums ${bold || highlight ? "font-bold" : ""}`}>
        {amt < 0 ? "" : ""}฿{fmtBaht(amt)}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACT 3 — Time machine: "อีก N ปีลูกจบ ครอบครัวจะ..."
// ═══════════════════════════════════════════════════════════════════

const Act3 = forwardRef<
  HTMLElement,
  { result: LifeNeedsResult; inputs: LifeInputs; onNext: () => void }
>(function Act3({ result, inputs, onNext }, ref) {
  const [scrubYear, setScrubYear] = useState<number>(0);
  const maxYear = inputs.yearsToSupport;

  // Family monthly need decays as years pass (debts paid down, kids grow up)
  // Simplified linear decay: at year 0 = full income need, at year `yearsToSupport` = 0
  const monthlyNeedAtYear = (yr: number) => {
    if (yr >= maxYear) return 0;
    return inputs.monthlyIncome * (1 - yr / maxYear);
  };
  const lumpNeedAtYear = (yr: number) => {
    // Income replacement remaining
    const incomeRem = monthlyNeedAtYear(yr) * 12 * (maxYear - yr);
    // Debts paid down linearly
    const debtRem = result.debt * (1 - yr / maxYear);
    const mortgageRem = result.mortgage * (1 - yr / maxYear);
    return incomeRem + debtRem + mortgageRem + result.education + result.funeralFund;
  };

  const lumpNow = lumpNeedAtYear(scrubYear);

  return (
    <section ref={ref} data-act={3} className="scroll-mt-16">
      <ActHeader
        actNumber={3}
        title="🕰 ครอบครัวเปลี่ยนยังไงในอนาคต"
        subtitle="ทุนที่ต้องการลดลงทุกปี"
      />

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[12px] text-gray-500">อีก</div>
          <div className="text-3xl font-extrabold" style={{ color: PAL.deepNavy }}>
            {scrubYear} <span className="text-base font-normal text-gray-400">ปี</span>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={maxYear}
          value={scrubYear}
          onChange={(e) => setScrubYear(Number(e.target.value))}
          className="w-full accent-rose-600"
        />
        <div className="flex justify-between text-[11px] text-gray-400 mt-1">
          <span>วันนี้</span>
          <span>อีก {maxYear} ปี (ลูกโต / หนี้หมด)</span>
        </div>

        <div
          className="mt-4 rounded-xl p-4"
          style={{
            background: scrubYear < maxYear / 2 ? PAL.redSoft : PAL.greenSoft,
            border: `1px solid ${scrubYear < maxYear / 2 ? PAL.red : PAL.green}`,
          }}
        >
          <div className="text-[11px] font-bold tracking-[0.15em]" style={{
            color: scrubYear < maxYear / 2 ? PAL.red : PAL.green,
          }}>
            {scrubYear === 0 ? "ถ้าจากไปวันนี้" : scrubYear === maxYear ? "ถ้าจากไปอีก " + maxYear + " ปี" : "ถ้าจากไปอีก " + scrubYear + " ปี"}
          </div>
          <div className="text-2xl font-extrabold mt-1" style={{ color: PAL.deepNavy }}>
            ฿{fmtBaht(lumpNow)}
          </div>
          <div className="text-[12px] text-gray-600 mt-1 leading-relaxed">
            ครอบครัวต้องการเงินก้อนนี้เพื่อ{scrubYear < maxYear ? "ใช้ต่ออีก " + (maxYear - scrubYear) + " ปี" : "งานศพ + การศึกษาลูก"}
          </div>
        </div>

        <div className="flex gap-1.5 mt-3 flex-wrap">
          {[0, Math.floor(maxYear / 4), Math.floor(maxYear / 2), Math.floor(maxYear * 3 / 4), maxYear].filter((v, i, arr) => arr.indexOf(v) === i).map((y) => (
            <button
              key={y}
              onClick={() => setScrubYear(y)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition ${
                scrubYear === y ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {y === 0 ? "วันนี้" : `+${y} ปี`}
            </button>
          ))}
        </div>
      </div>

      <NextActButton onClick={onNext} label="เปรียบเทียบประกันชีวิต →" />
    </section>
  );
});

// ═══════════════════════════════════════════════════════════════════
// ACT 4 — Insurance type comparison
// ═══════════════════════════════════════════════════════════════════

const Act4 = forwardRef<
  HTMLElement,
  { recommendedSA: number; onNext: () => void }
>(function Act4({ recommendedSA, onNext }, ref) {
  // Rough rule-of-thumb premium estimates per ฿1M SA at age 40 M
  // (will be refined by calling Allianz lib in a future commit)
  const products = [
    {
      key: "term",
      title: "Term — เฉพาะกาล",
      sub: "T1010 / T2020",
      premPer1M: 7_300,
      pros: ["ถูกที่สุด", "ทุนสูงในเบี้ยน้อย"],
      cons: ["ไม่มีเงินคืน", "หมดอายุแล้วต้องสมัครใหม่"],
      bestFor: "คุ้มกันช่วง critical (ผ่อนบ้าน / ลูกยังเล็ก)",
      tone: "blue" as const,
    },
    {
      key: "wholelife",
      title: "Whole Life — ตลอดชีพ",
      sub: "MWLA9920 / SLA85",
      premPer1M: 23_000,
      pros: ["คุ้มครองตลอดชีวิต", "มีมูลค่าเวนคืน"],
      cons: ["เบี้ยสูงกว่า Term มาก"],
      bestFor: "ส่งต่อมรดก / สร้างเงินก้อนระยะยาว",
      tone: "green" as const,
    },
    {
      key: "legacy",
      title: "Wealth Legacy — มรดก",
      sub: "MWLA9906 (มีปันผล)",
      premPer1M: 96_600 / 10, // age 50 F as benchmark, just illustrative
      pros: ["3-in-1: คุ้มครอง + ออม + ส่งต่อ", "ลดหย่อนภาษี"],
      cons: ["จ่ายเบี้ยสูงสุด 6 ปี", "ทุนขั้นต่ำ 10M"],
      bestFor: "HNW · ผู้มีรายได้สูง · เจ้าของกิจการ",
      tone: "gold" as const,
    },
  ];

  return (
    <section ref={ref} data-act={4} className="scroll-mt-16">
      <ActHeader
        actNumber={4}
        title="⚖ ประกันชีวิตแบบไหนเหมาะกับคุณ"
        subtitle={`สำหรับทุน ฿${fmtBahtShort(recommendedSA)}`}
      />

      <div className="space-y-3">
        {products.map((p) => (
          <div
            key={p.key}
            className="bg-white rounded-2xl p-4 shadow-sm border-2"
            style={{ borderColor: p.tone === "gold" ? PAL.gold : "#e5e7eb" }}
          >
            <div className="flex items-baseline justify-between mb-1">
              <div>
                <div className="text-base font-bold" style={{ color: PAL.deepNavy }}>{p.title}</div>
                <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 mt-0.5">{p.sub}</div>
              </div>
              <div className="text-right">
                <div className="text-base font-extrabold" style={{ color: PAL.deepNavy }}>
                  ~฿{fmtBahtShort(p.premPer1M * recommendedSA / 1_000_000)}/ปี
                </div>
                <div className="text-[10px] text-gray-500">ประมาณการ (อายุ 40 ชาย)</div>
              </div>
            </div>
            <div className="text-[12px] text-gray-700 mb-2 italic">เหมาะกับ: {p.bestFor}</div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <div className="text-[10px] font-bold tracking-[0.15em] text-emerald-600 mb-1">✓ ดี</div>
                <ul className="text-[12px] text-gray-700 space-y-0.5">
                  {p.pros.map((x, i) => <li key={i}>• {x}</li>)}
                </ul>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-[0.15em] text-rose-600 mb-1">✗ ระวัง</div>
                <ul className="text-[12px] text-gray-700 space-y-0.5">
                  {p.cons.map((x, i) => <li key={i}>• {x}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl p-3 border flex items-start gap-2"
        style={{ background: PAL.goldSoft, borderColor: PAL.gold }}>
        <span className="text-base">💡</span>
        <div className="text-[12px] text-gray-700 leading-relaxed">
          <span className="font-bold" style={{ color: PAL.deepNavy }}>คำแนะนำ:</span>{" "}
          ถ้างบจำกัด → Term คุ้ม CR สูงสุด · ถ้ามีกำลัง → Whole Life ตอบโจทย์ทั้งคุ้มครอง+ออม · ถ้าเป็น HNW → Wealth Legacy ส่งต่อมรดก
        </div>
      </div>

      <NextActButton onClick={onNext} label="ดูสรุปแผน →" />
    </section>
  );
});

// ═══════════════════════════════════════════════════════════════════
// ACT 5 — Summary
// ═══════════════════════════════════════════════════════════════════

const Act5 = forwardRef<
  HTMLElement,
  { result: LifeNeedsResult; inputs: LifeInputs }
>(function Act5({ result, inputs }, ref) {
  const profile = useProfileStore();
  const customerName = profile.name || "คุณ";
  return (
    <section ref={ref} data-act={5} className="scroll-mt-16">
      <ActHeader actNumber={5} title="📋 สรุปแผนทุนชีวิตสำหรับคุณ" subtitle="ก่อนตัดสินใจ" />

      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
          <div className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, #dc2626 0%, #991b1b 100%)` }}>
            <Heart size={22} className="text-white" />
          </div>
          <div>
            <div className="text-base font-bold" style={{ color: PAL.deepNavy }}>{customerName}</div>
            <div className="text-[12px] text-gray-500">
              รายได้ ฿{fmtBaht(inputs.monthlyIncome)}/เดือน · เลี้ยงดู {inputs.yearsToSupport} ปี
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <SummaryBullet
            icon={<Target size={14} className="text-amber-600" />}
            title="ทุนประกันที่ควรมี"
            body={`฿${fmtBaht(result.recommendedSA)}`}
            sub={`= ${result.saInMonths.toFixed(0)} เดือนของรายได้คุณ`}
          />
          <SummaryBullet
            icon={<ShieldCheck size={14} className="text-emerald-600" />}
            title="ทุนประกันที่มีอยู่"
            body={`฿${fmtBaht(inputs.existingLifeCoverage)}`}
            sub={inputs.existingLifeCoverage > 0 ? "นับรวมทุกกรมธรรม์" : "ยังไม่มี"}
          />
          <SummaryBullet
            icon={result.hasGap ? <ArrowDown size={14} className="text-rose-600" /> : <Award size={14} className="text-emerald-600" />}
            title={result.hasGap ? "ทุนที่ขาด — ต้องเพิ่ม" : "✓ ทุนเพียงพอแล้ว"}
            body={result.hasGap ? `฿${fmtBaht(result.gap)}` : "ไม่จำเป็นต้องซื้อเพิ่ม"}
            sub={result.hasGap ? "เพื่อปิดความเสี่ยง" : "อาจพิจารณาเพิ่มเพื่อมรดก/ภาษี"}
          />
        </div>

        <div className="mt-5">
          <Disclaimer
            bullets={[
              "สูตร DIME เป็นการประมาณการ — ไม่ใช่ทุนตายตัวที่ต้องซื้อตรงเลข",
              "ควรทบทวนทุนทุก 3-5 ปี เมื่อรายได้/ภาระเปลี่ยน",
              "เบี้ยประกันที่แสดงเป็นประมาณการเฉลี่ย — เบี้ยจริงขึ้นกับอายุ/เพศ/สุขภาพ",
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
                title: "Life Protection",
                text: `ทุนประกันที่ควรมี ฿${fmtBahtShort(result.recommendedSA)} (ขาด ฿${fmtBahtShort(result.gap)})`,
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
