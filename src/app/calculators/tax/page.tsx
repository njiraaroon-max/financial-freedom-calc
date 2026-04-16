"use client";

import { useState, useEffect, useRef } from "react";
import { Download, Save, ChevronDown, ChevronUp, Receipt, Shield } from "lucide-react";
import { useTaxStore } from "@/store/tax-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import MoneyInput from "@/components/MoneyInput";
import { useCashFlowStore } from "@/store/cashflow-store";
import { useVariableStore } from "@/store/variable-store";
import { useInsuranceStore } from "@/store/insurance-store";
import { toast } from "@/store/toast-store";
import {
  calcExpenseDeductions,
  calcTaxFromNetIncome,
  calcTotalTax,
  calcEffectiveDeduction,
  TAX_BRACKETS,
  DEDUCTION_GROUP_LABELS,
} from "@/types/tax";
import type { TaxableIncome } from "@/types/tax";
import { Trash2, Plus } from "lucide-react";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

function NumberInput({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  return (
    <MoneyInput
      value={value}
      onChange={onChange}
      className={`text-sm font-semibold bg-gray-50 rounded-xl px-2 py-1.5 outline-none focus:ring-2 text-right ${className || "w-24"}`}
      ringClass="focus:ring-[var(--color-primary)]"
    />
  );
}

export default function TaxPage() {
  const store = useTaxStore();
  const cfStore = useCashFlowStore();
  const { setVariable } = useVariableStore();
  const [hasSaved, setHasSaved] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["income", "expense", "deduction", "calculate"]));
  const hasAutoFilled = useRef(false);

  // Auto-pull incomes from CF on first load
  useEffect(() => {
    if (hasAutoFilled.current) return;
    const timer = setTimeout(() => {
      pullFromCF();
      hasAutoFilled.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const pullFromCF = () => {
    const cf = useCashFlowStore.getState();
    const incomeMap: Record<string, number> = {};

    cf.incomes.forEach((inc) => {
      const cat = inc.taxCategory || "40(1)";
      if (cat === "exempt") return;
      const annual = inc.amounts.reduce((s, a) => s + a, 0);
      incomeMap[cat] = (incomeMap[cat] || 0) + annual;
    });

    const taxIncomes: TaxableIncome[] = [];
    const labels: Record<string, string> = {
      "40(1)": "40(1) เงินเดือน ค่าจ้าง โบนัส",
      "40(2)": "40(2) ค่าธรรมเนียม ค่านายหน้า",
      "40(3)": "40(3) ค่าลิขสิทธิ์",
      "40(4)": "40(4) ดอกเบี้ย เงินปันผล",
      "40(5)": "40(5) ค่าเช่าทรัพย์สิน",
      "40(6)": "40(6) วิชาชีพอิสระ",
      "40(7)": "40(7) รับเหมา",
      "40(8)": "40(8) ธุรกิจอื่นๆ",
    };

    for (const [type, amount] of Object.entries(incomeMap)) {
      if (amount > 0) {
        taxIncomes.push({ type, label: labels[type] || type, amount });
      }
    }

    store.setIncomes(taxIncomes);

    // Auto-fill deductions from CF
    const latestStore = useTaxStore.getState();
    // ประกันสังคม
    const ssAnnual = cf.expenses
      .filter(e => e.name.includes("ประกันสังคม"))
      .reduce((s, e) => s + e.amounts.reduce((a, b) => a + b, 0), 0);
    if (ssAnnual > 0) {
      const d = latestStore.deductions.find(d => d.id === "d10");
      if (d && d.beforeAmount === 0) {
        store.updateDeduction("d10", "beforeAmount", Math.min(ssAnnual, 10500));
        store.updateDeduction("d10", "afterAmount", Math.min(ssAnnual, 10500));
      }
    }

    // ประกันชีวิต
    const lifeInsAnnual = cf.expenses
      .filter(e => e.name.includes("ประกันชีวิต"))
      .reduce((s, e) => s + e.amounts.reduce((a, b) => a + b, 0), 0);
    if (lifeInsAnnual > 0) {
      const d = latestStore.deductions.find(d => d.id === "d11");
      if (d && d.beforeAmount === 0) {
        store.updateDeduction("d11", "beforeAmount", Math.min(lifeInsAnnual, 100000));
        store.updateDeduction("d11", "afterAmount", Math.min(lifeInsAnnual, 100000));
      }
    }

    // ประกันสุขภาพ
    const healthInsAnnual = cf.expenses
      .filter(e => e.name.includes("ประกันสุขภาพ"))
      .reduce((s, e) => s + e.amounts.reduce((a, b) => a + b, 0), 0);
    if (healthInsAnnual > 0) {
      const d = latestStore.deductions.find(d => d.id === "d12");
      if (d && d.beforeAmount === 0) {
        store.updateDeduction("d12", "beforeAmount", Math.min(healthInsAnnual, 25000));
        store.updateDeduction("d12", "afterAmount", Math.min(healthInsAnnual, 25000));
      }
    }

    // PVD
    const pvdAnnual = cf.expenses
      .filter(e => e.name.includes("PVD") || e.name.includes("กองทุนสำรอง"))
      .reduce((s, e) => s + e.amounts.reduce((a, b) => a + b, 0), 0);
    if (pvdAnnual > 0) {
      const d = latestStore.deductions.find(d => d.id === "d17");
      if (d && d.beforeAmount === 0) {
        store.updateDeduction("d17", "beforeAmount", pvdAnnual);
        store.updateDeduction("d17", "afterAmount", pvdAnnual);
      }
    }

    // ภาษีหัก ณ ที่จ่าย
    const whtAnnual = cf.expenses
      .filter(e => e.name.includes("ภาษีหัก") || e.name.includes("ภาษี ณ"))
      .reduce((s, e) => s + e.amounts.reduce((a, b) => a + b, 0), 0);
    if (whtAnnual > 0) {
      store.setWithholdingTax(whtAnnual);
    }

    // Refresh expense deductions from new incomes
    setTimeout(() => {
      const latestIncomes = useTaxStore.getState().incomes;
      const computed = calcExpenseDeductions(latestIncomes);
      store.setExpenseDeductions(
        computed.map((e, i) => ({
          id: `exp_${i}`,
          type: e.type,
          description: e.description,
          amount: Math.round(e.deduction),
        }))
      );
    }, 50);
  };

  // Auto-compute expense deductions from incomes and sync to store
  const computedExpenses = calcExpenseDeductions(store.incomes);

  // If store has no expense deductions yet, or income changed, sync defaults
  useEffect(() => {
    if (store.incomes.length > 0 && store.expenseDeductions.length === 0) {
      store.setExpenseDeductions(
        computedExpenses.map((e, i) => ({
          id: `exp_${i}`,
          type: e.type,
          description: e.description,
          amount: Math.round(e.deduction),
        }))
      );
    }
  }, [store.incomes.length]);

  // Calculations
  const totalIncome = store.incomes.reduce((s, i) => s + i.amount, 0);
  const totalExpenseDeduction = store.expenseDeductions.length > 0
    ? store.expenseDeductions.reduce((s, e) => s + e.amount, 0)
    : computedExpenses.reduce((s, e) => s + e.deduction, 0);

  const totalDeductionBefore = store.deductions.reduce((s, d) => s + calcEffectiveDeduction(d, "beforeAmount"), 0);
  const totalDeductionAfter = store.deductions.reduce((s, d) => s + calcEffectiveDeduction(d, "afterAmount"), 0);

  const netIncomeBefore = Math.max(totalIncome - totalExpenseDeduction - totalDeductionBefore, 0);
  const netIncomeAfter = Math.max(totalIncome - totalExpenseDeduction - totalDeductionAfter, 0);

  const taxBracketsBefore = calcTaxFromNetIncome(netIncomeBefore);
  const taxBracketsAfter = calcTaxFromNetIncome(netIncomeAfter);
  const totalTaxBefore = calcTotalTax(netIncomeBefore);
  const totalTaxAfter = calcTotalTax(netIncomeAfter);

  const taxRefundBefore = store.withholdingTax - totalTaxBefore;
  const taxRefundAfter = store.withholdingTax - totalTaxAfter;

  const effectiveBefore = totalIncome > 0 ? (totalTaxBefore / totalIncome) * 100 : 0;
  const effectiveAfter = totalIncome > 0 ? (totalTaxAfter / totalIncome) * 100 : 0;
  const taxSaved = totalTaxBefore - totalTaxAfter;

  const toggleSection = (s: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const pullFromInsurance = () => {
    const policies = useInsuranceStore.getState().policies;

    // Life / Endowment / Term → d11 (max 100,000)
    const lifeTotal = policies
      .filter((p) => ["whole_life", "endowment", "term"].includes(p.policyType))
      .reduce((s, p) => s + p.premium, 0);

    // Health (life & non-life) → d12 (max 25,000)
    const healthTotal = policies
      .filter((p) => p.policyType === "health" || p.policyType === "nonlife_health")
      .reduce((s, p) => s + p.premium, 0);

    // Annuity → d14 (15% of income, max 200,000)
    const annuityTotal = policies
      .filter((p) => p.policyType === "annuity")
      .reduce((s, p) => s + p.premium, 0);

    if (lifeTotal + healthTotal + annuityTotal === 0) {
      toast.warning("ยังไม่มีกรมธรรม์ในแผนประกัน กรุณาเพิ่มกรมธรรม์ก่อน");
      return;
    }

    const income = useTaxStore.getState().incomes.reduce((s, i) => s + i.amount, 0);
    const lifeDeductible = Math.min(lifeTotal, 100000);
    const healthDeductible = Math.min(healthTotal, 25000);
    const annuityCap = income > 0 ? Math.min(income * 0.15, 200000) : 200000;
    const annuityDeductible = Math.min(annuityTotal, annuityCap);

    store.updateDeduction("d11", "beforeAmount", lifeDeductible);
    store.updateDeduction("d11", "afterAmount", lifeDeductible);
    store.updateDeduction("d12", "beforeAmount", healthDeductible);
    store.updateDeduction("d12", "afterAmount", healthDeductible);
    store.updateDeduction("d14", "beforeAmount", annuityDeductible);
    store.updateDeduction("d14", "afterAmount", annuityDeductible);

    toast.success("ดึงค่าลดหย่อนจากแผนประกันแล้ว");
  };

  const handleSave = () => {
    setVariable({ key: "annual_tax_before", label: "ภาษีเงินได้ (Before)", value: totalTaxBefore, source: "tax" });
    setVariable({ key: "annual_tax_after", label: "ภาษีเงินได้ (After)", value: totalTaxAfter, source: "tax" });
    setVariable({ key: "tax_saved", label: "ภาษีที่ประหยัดได้", value: taxSaved, source: "tax" });
    setHasSaved(true);
  };

  const SectionHeader = ({ id, title, subtitle }: { id: string; title: string; subtitle?: string }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between px-4 py-3.5 bg-[#1e3a5f] text-white rounded-t-xl"
    >
      <div className="text-left">
        <div className="text-sm font-bold">{title}</div>
        {subtitle && <div className="text-[10px] opacity-60 mt-0.5">{subtitle}</div>}
      </div>
      <div className="shrink-0 ml-2">
        {openSections.has(id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="วางแผนภาษี"
        subtitle="Tax Planning"
        characterImg="/character/tax.png"
        rightElement={<Receipt size={20} className="text-violet-500" />}
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-3">

        {/* Pull from CF button */}
        <button
          onClick={pullFromCF}
          className="w-full py-2.5 rounded-xl bg-violet-50 text-violet-600 text-xs font-medium hover:bg-violet-100 transition flex items-center justify-center gap-1"
        >
          <Download size={14} />
          ดึงข้อมูลจาก Cash Flow
        </button>

        {/* Pull from Insurance button */}
        <button
          onClick={pullFromInsurance}
          className="w-full py-2.5 rounded-xl bg-purple-50 text-purple-600 text-xs font-medium hover:bg-purple-100 transition flex items-center justify-center gap-1"
        >
          <Shield size={14} />
          ดึงค่าลดหย่อนจากแผนประกัน
        </button>

        {/* ===== Section 1: เงินได้พึงประเมิน ===== */}
        <div className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader id="income" title="เงินได้พึงประเมิน" subtitle="รายได้ทั้งปี แยกตามประเภท 40(1)-40(8)" />
          {openSections.has("income") && (
            <div className="bg-white p-4 space-y-2">
              {store.incomes.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-4">ยังไม่มีข้อมูล — กดดึงจาก Cash Flow</div>
              )}
              {store.incomes.map((inc) => (
                <div key={inc.type} className="flex items-center gap-2 py-1">
                  <span className="flex-1 text-sm text-gray-700 truncate">{inc.label}</span>
                  <NumberInput value={inc.amount} onChange={(v) => store.updateIncome(inc.type, v)} className="w-32" />
                  <button onClick={() => store.removeIncome(inc.type)} className="text-gray-300 hover:text-red-500 shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const types = ["40(1)", "40(2)", "40(3)", "40(4)", "40(5)", "40(6)", "40(7)", "40(8)"];
                  const existing = store.incomes.map(i => i.type);
                  const available = types.filter(t => !existing.includes(t));
                  if (available.length > 0) {
                    const labels: Record<string, string> = {
                      "40(1)": "40(1) เงินเดือน ค่าจ้าง", "40(2)": "40(2) ค่านายหน้า",
                      "40(3)": "40(3) ค่าลิขสิทธิ์", "40(4)": "40(4) ดอกเบี้ย เงินปันผล",
                      "40(5)": "40(5) ค่าเช่า", "40(6)": "40(6) วิชาชีพอิสระ",
                      "40(7)": "40(7) รับเหมา", "40(8)": "40(8) ธุรกิจอื่นๆ",
                    };
                    store.addIncome(available[0], labels[available[0]] || available[0], 0);
                  }
                }}
                className="flex items-center gap-1 text-xs text-violet-600 font-medium mt-2"
              >
                <Plus size={14} /> เพิ่มเงินได้
              </button>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="text-sm font-bold text-gray-700">รวมเงินได้พึงประเมิน</span>
                <span className="text-sm font-extrabold text-[#1e3a5f]">฿{fmt(totalIncome)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ===== Section 2: ค่าใช้จ่าย ===== */}
        <div className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader id="expense" title="ค่าใช้จ่าย (หักตามกฎหมาย)" subtitle="คำนวณอัตโนมัติตามประเภทเงินได้" />
          {openSections.has("expense") && (
            <div className="bg-white p-4 space-y-2">
              {store.expenseDeductions.length > 0 ? (
                store.expenseDeductions.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 py-1">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-700">{e.type}</span>
                      <span className="text-xs text-gray-400 ml-1">({e.description})</span>
                    </div>
                    <NumberInput value={e.amount} onChange={(v) => store.updateExpenseDeduction(e.id, v)} className="w-32" />
                    <button onClick={() => store.removeExpenseDeduction(e.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              ) : (
                computedExpenses.map((e) => (
                  <div key={e.type} className="flex items-center justify-between py-1">
                    <div>
                      <span className="text-sm text-gray-700">{e.type}</span>
                      <span className="text-xs text-gray-400 ml-1">({e.description})</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">฿{fmt(e.deduction)}</span>
                  </div>
                ))
              )}
              <button
                onClick={() => store.addExpenseDeduction("อื่นๆ", "กรอกเอง", 0)}
                className="flex items-center gap-1 text-xs text-violet-600 font-medium mt-2"
              >
                <Plus size={14} /> เพิ่มค่าใช้จ่าย
              </button>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="text-sm font-bold text-gray-700">รวมค่าใช้จ่าย</span>
                <span className="text-sm font-extrabold text-[#1e3a5f]">฿{fmt(totalExpenseDeduction)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ===== Section 3: ค่าลดหย่อน ===== */}
        <div className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader id="deduction" title="ค่าลดหย่อน" subtitle="Before & After — วางแผนลดหย่อนเพิ่ม" />
          {openSections.has("deduction") && (
            <div className="bg-white p-4">
              {/* Header row */}
              <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-gray-500">
                <div className="flex-1">รายการ</div>
                <div className="w-32 text-center">Before</div>
                <div className="w-32 text-center">After</div>
              </div>

              {[1, 2, 3, 4].map((group) => {
                const items = store.deductions.filter(d => d.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group} className="mb-4">
                    <div className="text-xs font-bold text-violet-600 mb-2 bg-violet-50 px-2 py-1 rounded">
                      {DEDUCTION_GROUP_LABELS[group]}
                      {group === 2 && <span className="text-[9px] text-violet-400 ml-1">(กลุ่มออมรวมไม่เกิน 500,000)</span>}
                    </div>
                    <div className="space-y-1.5">
                      {items.map((d) => (
                        <div key={d.id} className="flex items-center gap-1.5">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-700 truncate">
                              {d.name}
                              {d.multiplier && d.multiplier > 1 && <span className="text-[10px] text-violet-500 ml-1">×{d.multiplier}</span>}
                            </div>
                            {d.hint && <div className="text-[10px] text-gray-400">{d.hint}</div>}
                          </div>
                          <NumberInput
                            value={d.beforeAmount}
                            onChange={(v) => store.updateDeduction(d.id, "beforeAmount", v)}
                            className="w-32"
                          />
                          <NumberInput
                            value={d.afterAmount}
                            onChange={(v) => store.updateDeduction(d.id, "afterAmount", v)}
                            className="w-32"
                          />
                          <button onClick={() => store.removeDeduction(d.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => store.addDeduction(group, "ค่าลดหย่อนใหม่")}
                        className="flex items-center gap-1 text-xs text-violet-600 font-medium mt-1"
                      >
                        <Plus size={12} /> เพิ่มรายการ
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="border-t border-gray-200 pt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-sm font-bold text-gray-700">รวมค่าลดหย่อน</div>
                  <div className="w-32 text-center text-sm font-extrabold text-[#1e3a5f]">฿{fmt(totalDeductionBefore)}</div>
                  <div className="w-32 text-center text-sm font-extrabold text-violet-600">฿{fmt(totalDeductionAfter)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===== Section 4: คำนวณภาษี ===== */}
        <div className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader id="calculate" title="คำนวณภาษีเงินได้บุคคลธรรมดา" subtitle="เปรียบเทียบ Before & After" />
          {openSections.has("calculate") && (
            <div className="bg-white p-4">
              {/* เงินได้สุทธิ */}
              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 text-xs font-bold text-gray-600">เงินได้สุทธิ</div>
                  <div className="w-32 text-center text-[10px] font-bold text-gray-400">Before</div>
                  <div className="w-32 text-center text-[10px] font-bold text-gray-400">After</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-[10px] text-gray-500">เงินได้ − ค่าใช้จ่าย − ค่าลดหย่อน</div>
                  <div className="w-32 text-center text-xs font-bold">฿{fmt(netIncomeBefore)}</div>
                  <div className="w-32 text-center text-xs font-bold text-violet-600">฿{fmt(netIncomeAfter)}</div>
                </div>
              </div>

              {/* ตารางขั้นภาษี */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden mb-4">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-[#1e3a5f] text-white">
                      <th className="px-2 py-2 text-left">เงินได้สุทธิ</th>
                      <th className="px-2 py-2 text-center">อัตรา</th>
                      <th className="px-2 py-2 text-right">Before</th>
                      <th className="px-2 py-2 text-right">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TAX_BRACKETS.map((b, i) => {
                      const bTax = taxBracketsBefore[i]?.tax || 0;
                      const aTax = taxBracketsAfter[i]?.tax || 0;
                      if (bTax === 0 && aTax === 0 && i > 1) return null;
                      return (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="px-2 py-1.5 text-gray-600">{b.label}</td>
                          <td className="px-2 py-1.5 text-center text-gray-500">{b.rate === 0 ? "ยกเว้น" : `${(b.rate * 100)}%`}</td>
                          <td className="px-2 py-1.5 text-right font-semibold">{bTax > 0 ? fmt(bTax) : "-"}</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-violet-600">{aTax > 0 ? fmt(aTax) : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td colSpan={2} className="px-2 py-2 text-xs">รวมภาษีเงินได้</td>
                      <td className="px-2 py-2 text-right text-xs text-red-600">฿{fmt(totalTaxBefore)}</td>
                      <td className="px-2 py-2 text-right text-xs text-violet-600">฿{fmt(totalTaxAfter)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* ภาษีหัก ณ ที่จ่าย */}
              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-600">ภาษีหัก ณ ที่จ่ายแล้ว</span>
                  <NumberInput
                    value={store.withholdingTax}
                    onChange={(v) => store.setWithholdingTax(v)}
                    className="w-32"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">ภาษีได้คืน (จ่ายเพิ่ม)</span>
                  <div className="flex gap-3">
                    <span className={`text-xs font-bold ${taxRefundBefore >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {taxRefundBefore >= 0 ? `คืน ฿${fmt(taxRefundBefore)}` : `จ่ายเพิ่ม ฿${fmt(Math.abs(taxRefundBefore))}`}
                    </span>
                    <span className={`text-xs font-bold ${taxRefundAfter >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {taxRefundAfter >= 0 ? `คืน ฿${fmt(taxRefundAfter)}` : `จ่ายเพิ่ม ฿${fmt(Math.abs(taxRefundAfter))}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bar Chart 1: ภาษี Before vs After vs ประหยัด */}
              {totalTaxBefore > 0 && (() => {
                const maxVal = totalTaxBefore;
                const barMaxH = 120;
                const bH = barMaxH;
                const aH = Math.round(barMaxH * (totalTaxAfter / maxVal));
                const sH = Math.max(Math.round(barMaxH * (taxSaved / maxVal)), 0);
                return (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                    <div className="text-xs font-bold text-[#1e3a5f] text-center mb-4">เปรียบเทียบภาษีเงินได้</div>
                    <div className="flex items-end justify-center gap-8" style={{ height: `${barMaxH + 30}px` }}>
                      <div className="flex flex-col items-center">
                        <div className="text-xs font-bold text-red-700 mb-1">{fmt(totalTaxBefore)}</div>
                        <div className="bg-[#8b2020] rounded-t" style={{ width: "50px", height: `${bH}px` }} />
                        <div className="text-xs text-gray-500 mt-2">Before</div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="text-xs font-bold text-blue-700 mb-1">{fmt(totalTaxAfter)}</div>
                        <div className="bg-[#6382b8] rounded-t" style={{ width: "50px", height: `${aH}px` }} />
                        <div className="text-xs text-gray-500 mt-2">After</div>
                      </div>
                      {taxSaved > 0 && (
                        <div className="flex flex-col items-center">
                          <div className="text-xs font-bold text-emerald-700 mb-1">{fmt(taxSaved)}</div>
                          <div className="bg-emerald-500 rounded-t" style={{ width: "50px", height: `${sH}px` }} />
                          <div className="text-xs text-gray-500 mt-2">ประหยัด</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Bar Chart 2: Effective Tax Rate */}
              {totalTaxBefore > 0 && (() => {
                const maxETR = Math.max(effectiveBefore, effectiveAfter, 1);
                const barMaxH = 90;
                const bH = Math.round(barMaxH * (effectiveBefore / maxETR));
                const aH = Math.round(barMaxH * (effectiveAfter / maxETR));
                return (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                    <div className="text-xs font-bold text-[#1e3a5f] text-center mb-4">Effective Tax Rate</div>
                    <div className="flex items-end justify-center gap-10" style={{ height: `${barMaxH + 30}px` }}>
                      <div className="flex flex-col items-center">
                        <div className="text-xs font-bold text-red-700 mb-1">{effectiveBefore.toFixed(1)}%</div>
                        <div className="bg-[#8b2020] rounded-t" style={{ width: "60px", height: `${bH}px` }} />
                        <div className="text-xs text-gray-500 mt-2">Before</div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="text-xs font-bold text-blue-700 mb-1">{effectiveAfter.toFixed(1)}%</div>
                        <div className="bg-[#6382b8] rounded-t" style={{ width: "60px", height: `${aH}px` }} />
                        <div className="text-xs text-gray-500 mt-2">After</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Save Button */}
        <ActionButton
          label="บันทึก"
          successLabel="บันทึกแล้ว"
          onClick={handleSave}
          hasCompleted={hasSaved}
          variant="primary"
          icon={<Save size={18} />}
        />
      </div>
    </div>
  );
}
