"use client";

import { useMemo, useState } from "react";
import {
  LineChart as LineIcon,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Wallet,
  Landmark,
  GraduationCap,
  Shield,
  Receipt,
  Calendar,
  ChevronDown,
  Sliders,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useProfileStore } from "@/store/profile-store";
import { useCashFlowStore } from "@/store/cashflow-store";
import { useRetirementStore } from "@/store/retirement-store";
import { useBalanceSheetStore } from "@/store/balance-sheet-store";
import { useInsuranceStore } from "@/store/insurance-store";
import { useEducationStore, aggregateProjection } from "@/store/education-store";
import { useTaxStore } from "@/store/tax-store";
import { projectCashflow, type CFProjectionRow } from "@/lib/cfProjection";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}
function fmtSigned(n: number): string {
  const abs = Math.abs(n);
  if (n >= 0) return `+${fmtShort(abs)}`;
  return `-${fmtShort(abs)}`;
}
const CURRENT_YEAR = new Date().getFullYear();

// ═══════════════════════════════════════════════════════════════════════════════

export default function CFProjectionPage() {
  // ── Pull data from every planning module ────────────────────────────
  const profile = useProfileStore();
  const cfStore = useCashFlowStore();
  const retire = useRetirementStore();
  const balance = useBalanceSheetStore();
  const insurance = useInsuranceStore();
  const education = useEducationStore();
  const tax = useTaxStore();

  const currentAge = profile.getAge?.() || 35;
  const retireAge = profile.retireAge || 60;
  const lifeExpectancy = retire.assumptions?.lifeExpectancy || 85;

  // Inflation / return / salary growth — user-tweakable, seeded from retirement assumptions
  const [inflationRate, setInflationRate] = useState(
    ((retire.assumptions?.generalInflation ?? 0.03) * 100),
  );
  const [salaryGrowth, setSalaryGrowth] = useState(3);
  const [investmentReturn, setInvestmentReturn] = useState(
    ((retire.assumptions?.postRetireReturn ?? 0.045) * 100),
  );

  // Tab: pre-retire | post-retire | all | summary
  const [view, setView] = useState<"all" | "pre" | "post" | "summary">("summary");

  // ── Compute annual totals from cashflow store ─────────────────────────
  const { annualIncome, annualExpense } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const item of cfStore.incomes) {
      inc += (item.amounts || []).reduce((s, a) => s + a, 0);
    }
    for (const item of cfStore.expenses) {
      exp += (item.amounts || []).reduce((s, a) => s + a, 0);
    }
    return { annualIncome: inc, annualExpense: exp };
  }, [cfStore.incomes, cfStore.expenses]);

  // Insurance premiums per year
  const annualInsurancePremiums = useMemo(
    () => insurance.policies.reduce((s, p) => s + (p.premium || 0), 0),
    [insurance.policies],
  );

  // Tax estimate (from tax store if calculated)
  const annualTaxEstimate = useMemo(() => {
    // If user has set withholding tax or variables, use that
    // Otherwise fall back to simple estimate
    const fromStore = tax.withholdingTax || 0;
    return fromStore;
  }, [tax.withholdingTax]);

  // Post-retire basic expenses (monthly sum from retirement.basicExpenses)
  const postRetireMonthlyExpense = useMemo(
    () =>
      (retire.basicExpenses || []).reduce((s, item) => s + (item.monthlyAmount || 0), 0),
    [retire.basicExpenses],
  );

  // Post-retire income (calc-links: SS pension + pension insurance + PVD annuitised)
  // For MVP — use variable store values if present; else 0. User can tweak later.
  const postRetireAnnualIncome = useMemo(() => {
    // Placeholder — MVP: user can edit directly or we pull from variables later
    return 0;
  }, []);

  // Starting balance — use balance sheet liquid assets
  const startingBalance = useMemo(
    () => balance.getTotalByAssetType?.("liquid") ?? 0,
    [balance],
  );

  // Education rows
  const educationAgg = useMemo(
    () =>
      aggregateProjection(
        education.children,
        education.levels,
        education.inflationRate,
        CURRENT_YEAR,
      ),
    [education.children, education.levels, education.inflationRate],
  );

  // ── Run the projection ───────────────────────────────────────────────
  const result = useMemo(
    () =>
      projectCashflow({
        currentAge,
        retireAge,
        lifeExpectancy,
        startYear: CURRENT_YEAR,
        startingBalance,
        annualIncomeNow: annualIncome,
        annualExpenseNow: annualExpense - annualInsurancePremiums - annualTaxEstimate, // avoid double-counting
        annualInsurancePremiums,
        annualTaxEstimate,
        postRetireMonthlyExpense,
        postRetireAnnualIncome,
        specialExpenses: retire.specialExpenses || [],
        educationRows: educationAgg.rows,
        inflationRate,
        salaryGrowth,
        investmentReturn,
        policies: insurance.policies,
      }),
    [
      currentAge,
      retireAge,
      lifeExpectancy,
      startingBalance,
      annualIncome,
      annualExpense,
      annualInsurancePremiums,
      annualTaxEstimate,
      postRetireMonthlyExpense,
      postRetireAnnualIncome,
      retire.specialExpenses,
      educationAgg.rows,
      inflationRate,
      salaryGrowth,
      investmentReturn,
      insurance.policies,
    ],
  );

  const { rows, summary } = result;
  const filteredRows = useMemo(() => {
    if (view === "pre") return rows.filter((r) => r.phase === "pre_retire");
    if (view === "post")
      return rows.filter((r) => r.phase === "post_retire" || r.phase === "retire_year");
    if (view === "all") return rows;
    return [];
  }, [rows, view]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="ประมาณการกระแสเงินสด"
        subtitle="CF Projection"
        icon={<LineIcon size={28} className="text-sky-500" />}
        rightElement={<LineIcon size={20} className="text-sky-500" />}
      />

      <div className="px-2 md:px-4 pt-3 pb-8 space-y-3">
        {/* Intro */}
        <div className="bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl p-4 text-white mx-1">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={20} />
            <span className="text-sm font-bold">ประมาณการรายปี ก่อน/หลังเกษียณ</span>
          </div>
          <p className="text-[11px] opacity-80 leading-relaxed">
            ระบบดึงข้อมูลจากทุก module (Cash Flow, Retirement, Education, Insurance, Tax, Balance Sheet)
            มาคำนวณกระแสเงินสดปีต่อปี พร้อมปรับตามเงินเฟ้อ ดูว่าแผนเป็นไปได้จริงมั้ย
          </p>
        </div>

        {/* Quick summary cards */}
        <div className="grid grid-cols-2 gap-2 mx-1">
          <SummaryCard
            icon={<Calendar size={14} />}
            label="เกษียณอีก"
            value={`${summary.yearsUntilRetire} ปี`}
            accent="text-sky-600"
          />
          <SummaryCard
            icon={<TrendingUp size={14} />}
            label="ยอดสูงสุด"
            value={`${fmtShort(summary.peakBalance)} (${summary.peakBalanceYear})`}
            accent="text-emerald-600"
          />
          <SummaryCard
            icon={<Wallet size={14} />}
            label="คงเหลือสุดท้าย"
            value={fmtShort(summary.endingBalance)}
            accent={summary.endingBalance > 0 ? "text-emerald-600" : "text-red-600"}
          />
          <SummaryCard
            icon={<AlertTriangle size={14} />}
            label="เงินหมดปี"
            value={
              summary.depletionYear
                ? `${summary.depletionYear} (อายุ ${summary.depletionYear - CURRENT_YEAR + currentAge})`
                : "ไม่หมด ✓"
            }
            accent={summary.depletionYear ? "text-red-600" : "text-emerald-600"}
          />
        </div>

        {/* Inputs panel */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mx-1">
          <div className="flex items-center gap-2 mb-3">
            <Sliders size={16} className="text-sky-600" />
            <h3 className="text-sm font-bold text-gray-800">สมมติฐาน (ปรับได้)</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <RateInput
              label="เงินเฟ้อรายจ่าย"
              value={inflationRate}
              onChange={setInflationRate}
            />
            <RateInput
              label="เงินเดือนโตปีละ"
              value={salaryGrowth}
              onChange={setSalaryGrowth}
            />
            <RateInput
              label="ผลตอบแทนลงทุน"
              value={investmentReturn}
              onChange={setInvestmentReturn}
            />
          </div>
        </div>

        {/* Data sources indicator */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mx-1">
          <h3 className="text-sm font-bold text-gray-800 mb-2">ข้อมูลที่นำมาคำนวณ</h3>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <DataSource icon={<Wallet size={12} className="text-indigo-600" />} label="รายรับ/ปี" value={fmt(annualIncome)} />
            <DataSource icon={<TrendingDown size={12} className="text-red-500" />} label="รายจ่าย/ปี" value={fmt(annualExpense)} />
            <DataSource icon={<Shield size={12} className="text-emerald-600" />} label="เบี้ยประกัน/ปี" value={fmt(annualInsurancePremiums)} />
            <DataSource icon={<Receipt size={12} className="text-violet-600" />} label="ภาษีประมาณ" value={fmt(annualTaxEstimate)} />
            <DataSource icon={<GraduationCap size={12} className="text-blue-600" />} label="ค่าการศึกษารวม" value={fmt(educationAgg.grandTotal)} />
            <DataSource icon={<Landmark size={12} className="text-cyan-600" />} label="ยอดเริ่มต้น" value={fmt(startingBalance)} />
          </div>
        </div>

        {/* View toggle */}
        <div className="bg-white rounded-2xl shadow-sm p-1.5 mx-1 flex gap-1">
          {[
            { key: "summary", label: "สรุปย่อ" },
            { key: "pre", label: "ก่อนเกษียณ" },
            { key: "post", label: "หลังเกษียณ" },
            { key: "all", label: "ตารางเต็ม" },
          ].map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key as typeof view)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                view === v.key
                  ? "bg-sky-500 text-white shadow"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {view === "summary" ? (
          <CondensedSummary rows={rows} currentAge={currentAge} retireAge={retireAge} />
        ) : (
          <FullProjectionTable rows={filteredRows} retireAge={retireAge} />
        )}
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-sm font-extrabold ${accent}`}>{value}</div>
    </div>
  );
}

function DataSource({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1.5">
      {icon}
      <span className="text-gray-500 flex-1">{label}</span>
      <span className="font-bold text-gray-800">{value}</span>
    </div>
  );
}

function RateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft !== null ? draft : Number.isFinite(value) ? String(value) : "";
  return (
    <div>
      <label className="text-[10px] text-gray-500 block mb-1">{label}</label>
      <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-200">
        <input
          type="text"
          inputMode="decimal"
          value={display}
          onFocus={(e) => {
            setDraft(Number.isFinite(value) ? String(value) : "");
            e.currentTarget.select();
          }}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d.]/g, "");
            const parts = raw.split(".");
            const cleaned =
              parts.length > 1 ? parts[0] + "." + parts.slice(1).join("") : raw;
            setDraft(cleaned);
            if (cleaned === "" || cleaned === ".") { onChange(0); return; }
            const n = parseFloat(cleaned);
            if (Number.isFinite(n)) onChange(n);
          }}
          onBlur={() => setDraft(null)}
          className="flex-1 text-sm font-bold text-right bg-transparent outline-none"
        />
        <span className="text-[10px] text-gray-400">%</span>
      </div>
    </div>
  );
}

function FullProjectionTable({
  rows,
  retireAge,
}: {
  rows: CFProjectionRow[];
  retireAge: number;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center text-xs text-gray-400 mx-1">
        ไม่มีแถวในช่วงที่เลือก
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl shadow-sm mx-1 overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="py-2 px-2 text-left text-gray-600">ปี</th>
            <th className="py-2 px-2 text-left text-gray-600">อายุ</th>
            <th className="py-2 px-2 text-right text-emerald-600">รายรับ</th>
            <th className="py-2 px-2 text-right text-red-500">ใช้จ่าย</th>
            <th className="py-2 px-2 text-right text-blue-600">การศึกษา</th>
            <th className="py-2 px-2 text-right text-amber-600">พิเศษ</th>
            <th className="py-2 px-2 text-right text-gray-700">Net</th>
            <th className="py-2 px-2 text-right text-sky-700">คงเหลือ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isRetireYear = r.age === retireAge;
            return (
              <tr
                key={r.year}
                className={`border-t border-gray-100 hover:bg-sky-50/30 ${
                  r.depleted ? "bg-red-50" : isRetireYear ? "bg-amber-50" : ""
                }`}
              >
                <td className="py-1.5 px-2 text-gray-700">{r.year}</td>
                <td className="py-1.5 px-2 text-gray-700">
                  {r.age}
                  {isRetireYear && <span className="text-[9px] text-amber-600 ml-1">★</span>}
                </td>
                <td className="py-1.5 px-2 text-right font-bold text-emerald-700">{fmtShort(r.totalIncome)}</td>
                <td className="py-1.5 px-2 text-right text-red-600">{fmtShort(r.totalExpense - r.educationCost - r.specialExpense)}</td>
                <td className="py-1.5 px-2 text-right text-blue-600">{r.educationCost > 0 ? fmtShort(r.educationCost) : "—"}</td>
                <td className="py-1.5 px-2 text-right text-amber-600">{r.specialExpense > 0 ? fmtShort(r.specialExpense) : "—"}</td>
                <td className={`py-1.5 px-2 text-right font-bold ${r.netCashflow >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {fmtSigned(r.netCashflow)}
                </td>
                <td className={`py-1.5 px-2 text-right font-extrabold ${r.endingBalance > 0 ? "text-sky-700" : "text-red-700"}`}>
                  {fmtShort(r.endingBalance)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CondensedSummary({
  rows,
  currentAge,
  retireAge,
}: {
  rows: CFProjectionRow[];
  currentAge: number;
  retireAge: number;
}) {
  // Key milestone ages: now, +5, +10, retire-5, retire, retire+5, retire+10, retire+20, life_end
  const ages = new Set<number>();
  ages.add(currentAge);
  ages.add(currentAge + 5);
  ages.add(currentAge + 10);
  ages.add(retireAge - 5);
  ages.add(retireAge);
  ages.add(retireAge + 5);
  ages.add(retireAge + 10);
  ages.add(retireAge + 20);
  const lastAge = rows[rows.length - 1]?.age;
  if (lastAge !== undefined) ages.add(lastAge);

  const picked = rows.filter((r) => ages.has(r.age));

  return (
    <div className="bg-white rounded-2xl shadow-sm mx-1 p-3">
      <h3 className="text-sm font-bold text-gray-800 mb-3">จุดสำคัญในเส้นทาง</h3>
      <div className="space-y-2">
        {picked.map((r) => {
          const isRetire = r.age === retireAge;
          const milestone =
            r.age === currentAge ? "ปีนี้" :
            isRetire ? "เกษียณ" :
            r.age === lastAge ? "สิ้นแผน" :
            r.age < retireAge ? `+${r.age - currentAge} ปี` :
            `เกษียณ +${r.age - retireAge} ปี`;
          return (
            <div
              key={r.year}
              className={`rounded-xl p-3 border ${
                isRetire ? "border-amber-300 bg-amber-50" :
                r.depleted ? "border-red-300 bg-red-50" :
                "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs font-bold text-gray-700">
                    {milestone} • อายุ {r.age}
                  </div>
                  <div className="text-[10px] text-gray-400">ปี {r.year} / พ.ศ. {r.yearBE}</div>
                </div>
                <div className={`text-right ${r.endingBalance > 0 ? "text-sky-700" : "text-red-700"}`}>
                  <div className="text-[9px] text-gray-400">คงเหลือ</div>
                  <div className="text-base font-extrabold">{fmtShort(r.endingBalance)}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <div className="text-gray-400">รายรับ</div>
                  <div className="font-bold text-emerald-700">{fmtShort(r.totalIncome)}</div>
                </div>
                <div>
                  <div className="text-gray-400">รายจ่าย</div>
                  <div className="font-bold text-red-600">{fmtShort(r.totalExpense)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Net</div>
                  <div className={`font-bold ${r.netCashflow >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {fmtSigned(r.netCashflow)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
