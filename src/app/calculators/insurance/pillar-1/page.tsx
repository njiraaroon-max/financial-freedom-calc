"use client";

import { useState, useMemo } from "react";
import { Shield, Link2, AlertTriangle, CheckCircle2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useInsuranceStore } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import { GanttChart, StepLineChart } from "@/components/InsuranceCharts";
import { useBalanceSheetStore } from "@/store/balance-sheet-store";
import { useCashFlowStore } from "@/store/cashflow-store";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}
function commaInput(n: number): string {
  if (n === 0) return "";
  return n.toLocaleString("th-TH");
}
function parseNum(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}

const BE_OFFSET = 543;
const CURRENT_YEAR = new Date().getFullYear();

// ─── Money Input Component ────────────────────────────────────────────────────
function MoneyInput({ label, value, onChange, hint, suffix = "บาท" }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; suffix?: string;
}) {
  const [display, setDisplay] = useState(value > 0 ? commaInput(value) : "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseNum(e.target.value);
    setDisplay(raw > 0 ? commaInput(raw) : e.target.value.replace(/[^0-9]/g, ""));
    onChange(raw);
  };

  return (
    <div>
      <label className="text-[11px] text-gray-500 font-semibold block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="text" inputMode="numeric" value={display}
          onChange={handleChange}
          className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-right font-bold"
          placeholder="0"
        />
        <span className="text-xs text-gray-400 shrink-0 w-8">{suffix}</span>
      </div>
      {hint && <div className="text-[9px] text-gray-400 mt-0.5 pl-1">{hint}</div>}
    </div>
  );
}

function NumberInput({ label, value, onChange, suffix = "ปี" }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div>
      <label className="text-[11px] text-gray-500 font-semibold block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="text" inputMode="numeric" value={value || ""}
          onChange={(e) => onChange(parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)}
          className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-center font-bold"
          placeholder="0"
        />
        <span className="text-xs text-gray-400 shrink-0 w-8">{suffix}</span>
      </div>
    </div>
  );
}

// ─── Toggle with link ─────────────────────────────────────────────────────────
function LinkToggle({ label, checked, onChange, linkedValue, linkedLabel }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; linkedValue?: number; linkedLabel?: string;
}) {
  return (
    <div className={`rounded-xl border p-3 transition-all ${checked ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        <Link2 size={14} className={checked ? "text-blue-500" : "text-gray-400"} />
        <span className="text-xs text-gray-700 font-medium">{label}</span>
      </label>
      {checked && linkedValue !== undefined && (
        <div className="mt-1.5 ml-7 text-[10px] text-blue-600 font-bold">
          {linkedLabel}: {fmt(linkedValue)} บาท
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — Pillar 1: Income Protection & Life Insurance
// ═══════════════════════════════════════════════════════════════════════════════
export default function Pillar1Page() {
  const store = useInsuranceStore();
  const profile = useProfileStore();
  const balanceSheet = useBalanceSheetStore();
  const cashflow = useCashFlowStore();

  const p1 = store.riskManagement.pillar1;
  const update = store.updatePillar1;

  const currentAge = profile.getAge?.() || 35;
  const birthYear = CURRENT_YEAR - currentAge;
  const retireAge = profile.retireAge || 60;

  // ─── Linked data from other stores ──────────────────────────────────────
  const totalDebtsFromBS = balanceSheet.liabilities.reduce((s, l) => s + l.value, 0);
  const monthlyExpenseFromCF = useMemo(() => {
    const expenseItems = cashflow.expenses || [];
    return expenseItems.reduce((sum, item) => {
      const amounts = item.amounts || [];
      const avg = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
      return sum + avg;
    }, 0);
  }, [cashflow.expenses]);

  // ─── Life policies from store ───────────────────────────────────────────
  const lifePolicies = store.policies.filter((p) => ["whole_life", "endowment"].includes(p.policyType));
  const totalLifeCoverage = lifePolicies.reduce((s, p) => s + p.sumInsured, 0);

  // ─── Calculation ────────────────────────────────────────────────────────
  const analysis = useMemo(() => {
    // Debts
    const debts = p1.useBalanceSheetDebts ? totalDebtsFromBS + p1.additionalDebts : p1.additionalDebts;

    // Family expenses
    const monthlyExp = p1.useCashflowExpense ? monthlyExpenseFromCF : p1.familyExpenseMonthly;
    const familyNeeds = monthlyExp * 12 * p1.familyAdjustmentYears;

    // Parent support
    const parentNeeds = p1.parentSupportMonthly * 12 * p1.parentSupportYears;

    // Total needs (Capital Utilization Approach)
    const breakdown = [
      { label: "ค่าจัดงานศพ", value: p1.funeralCost },
      { label: "ชำระหนี้สินทั้งหมด", value: debts },
      { label: `ค่าใช้จ่ายครอบครัว (${p1.familyAdjustmentYears} ปี)`, value: familyNeeds },
      { label: "ทุนการศึกษาบุตร", value: p1.educationFund },
      { label: `เงินดูแลพ่อ/แม่ (${p1.parentSupportYears} ปี)`, value: parentNeeds },
      { label: "ความต้องการอื่นๆ", value: p1.otherNeeds },
    ];
    const totalNeed = breakdown.reduce((s, b) => s + b.value, 0);

    // What we have
    const haveBreakdown = [
      { label: "ทุนประกันชีวิตรวม", value: totalLifeCoverage },
      { label: "เงินออม/สินทรัพย์สภาพคล่อง", value: p1.existingSavings },
    ];
    const totalHave = haveBreakdown.reduce((s, b) => s + b.value, 0);

    const gap = totalNeed - totalHave;
    const gapPct = totalNeed > 0 ? (gap / totalNeed) * 100 : 0;
    const coveragePct = totalNeed > 0 ? Math.min((totalHave / totalNeed) * 100, 100) : 0;

    return { debts, familyNeeds, parentNeeds, breakdown, totalNeed, haveBreakdown, totalHave, gap, gapPct, coveragePct };
  }, [p1, totalDebtsFromBS, monthlyExpenseFromCF, totalLifeCoverage]);

  // ─── Save & mark completed ──────────────────────────────────────────────
  const handleSave = () => {
    store.markPillarCompleted("pillar1");
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="ปกป้องรายได้ & ชีวิต"
        subtitle="Pillar 1 — Income Protection"
        characterImg="/circle-icons/risk-management.png"
        backHref="/calculators/insurance"
      />

      <div className="px-2 md:px-4 pt-3 pb-8 space-y-3">
        {/* Intro Card */}
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#3b6fa0] rounded-2xl p-4 text-white mx-1">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={20} />
            <span className="text-sm font-bold">ถ้าวันนี้เราไม่อยู่...ใครเดือดร้อน?</span>
          </div>
          <p className="text-[11px] opacity-80 leading-relaxed">
            คำนวณทุนประกันชีวิตที่เหมาะสมด้วย Capital Utilization Approach
            เพื่อให้มั่นใจว่าคนที่รักจะดำรงชีวิตต่อไปได้
          </p>
        </div>

        {/* ─── Charts: Gantt + Step Line ────────────────────────────── */}
        {store.policies.length > 0 && (
          <div className="mx-1 space-y-3">
            <GanttChart policies={store.policies} birthYear={birthYear} currentAge={currentAge} />
            <StepLineChart policies={store.policies} birthYear={birthYear} currentAge={currentAge} />
          </div>
        )}

        {/* ─── SECTION 1: ข้อมูลความต้องการ ──────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#1e3a5f] text-white text-[10px] font-bold flex items-center justify-center">1</span>
            ความต้องการทุนประกัน (Need Analysis)
          </h3>

          <MoneyInput label="ค่าจัดงานศพ" value={p1.funeralCost} onChange={(v) => update({ funeralCost: v })} hint="แนะนำ 200,000-500,000 บาท" />

          {/* Debts — can link from Balance Sheet */}
          <div className="space-y-2">
            <LinkToggle
              label="ดึงหนี้สินจาก Balance Sheet"
              checked={p1.useBalanceSheetDebts}
              onChange={(v) => update({ useBalanceSheetDebts: v })}
              linkedValue={totalDebtsFromBS}
              linkedLabel="หนี้สินรวมจาก Balance Sheet"
            />
            <MoneyInput
              label={p1.useBalanceSheetDebts ? "หนี้สินเพิ่มเติม (ที่ไม่ได้อยู่ใน Balance Sheet)" : "หนี้สินทั้งหมด"}
              value={p1.additionalDebts}
              onChange={(v) => update({ additionalDebts: v })}
              hint={p1.useBalanceSheetDebts ? undefined : "สินเชื่อบ้าน, รถ, บัตรเครดิต ฯลฯ"}
            />
          </div>

          {/* Family expenses — can link from Cashflow */}
          <div className="space-y-2">
            <LinkToggle
              label="ดึงค่าใช้จ่ายจาก Cash Flow"
              checked={p1.useCashflowExpense}
              onChange={(v) => update({ useCashflowExpense: v })}
              linkedValue={monthlyExpenseFromCF}
              linkedLabel="ค่าใช้จ่ายเฉลี่ย/เดือน"
            />
            {!p1.useCashflowExpense && (
              <MoneyInput label="ค่าใช้จ่ายครอบครัว / เดือน" value={p1.familyExpenseMonthly} onChange={(v) => update({ familyExpenseMonthly: v })} />
            )}
            <NumberInput label="จำนวนปีที่ต้องดูแลครอบครัว" value={p1.familyAdjustmentYears} onChange={(v) => update({ familyAdjustmentYears: v })} />
            {p1.useCashflowExpense && (
              <div className="text-[10px] text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                ค่าใช้จ่ายครอบครัว {p1.familyAdjustmentYears} ปี = {fmt(monthlyExpenseFromCF)} x 12 x {p1.familyAdjustmentYears} = <span className="font-bold">{fmt(monthlyExpenseFromCF * 12 * p1.familyAdjustmentYears)} บาท</span>
              </div>
            )}
          </div>

          <MoneyInput label="ทุนการศึกษาบุตร" value={p1.educationFund} onChange={(v) => update({ educationFund: v })} hint="รวมค่าเรียนจนจบ ของทุกคน" />

          {/* Parent support */}
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="เงินดูแลพ่อ/แม่ ต่อเดือน" value={p1.parentSupportMonthly} onChange={(v) => update({ parentSupportMonthly: v })} />
            <NumberInput label="อีกกี่ปี" value={p1.parentSupportYears} onChange={(v) => update({ parentSupportYears: v })} />
          </div>

          <MoneyInput label="ความต้องการอื่นๆ" value={p1.otherNeeds} onChange={(v) => update({ otherNeeds: v })} />
        </div>

        {/* ─── SECTION 2: สิ่งที่มีอยู่ ──────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#1e3a5f] text-white text-[10px] font-bold flex items-center justify-center">2</span>
            ความคุ้มครองที่มีอยู่ (What You Have)
          </h3>

          {/* Life policies summary */}
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-800">ทุนประกันชีวิตรวม (Death Benefit)</span>
              <span className="text-sm font-bold text-blue-600">{fmt(totalLifeCoverage)} บาท</span>
            </div>
            {lifePolicies.length > 0 ? (
              <div className="space-y-1">
                {lifePolicies.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[10px]">
                    <span className="text-blue-700">{p.planName} <span className="text-blue-400">({p.company || "-"})</span></span>
                    <span className="font-bold text-blue-600">{fmt(p.sumInsured)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-blue-400">ยังไม่มีกรมธรรม์ประกันชีวิต — เพิ่มได้ที่หน้าสรุปกรมธรรม์</div>
            )}
          </div>

          <MoneyInput label="เงินออม/สินทรัพย์สภาพคล่องที่เตรียมไว้" value={p1.existingSavings} onChange={(v) => update({ existingSavings: v })} hint="เงินฝาก, กองทุน, สินทรัพย์ที่แปลงเป็นเงินสดได้เร็ว" />
        </div>

        {/* ─── SECTION 3: Gap Analysis ───────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#1e3a5f] text-white text-[10px] font-bold flex items-center justify-center">3</span>
            วิเคราะห์ช่องว่าง (Gap Analysis)
          </h3>

          {/* Breakdown table: Need */}
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">ทุนประกันที่ต้องการ (Need)</div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              {analysis.breakdown.map((b) => (
                <div key={b.label} className="flex items-center justify-between px-3 py-2 border-b border-gray-50 last:border-b-0">
                  <span className="text-xs text-gray-600">{b.label}</span>
                  <span className="text-xs font-bold text-gray-800">{fmt(b.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2.5 bg-red-50">
                <span className="text-xs font-bold text-red-700">รวมทุนที่ต้องการ</span>
                <span className="text-sm font-extrabold text-red-600">{fmt(analysis.totalNeed)}</span>
              </div>
            </div>
          </div>

          {/* Breakdown table: Have */}
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">ทุนที่มีอยู่ (Have)</div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              {analysis.haveBreakdown.map((b) => (
                <div key={b.label} className="flex items-center justify-between px-3 py-2 border-b border-gray-50 last:border-b-0">
                  <span className="text-xs text-gray-600">{b.label}</span>
                  <span className="text-xs font-bold text-gray-800">{fmt(b.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2.5 bg-emerald-50">
                <span className="text-xs font-bold text-emerald-700">รวมทุนที่มี</span>
                <span className="text-sm font-extrabold text-emerald-600">{fmt(analysis.totalHave)}</span>
              </div>
            </div>
          </div>

          {/* Visual: Need vs Have bar */}
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">Need vs Have</div>
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-red-600 font-semibold">Need: {fmt(analysis.totalNeed)}</span>
                  <span className="text-gray-400">100%</span>
                </div>
                <div className="h-5 bg-red-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-red-500" style={{ width: "100%" }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-emerald-600 font-semibold">Have: {fmt(analysis.totalHave)}</span>
                  <span className="text-gray-400">{analysis.coveragePct.toFixed(0)}%</span>
                </div>
                <div className="h-5 bg-emerald-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${analysis.coveragePct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Gap Result */}
          <div className={`rounded-xl p-4 text-center ${analysis.gap <= 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
            {analysis.gap <= 0 ? (
              <>
                <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                <div className="text-sm font-bold text-emerald-700">ทุนประกันเพียงพอ!</div>
                <div className="text-xs text-emerald-600 mt-1">มีทุนเกินกว่าที่ต้องการ {fmt(Math.abs(analysis.gap))} บาท</div>
              </>
            ) : (
              <>
                <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
                <div className="text-sm font-bold text-red-700">ช่องว่างความคุ้มครอง (Gap)</div>
                <div className="text-2xl font-extrabold text-red-600 mt-1">{fmt(analysis.gap)} บาท</div>
                <div className="text-[10px] text-red-500 mt-1">
                  ควรเพิ่มทุนประกันชีวิตอีก {fmtShort(analysis.gap)} บาท
                </div>
              </>
            )}
          </div>

          {/* CFP Tip */}
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
            <div className="text-[10px] font-bold text-amber-800 mb-1">💡 คำแนะนำจาก CFP</div>
            <div className="text-[10px] text-amber-700 leading-relaxed space-y-1">
              <p>• <strong>Capital Utilization Approach</strong> — คำนวณจากยอดเงินที่ครอบครัวต้องใช้จริงหากขาดรายได้หลัก</p>
              <p>• แนะนำทุนประกันชีวิตขั้นต่ำ = <strong>5-10 เท่า</strong> ของรายได้สุทธิต่อปี</p>
              {(profile.salary || 0) > 0 && (
                <p>• รายได้ปัจจุบัน {fmt((profile.salary || 0) * 12)}/ปี → ทุนแนะนำ <strong>{fmt((profile.salary || 0) * 12 * 5)} - {fmt((profile.salary || 0) * 12 * 10)}</strong> บาท</p>
              )}
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="mx-1">
          <button
            onClick={handleSave}
            className="w-full py-3 rounded-2xl bg-[#1e3a5f] text-white text-sm font-bold hover:bg-[#2d5a8e] active:scale-[0.98] transition shadow-lg"
          >
            บันทึกการประเมิน Pillar 1
          </button>
        </div>
      </div>
    </div>
  );
}
