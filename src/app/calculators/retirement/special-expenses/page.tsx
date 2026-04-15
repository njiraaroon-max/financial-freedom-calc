"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Save, Plus, Trash2, Info, Download, CheckCircle2, ExternalLink, X, HeartPulse, Plane, Home, Car, HandHelping, Sparkles, Undo2, RotateCcw } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import { useProfileStore } from "@/store/profile-store";
import { useInsuranceStore } from "@/store/insurance-store";
import { useVariableStore } from "@/store/variable-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import { futureValue, DEFAULT_SPECIAL_EXPENSES } from "@/types/retirement";
import type { SpecialExpenseItem } from "@/types/retirement";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

const INFLATION_HINTS: { label: string; rate: number }[] = [
  { label: "0%", rate: 0 },
  { label: "1%", rate: 0.01 },
  { label: "2%", rate: 0.02 },
  { label: "3%", rate: 0.03 },
  { label: "4%", rate: 0.04 },
  { label: "5%", rate: 0.05 },
  { label: "6%", rate: 0.06 },
  { label: "7%", rate: 0.07 },
  { label: "8%", rate: 0.08 },
  { label: "9%", rate: 0.09 },
];

// ─── Icon + description metadata for summary table ───
const ITEM_META: Record<string, { icon: React.ElementType; desc: string }> = {
  se1: { icon: HeartPulse, desc: "เบี้ยประกันสุขภาพหลังเกษียณ · เงินเฟ้อ {rate} × {years} ปี" },
  se2: { icon: HandHelping, desc: "NPV ค่าคนดูแล (คิดเงินเฟ้อ + discount แล้ว)" },
  se3: { icon: Plane, desc: "ท่องเที่ยว/สันทนาการ · เงินเฟ้อ {rate} × {years} ปี" },
  se4: { icon: Home, desc: "ซ่อมแซม/ต่อเติมที่อยู่อาศัย · เงินเฟ้อ {rate} × {years} ปี" },
  se5: { icon: Car, desc: "ยานพาหนะ/ค่าบำรุงรักษา · เงินเฟ้อ {rate} × {years} ปี" },
};

export default function SpecialExpensesPage() {
  const store = useRetirementStore();
  const profile = useProfileStore();
  const insuranceStore = useInsuranceStore();
  const { variables } = useVariableStore();
  const a = store.assumptions;
  const [hasSaved, setHasSaved] = useState(false);
  const [showInflation, setShowInflation] = useState<string | null>(null);
  const [pulledId, setPulledId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<{ item: SpecialExpenseItem; index: number } | null>(null);

  // Detect missing default items (so deletes can be undone by restore button)
  const missingDefaults = useMemo(
    () => {
      const existingIds = new Set(store.specialExpenses.map((e) => e.id));
      return DEFAULT_SPECIAL_EXPENSES.filter((d) => !existingIds.has(d.id));
    },
    [store.specialExpenses],
  );

  const handleRequestDelete = (id: string) => {
    if (confirmDeleteId === id) {
      // second click = actually delete + keep snapshot for undo
      const idx = store.specialExpenses.findIndex((e) => e.id === id);
      const item = store.specialExpenses[idx];
      if (item) {
        setLastDeleted({ item, index: idx });
        store.removeSpecialExpense(id);
        setConfirmDeleteId(null);
        // Auto-hide undo after 8 seconds
        setTimeout(() => {
          setLastDeleted((prev) => (prev && prev.item.id === id ? null : prev));
        }, 8000);
      }
    } else {
      // first click — ask for confirmation, auto-revert after 3s
      setConfirmDeleteId(id);
      setTimeout(() => {
        setConfirmDeleteId((prev) => (prev === id ? null : prev));
      }, 3000);
    }
  };

  const handleUndoDelete = () => {
    if (!lastDeleted) return;
    store.restoreSpecialExpense(lastDeleted.item, lastDeleted.index);
    setLastDeleted(null);
  };

  // ─── NPV of health premium from Pillar 2 (Risk Management) ────────────
  // คำนวณ NPV ของเบี้ยประกันสุขภาพทั้งหมดตั้งแต่ retireAge → lifeExp+extra
  // discount กลับมาที่ retireAge ด้วย postRetireReturn
  const pillar2NPV = useMemo(() => {
    const p2 = insuranceStore.riskManagement.pillar2;
    const brackets = p2.premiumBrackets || [];
    if (brackets.length === 0) return { npv: 0, hasData: false };
    const retireAge = p2.useProfileRetireAge ? (profile.retireAge || 60) : (p2.customRetireAge || 60);
    const lifeExpectancy = a.lifeExpectancy || 85;
    const extraYears = Math.max(0, p2.premiumExtraYears || 0);
    const endAge = Math.max(lifeExpectancy + extraYears, retireAge);
    const discountRate = (p2.postRetireReturn ?? 4) / 100;
    let npv = 0;
    for (let age = retireAge; age <= endAge; age++) {
      const bracket = brackets.find((b) => age >= b.ageFrom && age <= b.ageTo);
      const premium = bracket?.annualPremium || 0;
      if (premium > 0) {
        const yearsFromRetire = age - retireAge;
        npv += discountRate > 0 ? premium / Math.pow(1 + discountRate, yearsFromRetire) : premium;
      }
    }
    return { npv: Math.round(npv), hasData: npv > 0 };
  }, [insuranceStore.riskManagement.pillar2, profile, a.lifeExpectancy]);

  const handlePullFromPillar2 = (id: string) => {
    if (!pillar2NPV.hasData) return;
    // NPV ถูก discount ณ retireAge แล้ว → set inflation = 0 กัน double-compound
    store.updateSpecialExpense(id, pillar2NPV.npv);
    store.updateSpecialExpenseInflation(id, 0);
    setPulledId(id);
    setTimeout(() => setPulledId(null), 2500);
  };

  // ─── Caretaker NPV (from calculator variable store) ──────────────────────────
  const caretakerNPV = useMemo(() => {
    const v = variables["caretaker_npv"];
    return { npv: v?.value || 0, hasData: !!v && v.value > 0 };
  }, [variables]);

  const handlePullFromCaretaker = (id: string) => {
    const v = useVariableStore.getState().variables["caretaker_npv"];
    const npv = v?.value || 0;
    if (npv <= 0) return;
    store.updateSpecialExpense(id, npv);
    // NPV จากเครื่องคำนวณเป็นมูลค่า ณ วันเกษียณแล้ว → set inflation = 0
    store.updateSpecialExpenseInflation(id, 0);
    setPulledId(id);
    setTimeout(() => setPulledId(null), 2500);
  };

  // Auto-sync age from profile
  useEffect(() => {
    const profileAge = profile.getAge();
    if (profileAge > 0 && profileAge !== a.currentAge) {
      store.updateAssumption("currentAge", profileAge);
    }
  }, [profile.birthDate]);

  const yearsToRetire = Math.max(a.retireAge - a.currentAge, 0);
  const yearsAfterRetire = Math.max(a.lifeExpectancy - a.retireAge, 0);

  // ค่าใช้จ่ายพิเศษ = เงินก้อน ปรับ FV ด้วยเงินเฟ้อแต่ละรายการ แล้วรวมกัน
  // NPV items (se1/se2 ที่ดึงจากเครื่องคำนวณ) จะ set inflation = 0 → FV = amount
  const totalSpecialFV = store.specialExpenses.reduce((sum, e) => {
    const rate = e.inflationRate ?? a.generalInflation;
    return sum + futureValue(e.amount, rate, yearsToRetire);
  }, 0);

  // ทุนเกษียณ (B) = รวมเงินก้อนทั้งหมด ณ วันเกษียณ
  const specialRetireFund = totalSpecialFV;

  const handleSave = () => {
    store.markStepCompleted("special_expenses");
    setHasSaved(true);
    setTimeout(() => {
      window.location.href = "/calculators/retirement";
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="ค่าใช้จ่ายพิเศษหลังเกษียณ"
        subtitle="รถยนต์ ท่องเที่ยว รักษาพยาบาล ฯลฯ"
        backHref="/calculators/retirement"
      />

      <div className="px-4 md:px-8 pt-4 pb-8">
        {/* Intro blurb + (i) */}
        <div className="bg-gradient-to-br from-pink-600 to-rose-500 rounded-2xl p-4 text-white mx-1 mb-4 relative">
          <button
            onClick={() => setShowInfo(true)}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
            aria-label="วิธีคำนวณ"
          >
            <Info size={16} />
          </button>
          <div className="pr-10">
            <div className="text-[10px] font-bold text-white/70 mb-1">Step 1 · Special Expenses</div>
            <h3 className="text-sm font-bold leading-snug mb-1.5">
              ประเมินค่าใช้จ่ายพิเศษหลังเกษียณ
            </h3>
            <p className="text-[11px] text-white/80 leading-relaxed">
              รถยนต์ ท่องเที่ยว เบี้ยประกันสุขภาพ ฯลฯ — เงินก้อนที่จ่ายครั้งเดียว
              เรานำแต่ละรายการ × เงินเฟ้อของรายการนั้น ตามหลัก CFP Module 4 (Lump-Sum Needs)
            </p>
            <button
              onClick={() => setShowInfo(true)}
              className="mt-2 inline-flex items-center gap-1 text-[10px] text-white/90 font-bold hover:text-white underline-offset-2 hover:underline"
            >
              <Info size={11} /> ดูวิธีคำนวณตามหลัก CFP
            </button>
          </div>
        </div>

        {/* Hint */}
        <div className="bg-amber-50 rounded-xl p-3 mb-4 flex items-start gap-2">
          <Info size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="text-[10px] text-amber-700">
            ใส่ค่าใช้จ่ายเป็น<b>มูลค่าปัจจุบัน (PV)</b> ระบบจะปรับเป็นมูลค่า ณ วันเกษียณให้อัตโนมัติ
            สามารถเลือกอัตราเงินเฟ้อแยกแต่ละรายการได้
          </div>
        </div>

        {/* Missing-defaults banner (shown only if user deleted any default item) */}
        {missingDefaults.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-start gap-2">
            <RotateCcw size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-blue-900 font-bold">
                มีรายการ default หายไป {missingDefaults.length} รายการ
              </div>
              <div className="text-[10px] text-blue-700 mt-0.5 leading-relaxed">
                {missingDefaults.map((d) => d.name).join(" · ")}
                {missingDefaults.some((d) => d.id === "se2") && (
                  <span className="block mt-0.5 text-blue-600">
                    💡 กู้คืน &ldquo;ค่าคนดูแลยามเกษียณ&rdquo; แล้วปุ่ม &ldquo;ไปคำนวณ&rdquo; จะกลับมาด้วย
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => store.restoreDefaultSpecialExpenses()}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-[10px] font-bold hover:bg-blue-600 active:scale-95 transition"
            >
              กู้คืน
            </button>
          </div>
        )}

        {/* Items */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-xs font-bold text-gray-500 mb-3">รายจ่ายพิเศษ (ราคาปัจจุบัน)</div>
          <div className="space-y-3">
            {store.specialExpenses.map((item) => {
              const rate = item.inflationRate ?? a.generalInflation;
              const fv = futureValue(item.amount, rate, yearsToRetire);
              return (
                <div key={item.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => store.updateSpecialExpenseName(item.id, e.target.value)}
                      className="flex-1 text-sm font-medium bg-transparent outline-none"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.amount ? item.amount.toLocaleString("th-TH") : ""}
                      onChange={(e) => store.updateSpecialExpense(item.id, Number(e.target.value.replace(/[^0-9.-]/g, "")) || 0)}
                      className="w-28 text-sm font-semibold bg-white rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition text-right"
                    />
                    <span className="text-[10px] text-gray-400">บาท</span>
                    <button
                      onClick={() => handleRequestDelete(item.id)}
                      className={`shrink-0 flex items-center gap-1 rounded-md transition ${
                        confirmDeleteId === item.id
                          ? "px-2 py-1 bg-red-500 text-white hover:bg-red-600"
                          : "px-1 py-1 text-gray-300 hover:text-red-500"
                      }`}
                      title={confirmDeleteId === item.id ? "กดอีกครั้งเพื่อยืนยันลบ" : "ลบรายการนี้"}
                    >
                      {confirmDeleteId === item.id ? (
                        <span className="text-[10px] font-bold">ยืนยันลบ?</span>
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                  {/* Inflation selector */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-gray-400 mr-1">เงินเฟ้อ:</span>
                    {INFLATION_HINTS.map((h) => (
                      <button
                        key={h.rate}
                        onClick={() => {
                          if (showInflation === item.id && rate === h.rate) {
                            setShowInflation(null);
                          } else {
                            store.updateSpecialExpenseInflation(item.id, h.rate);
                            setShowInflation(item.id);
                          }
                        }}
                        className={`px-2 py-0.5 rounded-full text-[10px] transition ${
                          Math.abs(rate - h.rate) < 0.001
                            ? "bg-indigo-500 text-white font-bold"
                            : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                        }`}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                  {/* FV preview */}
                  {item.amount > 0 && (
                    <div className="text-[10px] text-gray-400 mt-1">
                      → มูลค่า ณ วันเกษียณ: <span className="text-pink-600 font-bold">฿{fmt(fv)}</span>
                    </div>
                  )}
                  {/* Pull from Risk Management (health insurance premium only) */}
                  {item.id === "se1" && (
                    <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] text-gray-500">
                        {pillar2NPV.hasData
                          ? <>NPV จาก Risk Management: <b className="text-teal-700">฿{fmt(pillar2NPV.npv)}</b></>
                          : <span className="text-gray-400">ยังไม่มีข้อมูลเบี้ยใน Risk Management</span>}
                      </span>
                      <div className="flex items-center gap-2">
                        <Link
                          href="/calculators/insurance/pillar-2#premium"
                          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-teal-600 hover:underline"
                        >
                          ไปคำนวณ <ExternalLink size={10} />
                        </Link>
                        <button
                          onClick={() => handlePullFromPillar2(item.id)}
                          disabled={!pillar2NPV.hasData}
                          title="ดึง NPV เบี้ยประกันสุขภาพ (คิด discount กลับมาที่ retireAge แล้ว)"
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            pulledId === item.id
                              ? "bg-emerald-500 text-white"
                              : pillar2NPV.hasData
                                ? "bg-teal-500 text-white hover:bg-teal-600 active:scale-95"
                                : "bg-gray-100 text-gray-300 cursor-not-allowed"
                          }`}
                        >
                          {pulledId === item.id ? (
                            <><CheckCircle2 size={11} /> ดึงแล้ว</>
                          ) : (
                            <><Download size={11} /> ดึงจาก Risk Management</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Pull from Caretaker calculator (NPV) */}
                  {item.id === "se2" && (
                    <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] text-gray-500">
                        {caretakerNPV.hasData
                          ? <>NPV จากเครื่องคำนวณ: <b className="text-pink-600">฿{fmt(caretakerNPV.npv)}</b></>
                          : <span className="text-gray-400">ยังไม่ได้คำนวณค่าคนดูแล</span>}
                      </span>
                      <div className="flex items-center gap-2">
                        <Link
                          href="/calculators/retirement/caretaker"
                          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-pink-600 hover:underline"
                        >
                          ไปคำนวณ <ExternalLink size={10} />
                        </Link>
                        <button
                          onClick={() => handlePullFromCaretaker(item.id)}
                          disabled={!caretakerNPV.hasData}
                          title="ดึง NPV ค่าคนดูแล (คิด discount กลับมาที่ retireAge แล้ว)"
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            pulledId === item.id
                              ? "bg-emerald-500 text-white"
                              : caretakerNPV.hasData
                                ? "bg-pink-500 text-white hover:bg-pink-600 active:scale-95"
                                : "bg-gray-100 text-gray-300 cursor-not-allowed"
                          }`}
                        >
                          {pulledId === item.id ? (
                            <><CheckCircle2 size={11} /> ดึงแล้ว</>
                          ) : (
                            <><Download size={11} /> ดึงจากเครื่องคำนวณ</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => store.addSpecialExpense("รายจ่ายพิเศษใหม่")}
            className="mt-3 flex items-center gap-1 text-xs text-[var(--color-primary)] font-medium"
          >
            <Plus size={14} /> เพิ่มรายการ
          </button>
        </div>

        {/* Summary Table */}
        <div className="mt-4 bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
          <div className="bg-[#1e3a5f] px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-white">ตารางสรุป ค่าใช้จ่ายพิเศษหลังเกษียณ</span>
            <span className="text-[10px] text-white/80 font-medium">มูลค่า ณ วันเกษียณ</span>
          </div>
          <div className="divide-y divide-gray-100">
            {store.specialExpenses.map((item) => {
              const rate = item.inflationRate ?? a.generalInflation;
              const fv = futureValue(item.amount, rate, yearsToRetire);
              const meta = ITEM_META[item.id] || { icon: Sparkles, desc: "ค่าใช้จ่ายพิเศษเพิ่มเติม" };
              const Icon = meta.icon;
              const descText = meta.desc
                .replace("{rate}", `${(rate * 100).toFixed(0)}%`)
                .replace("{years}", `${yearsToRetire}`);
              return (
                <div key={item.id} className="flex items-stretch">
                  <div className="w-14 shrink-0 flex items-center justify-center bg-[#1e3a5f]/5 border-r border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center shadow-sm">
                      <Icon size={18} />
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-between gap-3 px-4 py-3 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-800 truncate">{item.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5 leading-snug">{descText}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      {item.amount > 0 ? (
                        <>
                          <div className="text-sm font-bold text-[#1e3a5f]">฿{fmt(fv)}</div>
                          {rate > 0 && Math.abs(fv - item.amount) > 1 && (
                            <div className="text-[9px] text-gray-300 mt-0.5 font-medium">
                              ≈ ฿{fmt(item.amount)} ณ ปัจจุบัน
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-gray-300">—</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-pink-50 px-4 py-3 flex items-center justify-between border-t-2 border-pink-200">
            <div>
              <div className="text-sm font-bold text-gray-700">ทุนเกษียณ (B)</div>
              <div className="text-[10px] text-gray-500">รวมค่าใช้จ่ายพิเศษ ณ วันเกษียณ</div>
            </div>
            <span className="text-lg font-extrabold text-pink-700">฿{fmt(specialRetireFund)}</span>
          </div>
        </div>

        {/* Save */}
        <ActionButton
          label="บันทึกค่าใช้จ่ายพิเศษ"
          successLabel="บันทึกแล้ว"
          onClick={handleSave}
          hasCompleted={hasSaved}
          variant="primary"
          icon={<Save size={16} />}
          className="mt-4"
        />
      </div>

      {/* Undo toast (shown for 8s after a delete) */}
      {lastDeleted && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] bg-gray-900 text-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 max-w-[90vw] animate-fade-in-up">
          <div className="text-xs">
            ลบรายการ <b className="text-pink-300">&ldquo;{lastDeleted.item.name}&rdquo;</b> แล้ว
          </div>
          <button
            onClick={handleUndoDelete}
            className="flex items-center gap-1 px-3 py-1.5 bg-pink-500 hover:bg-pink-600 rounded-lg text-xs font-bold active:scale-95 transition"
          >
            <Undo2 size={12} /> ย้อนกลับ
          </button>
          <button
            onClick={() => setLastDeleted(null)}
            className="text-gray-400 hover:text-white"
            aria-label="ปิด"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ─── Info Modal: Special Expenses (Lump-Sum Needs) ──────────── */}
      {showInfo && (
        <div
          className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="bg-white w-full max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-pink-600 text-white px-5 py-4 flex items-center justify-between z-10 md:rounded-t-2xl rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h3 className="text-sm font-bold">หลักการคำนวณค่าใช้จ่ายพิเศษ</h3>
              </div>
              <button onClick={() => setShowInfo(false)} className="text-white/70 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5 text-gray-700">
              <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl p-4 border border-pink-100">
                <p className="text-xs font-bold text-gray-800 leading-relaxed">
                  &ldquo;รถคันใหม่ 1 ล้าน... แต่ 25 ปีข้างหน้าจะราคาเท่าไหร่?&rdquo;
                </p>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                  เงินก้อนที่วางแผนใช้หลังเกษียณ ต้องปรับด้วยเงินเฟ้อเฉพาะของแต่ละกลุ่มสินค้า/บริการ
                </p>
              </div>

              <p className="text-xs leading-relaxed">
                ตามหลัก <strong>CFP Module 4</strong> (การวางแผนเพื่อวัยเกษียณ) ค่าใช้จ่ายพิเศษที่จ่ายเป็น
                <strong> เงินก้อนครั้งเดียว</strong> มีขั้นตอนคำนวณ <strong>3 ขั้นตอน</strong>:
              </p>

              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-pink-100 text-pink-700 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                  <h4 className="text-xs font-bold text-gray-800">ระบุรายการและราคา ณ ปัจจุบัน (PV)</h4>
                </div>
                <p className="text-[11px] leading-relaxed">
                  ค่าใช้จ่ายที่วางแผนไว้หลังเกษียณ เช่น รถใหม่, ท่องเที่ยว, ค่ารักษาพยาบาล,
                  เบี้ยประกันสุขภาพ — ใส่ราคาวันนี้
                </p>
                <div className="bg-pink-50 rounded-lg px-3 py-2 text-[10px] space-y-1">
                  <div className="text-green-700">✓ แยกเป็นรายการ เพื่อใช้อัตราเงินเฟ้อเฉพาะตัว</div>
                </div>
              </div>

              <div className="border-2 border-pink-400 rounded-xl p-4 space-y-2 bg-pink-50/30">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-pink-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  <h4 className="text-xs font-bold text-pink-800">เลือกอัตราเงินเฟ้อเฉพาะแต่ละรายการ ⭐</h4>
                </div>
                <div className="text-[10px] text-pink-600 font-bold bg-pink-100 rounded-lg px-2 py-1 inline-block">ใช้ในหน้านี้</div>
                <p className="text-[11px] leading-relaxed">
                  เงินเฟ้อไม่ได้เท่ากันทุกสินค้า — ค่ารักษาพยาบาลเฟ้อเร็วสุด (~7%) ยานพาหนะ (~2%)
                  อาหาร/ทั่วไป (~3%)
                </p>
                <div className="bg-pink-100 rounded-lg px-3 py-2 text-[10px] space-y-1">
                  <div><strong>สูตร:</strong> FV = PV × (1 + inflation<sub>i</sub>)<sup>n</sup></div>
                  <div className="text-green-700">✓ ปรับเงินเฟ้อแยกรายการ ได้ตัวเลขแม่นยำกว่า</div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-pink-100 text-pink-700 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                  <h4 className="text-xs font-bold text-gray-800">รวมเป็น ทุนเกษียณ (B)</h4>
                </div>
                <p className="text-[11px] leading-relaxed">
                  ผลรวม FV ของทุกรายการ = เงินก้อนที่ต้องเตรียมเพิ่มเติมจากรายจ่ายพื้นฐาน
                  (ไม่ต้องคำนวณ annuity เพราะเป็นเงินจ่ายครั้งเดียว)
                </p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-[10px] space-y-1">
                  <div><strong>สูตร:</strong> B = Σ FV<sub>i</sub></div>
                </div>
              </div>

              <div className="bg-teal-50 rounded-xl p-3 border border-teal-200">
                <div className="text-[10px] text-teal-700 leading-relaxed">
                  💡 หมวด &ldquo;เบี้ยประกันสุขภาพ&rdquo; สามารถดึง NPV จาก Risk Management (Pillar 2)
                  ได้อัตโนมัติ เพื่อไม่ต้องคำนวณเอง
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 md:rounded-b-2xl">
              <button
                onClick={() => setShowInfo(false)}
                className="w-full py-2.5 rounded-xl bg-pink-600 text-white text-sm font-bold hover:bg-pink-700 transition"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
