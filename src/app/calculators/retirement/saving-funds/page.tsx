"use client";

import { useMemo, useState } from "react";
import { Save, Plus, RefreshCw, Info } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import { useInsuranceStore } from "@/store/insurance-store";
import { useVariableStore } from "@/store/variable-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import CashflowItemCard from "@/components/CashflowItemCard";
import { toast } from "@/store/toast-store";
import type { SavingFundItem, CashflowKind } from "@/types/retirement";
import {
  getCashflowContribution,
  npvItemAtRetire,
  type CashflowContext,
  type CashflowRegistryContext,
  type CalcSourceKey,
} from "@/lib/cashflow";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

// Map calc-link items to their editor href
const EDIT_HREF: Record<string, string> = {
  ss_pension: "/calculators/retirement/social-security",
  pvd_at_retire: "/calculators/retirement/pvd",
  severance_pay: "/calculators/retirement/severance",
  pension_insurance: "/calculators/retirement/pension-insurance",
};

export default function SavingFundsPage() {
  const store = useRetirementStore();
  const insurance = useInsuranceStore();
  const { setVariable } = useVariableStore();
  const a = store.assumptions;
  const [hasSaved, setHasSaved] = useState(false);

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
      ssParams: store.ssParams,
      pvdParams: store.pvdParams,
      severanceParams: store.severanceParams,
      caretakerParams: store.caretakerParams,
      annuityStreams: insurance.policies
        .filter((p) => p.policyType === "annuity" && p.annuityDetails)
        .map((p) => ({
          label: p.planName,
          payoutStartAge: p.annuityDetails!.payoutStartAge,
          payoutPerYear: p.annuityDetails!.payoutPerYear,
          payoutEndAge: p.annuityDetails!.payoutEndAge,
        })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ctx.currentAge,
      ctx.retireAge,
      ctx.lifeExpectancy,
      ctx.extraYearsBeyondLife,
      ctx.generalInflation,
      ctx.postRetireReturn,
      store.ssParams,
      store.pvdParams,
      store.severanceParams,
      store.caretakerParams,
      insurance.policies,
    ],
  );

  // Per-item NPV computation
  const itemNPV = (item: SavingFundItem): number => {
    const srcKind = item.sourceKind ?? (item.source === "calculator" ? "calc-link" : "inline");
    if (srcKind === "inline") {
      // Prefer new `amount` field if present; else fall back to cached `value`
      if (item.amount !== undefined || item.kind !== undefined) {
        return npvItemAtRetire(item, ctx);
      }
      return item.value || 0;
    }
    const key = item.calcSourceKey as CalcSourceKey | undefined;
    if (!key) return item.value || 0;
    const contrib = getCashflowContribution(key, registryCtx);
    return contrib?.npvAtRetire ?? 0;
  };

  const totalSavingFund = store.savingFunds.reduce(
    (sum, f) => sum + itemNPV(f),
    0,
  );

  // "Sync cached value" button — write latest NPV into each fund's `value` cache
  const handleSyncAll = () => {
    let count = 0;
    for (const f of store.savingFunds) {
      const npv = itemNPV(f);
      if (Math.abs(npv - f.value) > 1) {
        store.pullFromCalculator(f.id, npv);
        count++;
      }
    }
    if (count === 0) {
      toast.warning("ข้อมูลตรงกับค่าล่าสุดแล้ว");
    } else {
      toast.success(`อัปเดต ${count} รายการ`);
    }
  };

  const handleSave = () => {
    store.markStepCompleted("saving_funds");
    setVariable({
      key: "retire_fund_existing",
      label: "แหล่งเงินทุนที่มี",
      value: totalSavingFund,
      source: "retirement",
    });
    setHasSaved(true);
    setTimeout(() => {
      window.location.href = "/calculators/retirement/plan";
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="แหล่งเงินทุนที่มีอยู่แล้ว"
        subtitle="Existing Saving Funds"
        backHref="/calculators/retirement/plan"
      />

      <div className="px-4 md:px-8 pt-4 pb-8">
        {/* Hint */}
        <div className="text-[11px] text-gray-500 bg-emerald-50 rounded-xl px-4 py-2.5 mb-4 leading-relaxed flex items-start gap-2">
          <Info size={14} className="text-emerald-500 mt-0.5 shrink-0" />
          <div>
            รายการ 🔗 (ประกันสังคม, PVD, เงินชดเชย, ประกันบำนาญ) ดึงจาก
            calc อื่นอัตโนมัติ —
            รายการ inline (RMF, กบข., อื่นๆ) กรอกเอง ปรับก้อนเดียว/ต่อเนื่องได้
          </div>
        </div>

        {/* Sync button */}
        <button
          onClick={handleSyncAll}
          className="w-full py-2.5 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 transition mb-4"
        >
          <RefreshCw size={12} className="inline mr-1" />
          ↻ อัปเดตค่าล่าสุดจาก calc ทั้งหมด
        </button>

        {/* Items */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-xs font-bold text-gray-500 mb-3">
            รายการแหล่งเงินทุน
          </div>
          <div className="space-y-3">
            {store.savingFunds.map((item) => {
              const srcKind =
                item.sourceKind ??
                (item.source === "calculator" ? "calc-link" : "inline");

              if (srcKind === "calc-link") {
                const contrib = item.calcSourceKey
                  ? getCashflowContribution(
                      item.calcSourceKey as CalcSourceKey,
                      registryCtx,
                    )
                  : null;
                const editHref =
                  (item.calcSourceKey && EDIT_HREF[item.calcSourceKey]) ||
                  "/calculators/retirement";
                return (
                  <CashflowItemCard
                    key={item.id}
                    mode="calc-link"
                    direction="income"
                    item={item}
                    ctx={ctx}
                    contribution={contrib}
                    editHref={editHref}
                    editLabel="ไปคำนวณ"
                    onRemove={() => store.removeSavingFund(item.id)}
                    canRemove={false}
                  />
                );
              }

              // Inline (sf4 RMF, sf6 กบข., sf7 เงินครบกำหนด, sf8 อื่นๆ, custom)
              return (
                <CashflowItemCard
                  key={item.id}
                  mode="inline"
                  direction="income"
                  item={item}
                  ctx={ctx}
                  onUpdateName={(name) =>
                    store.updateSavingFundName(item.id, name)
                  }
                  onUpdateAmount={(v) => store.updateSavingFundAmount(item.id, v)}
                  onUpdateInflation={(r) =>
                    store.updateSavingFundInflation(item.id, r)
                  }
                  onUpdateKind={(k: CashflowKind) =>
                    store.updateSavingFundKind(item.id, k)
                  }
                  onUpdateOccurAge={(age) =>
                    store.updateSavingFundOccurAge(item.id, age)
                  }
                  onUpdateStartAge={(age) =>
                    store.updateSavingFundStartAge(item.id, age)
                  }
                  onUpdateEndAge={(age) =>
                    store.updateSavingFundEndAge(item.id, age)
                  }
                  onRemove={() => store.removeSavingFund(item.id)}
                  canRemove
                />
              );
            })}
          </div>
          <button
            onClick={() => store.addSavingFund("แหล่งเงินทุนใหม่")}
            className="mt-3 flex items-center gap-1 text-xs text-emerald-600 font-medium"
          >
            <Plus size={14} /> เพิ่มรายการ
          </button>
        </div>

        {/* Summary */}
        <div className="mt-4 bg-emerald-50 rounded-xl p-4">
          <div className="flex justify-between text-sm">
            <span className="font-bold text-gray-700">
              รวมแหล่งเงินทุนทั้งหมด (NPV ณ วันเกษียณ)
            </span>
            <span className="font-extrabold text-emerald-700">
              ฿{fmt(totalSavingFund)}
            </span>
          </div>
        </div>

        {/* Save */}
        <ActionButton
          label="บันทึกแหล่งเงินทุน"
          successLabel="บันทึกแล้ว"
          onClick={handleSave}
          hasCompleted={hasSaved}
          variant="primary"
          icon={<Save size={16} />}
          className="mt-4"
        />
      </div>
    </div>
  );
}
