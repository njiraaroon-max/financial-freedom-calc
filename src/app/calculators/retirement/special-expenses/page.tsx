"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Save,
  Plus,
  Info,
  X,
  HeartPulse,
  Plane,
  Home,
  Car,
  HandHelping,
  Sparkles,
  Undo2,
  RotateCcw,
} from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import { useProfileStore } from "@/store/profile-store";
import { useInsuranceStore } from "@/store/insurance-store";
import { flushAllStores } from "@/lib/sync/flush-all";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import CashflowItemCard from "@/components/CashflowItemCard";
import { DEFAULT_SPECIAL_EXPENSES } from "@/types/retirement";
import type {
  SpecialExpenseItem,
  CashflowKind,
} from "@/types/retirement";
import {
  getCashflowContribution,
  npvItemAtRetire,
  type CashflowContext,
  type CashflowRegistryContext,
} from "@/lib/cashflow";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

const ITEM_META: Record<string, { icon: React.ElementType; desc: string }> = {
  se1: { icon: HeartPulse, desc: "เบี้ยประกันสุขภาพหลังเกษียณ (ดึงจาก Pillar 2)" },
  se2: { icon: HandHelping, desc: "ค่าคนดูแลหลังเกษียณ (ดึงจาก caretaker calc)" },
  se3: { icon: Plane, desc: "ท่องเที่ยว/สันทนาการ (วางแผนรายละเอียด)" },
  se4: { icon: Home, desc: "ซ่อมแซม/ต่อเติมที่อยู่อาศัย" },
  se5: { icon: Car, desc: "ยานพาหนะ/ค่าบำรุงรักษา" },
};

// ---------- Per-item calculation hints ----------
const HINT_CONTENT: Record<string, React.ReactNode> = {
  se4: (
    <>
      <div className="font-bold">วิธีคิด — ซ่อมแซม/ต่อเติมบ้าน</div>
      <div>
        ใส่ <b>ราคาวันนี้</b> ของการซ่อมครั้งนั้น ๆ และอายุที่คาดว่าจะเกิด
        (ถ้ามีหลายครั้ง กด &ldquo;+ เพิ่มรายการ&rdquo;)
      </div>
      <div className="pt-1">
        <div className="font-bold">ช่วงราคาอ้างอิง</div>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>ทาสี / เปลี่ยนหลังคา / ปูพื้นใหม่: 100,000 - 300,000</li>
          <li>ปรับปรุงห้องน้ำ / ครัว / ต่อเติม: 300,000 - 1,000,000</li>
          <li>Renovation ใหญ่: 1,000,000 - 3,000,000+</li>
        </ul>
      </div>
      <div className="pt-1">
        <div className="font-bold">สูตรที่ระบบใช้</div>
        <div>
          1. <b>FV</b> ณ ปีใช้จริง = PV × (1 + เงินเฟ้อ)<sup>ปีที่เกิด − ปีปัจจุบัน</sup>
        </div>
        <div>
          2. <b>NPV</b> ณ วันเกษียณ = FV ÷ (1 + postRetireReturn)<sup>ปีที่เกิด − ปีเกษียณ</sup>
        </div>
      </div>
    </>
  ),
  se5: (
    <>
      <div className="font-bold">วิธีคิด — รถยนต์</div>
      <div>
        ใส่ <b>ราคาวันนี้</b> ของรถที่จะเปลี่ยนและอายุที่คาดจะเปลี่ยน
        (ถ้าจะเปลี่ยนหลายครั้ง กด &ldquo;+ เพิ่มรายการ&rdquo; — ตั้งอายุต่างกัน)
      </div>
      <div className="pt-1">
        <div className="font-bold">ช่วงราคาอ้างอิง (รถใหม่)</div>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>อีโคคาร์ / City car: 500,000 - 900,000</li>
          <li>Sedan / Hatchback: 900,000 - 1,500,000</li>
          <li>SUV / Pickup / EV: 1,200,000 - 3,000,000+</li>
        </ul>
      </div>
      <div className="pt-1">
        <div className="font-bold">สูตรที่ระบบใช้</div>
        <div>
          1. <b>FV</b> ณ ปีใช้จริง = PV × (1 + เงินเฟ้อ)<sup>ปีที่เกิด − ปีปัจจุบัน</sup>
        </div>
        <div>
          2. <b>NPV</b> ณ วันเกษียณ = FV ÷ (1 + postRetireReturn)<sup>ปีที่เกิด − ปีเกษียณ</sup>
        </div>
      </div>
    </>
  ),
};

export default function SpecialExpensesPage() {
  const store = useRetirementStore();
  const profile = useProfileStore();
  const insuranceStore = useInsuranceStore();
  const a = store.assumptions;
  const [hasSaved, setHasSaved] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<{
    item: SpecialExpenseItem;
    index: number;
  } | null>(null);

  const missingDefaults = useMemo(() => {
    const existingIds = new Set(store.specialExpenses.map((e) => e.id));
    return DEFAULT_SPECIAL_EXPENSES.filter((d) => !existingIds.has(d.id));
  }, [store.specialExpenses]);

  const handleRequestDelete = (id: string) => {
    if (confirmDeleteId === id) {
      const idx = store.specialExpenses.findIndex((e) => e.id === id);
      const item = store.specialExpenses[idx];
      if (item) {
        setLastDeleted({ item, index: idx });
        store.removeSpecialExpense(id);
        setConfirmDeleteId(null);
        setTimeout(() => {
          setLastDeleted((prev) =>
            prev && prev.item.id === id ? null : prev,
          );
        }, 8000);
      }
    } else {
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

  // Auto-sync age from profile
  useEffect(() => {
    const profileAge = profile.getAge();
    if (profileAge > 0 && profileAge !== a.currentAge) {
      store.updateAssumption("currentAge", profileAge);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.birthDate]);

  // ----- Cashflow context -----
  const ctx: CashflowContext = {
    currentAge: a.currentAge,
    retireAge: a.retireAge,
    lifeExpectancy: a.lifeExpectancy,
    extraYearsBeyondLife: store.caretakerParams.extraYearsBeyondLife ?? 5,
    generalInflation: a.generalInflation,
    postRetireReturn: a.postRetireReturn,
  };

  const registryCtx: CashflowRegistryContext = useMemo(
    () => ({
      ...ctx,
      caretakerParams: store.caretakerParams,
      pillar2Brackets: insuranceStore.riskManagement.pillar2.premiumBrackets,
      travelItems: store.travelPlanItems,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ctx.currentAge,
      ctx.retireAge,
      ctx.lifeExpectancy,
      ctx.extraYearsBeyondLife,
      ctx.generalInflation,
      ctx.postRetireReturn,
      store.caretakerParams,
      insuranceStore.riskManagement.pillar2.premiumBrackets,
      store.travelPlanItems,
    ],
  );

  // Per-item NPV — for calc-link / sub-calc items, use registry; for inline, compute directly
  const itemNPV = (item: SpecialExpenseItem): number => {
    // Respect user-disabled toggle: excluded from all totals/summary.
    if (item.enabled === false) return 0;
    const srcKind = item.sourceKind ?? "inline";
    if (srcKind === "inline") return npvItemAtRetire(item, ctx);
    const key = item.calcSourceKey as Parameters<
      typeof getCashflowContribution
    >[0];
    const contrib = getCashflowContribution(key, registryCtx);
    return contrib?.npvAtRetire ?? 0;
  };

  const totalSpecial = store.specialExpenses.reduce(
    (sum, e) => sum + itemNPV(e),
    0,
  );

  const handleSave = async () => {
    store.markStepCompleted("special_expenses");
    setHasSaved(true);
    // Flush all stores to Supabase before the full-page reload aborts
    // any in-flight autosave fetches.
    await flushAllStores();
    window.location.href = "/calculators/retirement";
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
        <div className="bg-gradient-to-br from-pink-600 to-rose-500 rounded-2xl p-3.5 text-white mx-1 mb-4 relative">
          <button
            onClick={() => setShowInfo(true)}
            className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
            aria-label="วิธีคำนวณ"
          >
            <Info size={14} />
          </button>
          <div className="pr-8">
            <div className="text-[10px] font-bold tracking-wide uppercase text-white/70 mb-1">
              Step 1 · Special Expenses
            </div>
            <h3 className="text-[13px] font-bold leading-snug mb-1">
              รายจ่ายพิเศษหลังเกษียณ (รองรับทั้งก้อนเดียว และต่อเนื่อง)
            </h3>
            <p className="text-[12px] text-white/80 leading-relaxed">
              แยกเป็น &ldquo;ก้อนเดียว&rdquo; (ซื้อรถ / ซ่อมบ้าน) หรือ
              &ldquo;ต่อเนื่องทุกปี&rdquo; (ท่องเที่ยว / ค่าคนดูแล)
              ระบบคำนวณทั้ง NPV ณ วันเกษียณ และรายปีอัตโนมัติ
            </p>
          </div>
        </div>

        {/* Hint */}
        <div className="bg-amber-50 rounded-xl p-2.5 mb-4 flex items-start gap-2">
          <Info size={12} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="text-[11px] text-amber-700 leading-relaxed">
            ใส่ค่าใช้จ่ายเป็น <b>มูลค่าปัจจุบัน (PV)</b> —
            ระบบจะปรับเงินเฟ้อและ discount ให้อัตโนมัติ
            รายการที่ 🔗 จะดึงจาก calc อื่น (แก้ไขที่ต้นทาง)
          </div>
        </div>

        {/* Missing-defaults banner */}
        {missingDefaults.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 mb-4 flex items-start gap-2">
            <RotateCcw size={12} className="text-blue-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-blue-900 font-bold">
                มีรายการ default หายไป {missingDefaults.length} รายการ
              </div>
              <div className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                {missingDefaults.map((d) => d.name).join(" · ")}
              </div>
            </div>
            <button
              onClick={() => store.restoreDefaultSpecialExpenses()}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-blue-500 text-white text-[11px] font-bold hover:bg-blue-600 active:scale-95 transition"
            >
              กู้คืน
            </button>
          </div>
        )}

        {/* Items */}
        <div className="glass rounded-2xl p-4">
          <div className="text-[10px] font-bold tracking-wide uppercase text-gray-500 mb-3">
            รายจ่ายพิเศษ (PV = ราคาปัจจุบัน)
          </div>
          <div className="space-y-3">
            {store.specialExpenses.map((item) => {
              const srcKind = item.sourceKind ?? "inline";
              const canRemove = confirmDeleteId !== null
                ? confirmDeleteId === item.id
                : true;
              const confirmLabel = confirmDeleteId === item.id;
              const isDisabled = item.enabled === false;
              // Dim the card when disabled; toggle pill stays full-opacity.
              const cardDimClass = isDisabled
                ? "opacity-50 saturate-50"
                : "";

              if (srcKind === "calc-link") {
                const contrib = item.calcSourceKey
                  ? getCashflowContribution(
                      item.calcSourceKey as Parameters<
                        typeof getCashflowContribution
                      >[0],
                      registryCtx,
                    )
                  : null;
                const editHref =
                  item.calcSourceKey === "pillar2_health"
                    ? "/calculators/insurance/pillar-2#premium"
                    : item.calcSourceKey === "caretaker"
                      ? "/calculators/retirement/caretaker"
                      : "/calculators/retirement";
                return (
                  <div key={item.id} className="relative">
                    {confirmLabel && (
                      <div className="absolute -top-2 left-3 z-10">
                        <button
                          onClick={() => handleRequestDelete(item.id)}
                          className="px-2 py-0.5 bg-red-500 text-white rounded-md text-[11px] font-bold"
                        >
                          ยืนยันลบ?
                        </button>
                      </div>
                    )}
                    <div className={cardDimClass}>
                      <CashflowItemCard
                        mode="calc-link"
                        direction="expense"
                        item={item}
                        ctx={ctx}
                        contribution={contrib}
                        editHref={editHref}
                        editLabel="ไปคำนวณ"
                        onRemove={() => handleRequestDelete(item.id)}
                        canRemove={canRemove}
                        enabled={item.enabled !== false}
                        onToggleEnabled={() =>
                          store.toggleSpecialExpenseEnabled(item.id)
                        }
                      />
                    </div>
                  </div>
                );
              }

              if (srcKind === "sub-calc") {
                const contrib = item.calcSourceKey
                  ? getCashflowContribution(
                      item.calcSourceKey as Parameters<
                        typeof getCashflowContribution
                      >[0],
                      registryCtx,
                    )
                  : null;
                return (
                  <div key={item.id} className="relative">
                    {confirmLabel && (
                      <div className="absolute -top-2 left-3 z-10">
                        <button
                          onClick={() => handleRequestDelete(item.id)}
                          className="px-2 py-0.5 bg-red-500 text-white rounded-md text-[11px] font-bold"
                        >
                          ยืนยันลบ?
                        </button>
                      </div>
                    )}
                    <div className={cardDimClass}>
                      <CashflowItemCard
                        mode="sub-calc"
                        direction="expense"
                        item={item}
                        ctx={ctx}
                        contribution={contrib}
                        subCalcHref="/calculators/retirement/special-expenses/travel"
                        subCalcLabel="คำนวณรายละเอียด"
                        onRemove={() => handleRequestDelete(item.id)}
                        canRemove={canRemove}
                        enabled={item.enabled !== false}
                        onToggleEnabled={() =>
                          store.toggleSpecialExpenseEnabled(item.id)
                        }
                      />
                    </div>
                  </div>
                );
              }

              // Inline
              return (
                <div key={item.id} className="relative">
                  {confirmLabel && (
                    <div className="absolute -top-2 left-3 z-10">
                      <button
                        onClick={() => handleRequestDelete(item.id)}
                        className="px-2 py-0.5 bg-red-500 text-white rounded-md text-[11px] font-bold"
                      >
                        ยืนยันลบ?
                      </button>
                    </div>
                  )}
                  <div className={cardDimClass}>
                  <CashflowItemCard
                    mode="inline"
                    direction="expense"
                    item={item}
                    ctx={ctx}
                    hintContent={HINT_CONTENT[item.id]}
                    onUpdateName={(name) =>
                      store.updateSpecialExpenseName(item.id, name)
                    }
                    onUpdateAmount={(v) =>
                      store.updateSpecialExpense(item.id, v)
                    }
                    onUpdateInflation={(r) =>
                      store.updateSpecialExpenseInflation(item.id, r)
                    }
                    onUpdateKind={(k: CashflowKind) =>
                      store.updateSpecialExpenseKind(
                        item.id,
                        k === "recurring" ? "annual" : "lump",
                      )
                    }
                    onUpdateOccurAge={(age) =>
                      store.updateSpecialExpenseOccurAge(item.id, age)
                    }
                    onUpdateStartAge={(age) =>
                      store.updateSpecialExpenseStartAge(item.id, age)
                    }
                    onUpdateEndAge={(age) =>
                      store.updateSpecialExpenseEndAge(item.id, age)
                    }
                    onRemove={() => handleRequestDelete(item.id)}
                    canRemove={canRemove}
                    enabled={item.enabled !== false}
                    onToggleEnabled={() =>
                      store.toggleSpecialExpenseEnabled(item.id)
                    }
                  />
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => store.addSpecialExpense("รายจ่ายพิเศษใหม่")}
            className="mt-3 flex items-center gap-1 text-[11px] text-[var(--color-primary)] font-medium"
          >
            <Plus size={12} /> เพิ่มรายการ
          </button>
        </div>

        {/* Summary Table */}
        <div className="glass mt-4 rounded-2xl overflow-hidden">
          <div className="bg-[#1e3a5f] px-4 py-2 flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wide uppercase text-white">
              ตารางสรุป ค่าใช้จ่ายพิเศษหลังเกษียณ
            </span>
            <span className="text-[10px] text-white/80 font-medium">
              มูลค่าที่ต้องเตรียม ณ วันเกษียณ
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {store.specialExpenses.map((item) => {
              const isDisabled = item.enabled === false;
              const npv = itemNPV(item);
              const meta = ITEM_META[item.id] || {
                icon: Sparkles,
                desc: "ค่าใช้จ่ายพิเศษเพิ่มเติม",
              };
              const Icon = meta.icon;
              return (
                <div
                  key={item.id}
                  className={`flex items-stretch ${isDisabled ? "opacity-50" : ""}`}
                >
                  <div className="w-12 shrink-0 flex items-center justify-center bg-[#1e3a5f]/5 border-r border-gray-100">
                    <div className="w-8 h-8 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center shadow-sm">
                      <Icon size={14} />
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-between gap-3 px-3.5 py-2.5 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold text-gray-800 truncate flex items-center gap-1.5">
                        {item.name}
                        {isDisabled && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500 text-[9px] font-bold">
                            ปิด
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-gray-400 mt-0.5 leading-snug">
                        {meta.desc}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {isDisabled ? (
                        <div className="text-[10.5px] text-gray-400 italic">
                          ไม่รวมในแผน
                        </div>
                      ) : npv > 0 ? (
                        <div className="text-[13px] font-bold text-[#1e3a5f] tabular-nums">
                          ฿{fmt(npv)}
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-300">—</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-pink-50 px-4 py-2.5 flex items-center justify-between border-t-2 border-pink-200">
            <div>
              <div className="text-[12px] font-bold text-gray-700">
                ทุนเกษียณ (B)
              </div>
              <div className="text-[10.5px] text-gray-500">
                รวมมูลค่าที่ต้องเตรียม ณ วันเกษียณ
              </div>
            </div>
            <span className="text-[16px] font-extrabold text-pink-700 tabular-nums">
              ฿{fmt(totalSpecial)}
            </span>
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

      {/* Undo toast */}
      {lastDeleted && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] bg-gray-900 text-white rounded-xl shadow-xl px-3.5 py-2.5 flex items-center gap-3 max-w-[90vw] animate-fade-in-up">
          <div className="text-[11px]">
            ลบรายการ{" "}
            <b className="text-pink-300">
              &ldquo;{lastDeleted.item.name}&rdquo;
            </b>{" "}
            แล้ว
          </div>
          <button
            onClick={handleUndoDelete}
            className="flex items-center gap-1 px-2.5 py-1 bg-pink-500 hover:bg-pink-600 rounded-lg text-[11px] font-bold active:scale-95 transition"
          >
            <Undo2 size={11} /> ย้อนกลับ
          </button>
          <button
            onClick={() => setLastDeleted(null)}
            className="text-gray-400 hover:text-white"
            aria-label="ปิด"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Info Modal */}
      {showInfo && (
        <div
          className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="glass w-full max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-pink-600 text-white px-5 py-4 flex items-center justify-between z-10 md:rounded-t-2xl rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h3 className="text-sm font-bold">
                  หลักการคำนวณค่าใช้จ่ายพิเศษ
                </h3>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="text-white/70 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 text-gray-700 text-[15px] leading-relaxed">
              <p>
                แต่ละรายการรองรับ <b>2 แบบ</b>:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <b>ก้อนเดียว (lump)</b> — ซื้อรถ / ซ่อมบ้าน / เปลี่ยนหลังคา ณ
                  อายุที่กำหนด
                </li>
                <li>
                  <b>ต่อเนื่อง (recurring)</b> — ค่ารักษา / ท่องเที่ยว
                  ตั้งแต่อายุ A ถึง B (คิดเงินเฟ้อรายปี)
                </li>
              </ul>
              <p>
                รายการที่มี 🔗 (เช่น เบี้ยประกันสุขภาพ, ค่าคนดูแล,
                ท่องเที่ยว) จะ&nbsp;
                <b>ดึงจาก calc อื่น</b>
                อัตโนมัติ — แก้ไขที่หน้าต้นทาง
              </p>
              <p className="text-[14px] text-gray-500">
                ระบบคำนวณทั้ง <b>NPV ณ วันเกษียณ</b> (CFP) และ{" "}
                <b>yearly stream</b> (Wealth Journey) จาก input เดียวกัน
                — เลข 2 หน้าตรงกันเสมอ
              </p>
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
