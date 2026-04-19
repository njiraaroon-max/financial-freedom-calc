"use client";

import { useState } from "react";
import { Plus, Save, Trash2, Table, LayoutList, Eye, EyeOff } from "lucide-react";
import { useBalanceSheetStore } from "@/store/balance-sheet-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import { useVariableStore } from "@/store/variable-store";
import { confirmDialog } from "@/components/ConfirmDialog";
import { ASSET_CATEGORIES, LIABILITY_CATEGORIES } from "@/types/balance-sheet";
import type { AssetCategory, LiabilityCategory } from "@/types/balance-sheet";
import BalanceSheetItemRow from "@/components/BalanceSheetItemRow";
import BalanceSheetTable from "@/components/BalanceSheetTable";
import CategoryPopup from "@/components/CategoryPopup";

function formatCurrency(n: number): string {
  return `฿${n.toLocaleString("th-TH")}`;
}

// Default names shown when a user adds a fresh row. Users can rename inline.
const ASSET_DEFAULT_NAMES: Record<AssetCategory, string> = {
  liquid: "สินทรัพย์สภาพคล่อง",
  investment: "สินทรัพย์ลงทุน",
  personal: "สินทรัพย์ใช้ส่วนตัว",
};
const LIABILITY_DEFAULT_NAMES: Record<LiabilityCategory, string> = {
  short_term: "หนี้สินระยะสั้น",
  long_term: "หนี้สินระยะยาว",
};

export default function BalanceSheetPage() {
  const {
    assets,
    liabilities,
    addAsset,
    addLiability,
    removeItem,
    updateValue,
    updateName,
    setAssetCategory,
    setLiabilityCategory,
    clearAll,
    getTotalByAssetType,
    getTotalByLiabilityType,
    getTotalAssets,
    getTotalLiabilities,
    getNetWorth,
  } = useBalanceSheetStore();

  const { setVariable } = useVariableStore();

  const [hasSaved, setHasSaved] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [categoryPopup, setCategoryPopup] = useState<{
    type: "asset" | "liability";
    itemId: string;
    currentValue: string;
  } | null>(null);

  // Card-view-only optimize toggle (mobile). The table view manages its
  // own optimize state internally — both patterns land on the same UX.
  const [cardOptimize, setCardOptimize] = useState(false);

  const totalAssets = getTotalAssets();
  const totalLiabilities = getTotalLiabilities();
  const netWorth = getNetWorth();

  const liquidTotal = getTotalByAssetType("liquid");
  const investmentTotal = getTotalByAssetType("investment");
  const personalTotal = getTotalByAssetType("personal");
  const shortTermTotal = getTotalByLiabilityType("short_term");
  const longTermTotal = getTotalByLiabilityType("long_term");

  // Wrapped add handlers — tag the item with its category right away so the
  // table's inline "+ เพิ่ม..." buttons can skip the old CategoryPopup flow.
  const handleAddAsset = (type: AssetCategory) => {
    addAsset(ASSET_DEFAULT_NAMES[type], type);
  };
  const handleAddLiability = (type: LiabilityCategory) => {
    addLiability(LIABILITY_DEFAULT_NAMES[type], type);
  };

  const handleSaveVariables = () => {
    setVariable({ key: "total_assets", label: "สินทรัพย์รวม", value: totalAssets, source: "balance-sheet" });
    setVariable({ key: "total_liabilities", label: "หนี้สินรวม", value: totalLiabilities, source: "balance-sheet" });
    setVariable({ key: "net_worth", label: "ความมั่งคั่งสุทธิ", value: netWorth, source: "balance-sheet" });
    setVariable({ key: "liquid_assets", label: "สินทรัพย์สภาพคล่อง", value: liquidTotal, source: "balance-sheet" });
    setVariable({ key: "investment_assets", label: "สินทรัพย์ลงทุน", value: investmentTotal, source: "balance-sheet" });
    setVariable({ key: "short_term_liabilities", label: "หนี้สินระยะสั้น", value: shortTermTotal, source: "balance-sheet" });
    setVariable({ key: "personal_assets", label: "สินทรัพย์ใช้ส่วนตัว", value: personalTotal, source: "balance-sheet" });
    setHasSaved(true);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="งบดุลส่วนบุคคล"
        subtitle="Personal Balance Sheet"
        characterImg="/character/balance.png"
        rightElement={
          <div className="flex bg-gray-100 rounded-full p-0.5 md:hidden">
            <button
              onClick={() => setShowTable(true)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                showTable
                  ? "bg-[var(--color-primary)] text-white shadow"
                  : "text-gray-500"
              }`}
            >
              <Table size={13} />
              ตาราง
            </button>
            <button
              onClick={() => setShowTable(false)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                !showTable
                  ? "bg-[var(--color-primary)] text-white shadow"
                  : "text-gray-500"
              }`}
            >
              <LayoutList size={13} />
              รายการ
            </button>
          </div>
        }
      />

      {/* Net Worth Summary — same mx-2 as BalanceSheetTable */}
      <div className="mx-2 mt-4 mb-2">
        <div className={`rounded-xl overflow-hidden border border-transparent shadow-sm text-white ${netWorth >= 0 ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-red-500 to-rose-600"}`}>
          <div className="p-4">
            <div className="text-xs opacity-80 mb-1">ความมั่งคั่งสุทธิ (Net Worth)</div>
            <div className="text-2xl font-bold mb-3">{formatCurrency(netWorth)}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/20 rounded-xl p-2.5">
                <div className="text-[13px] opacity-80">สินทรัพย์รวม</div>
                <div className="text-sm font-bold">{formatCurrency(totalAssets)}</div>
              </div>
              <div className="bg-red-500/80 rounded-xl p-2.5">
                <div className="text-[13px] opacity-90">หนี้สินรวม</div>
                <div className="text-sm font-bold">{formatCurrency(totalLiabilities)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === TABLE VIEW === (always show on iPad, toggle on mobile) */}
      <div className={`${showTable ? "" : "hidden"} md:block`}>
        <div className="mt-3">
          <BalanceSheetTable
            assets={assets}
            liabilities={liabilities}
            totalAssets={totalAssets}
            totalLiabilities={totalLiabilities}
            netWorth={netWorth}
            liquidTotal={liquidTotal}
            investmentTotal={investmentTotal}
            personalTotal={personalTotal}
            shortTermTotal={shortTermTotal}
            longTermTotal={longTermTotal}
            onUpdateValue={(id, value) => updateValue(id, value)}
            onUpdateName={(id, name) => updateName(id, name)}
            onRemoveItem={(id) => removeItem(id)}
            onAddAsset={handleAddAsset}
            onAddLiability={handleAddLiability}
          />
        </div>
      </div>

      {/* === CARD VIEW === (hide on iPad) */}
      {!showTable && (
        <div className="md:hidden">
          {/* Optimize toolbar — mirrors the table-view toolbar */}
          <div className="px-4 mt-3 flex items-center justify-end">
            <button
              onClick={() => setCardOptimize((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition ${
                cardOptimize
                  ? "bg-indigo-500 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"
              }`}
              title={cardOptimize ? "แสดงทุกรายการ" : "ซ่อนรายการที่เป็น 0"}
            >
              {cardOptimize ? <EyeOff size={13} /> : <Eye size={13} />}
              {cardOptimize ? "Optimize: เปิด" : "Optimize"}
            </button>
          </div>

          {/* Assets Section — one sub-section per category with embedded + row */}
          <div className="px-4 md:px-8 mt-3">
            <h2 className="text-sm font-bold text-gray-700 mb-2">สินทรัพย์</h2>

            {(["liquid", "investment", "personal"] as const).map((type) => {
              const allItems = assets.filter((a) => a.assetType === type);
              const items = cardOptimize
                ? allItems.filter((x) => x.value > 0)
                : allItems;
              const totals = {
                liquid: liquidTotal,
                investment: investmentTotal,
                personal: personalTotal,
              };
              const labels = {
                liquid: "สินทรัพย์สภาพคล่อง",
                investment: "สินทรัพย์ลงทุน",
                personal: "สินทรัพย์ใช้ส่วนตัว",
              };
              return (
                <div key={type} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[14px] font-medium text-emerald-600">
                      {labels[type]}
                    </span>
                    <span className="text-[14px] font-bold text-emerald-700">
                      {formatCurrency(totals[type])}
                    </span>
                  </div>
                  {items.map((item) => (
                    <BalanceSheetItemRow
                      key={item.id}
                      name={item.name}
                      value={item.value}
                      colorType="asset"
                      categoryLabel={
                        ASSET_CATEGORIES.find((c) => c.value === item.assetType)
                          ?.label
                      }
                      onValueChange={(val) => updateValue(item.id, val)}
                      onNameChange={(name) => updateName(item.id, name)}
                      onRemove={() => removeItem(item.id)}
                      onCategoryClick={() =>
                        setCategoryPopup({
                          type: "asset",
                          itemId: item.id,
                          currentValue: item.assetType,
                        })
                      }
                    />
                  ))}
                  {/* Inline add row, per category */}
                  <button
                    onClick={() => handleAddAsset(type)}
                    className="mt-1 w-full flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium text-emerald-600 border border-dashed border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 transition"
                  >
                    <Plus size={14} />
                    เพิ่ม{labels[type]}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Liabilities Section */}
          <div className="px-4 md:px-8 mt-4">
            <h2 className="text-sm font-bold text-gray-700 mb-2">หนี้สิน</h2>

            {(["short_term", "long_term"] as const).map((type) => {
              const allItems = liabilities.filter(
                (l) => l.liabilityType === type,
              );
              const items = cardOptimize
                ? allItems.filter((x) => x.value > 0)
                : allItems;
              const totals = {
                short_term: shortTermTotal,
                long_term: longTermTotal,
              };
              const labels = {
                short_term: "หนี้สินระยะสั้น",
                long_term: "หนี้สินระยะยาว",
              };
              return (
                <div key={type} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[14px] font-medium text-red-600">
                      {labels[type]}
                    </span>
                    <span className="text-[14px] font-bold text-red-700">
                      {formatCurrency(totals[type])}
                    </span>
                  </div>
                  {items.map((item) => (
                    <BalanceSheetItemRow
                      key={item.id}
                      name={item.name}
                      value={item.value}
                      colorType="liability"
                      categoryLabel={
                        LIABILITY_CATEGORIES.find(
                          (c) => c.value === item.liabilityType,
                        )?.label
                      }
                      onValueChange={(val) => updateValue(item.id, val)}
                      onNameChange={(name) => updateName(item.id, name)}
                      onRemove={() => removeItem(item.id)}
                      onCategoryClick={() =>
                        setCategoryPopup({
                          type: "liability",
                          itemId: item.id,
                          currentValue: item.liabilityType,
                        })
                      }
                    />
                  ))}
                  {/* Inline add row, per category */}
                  <button
                    onClick={() => handleAddLiability(type)}
                    className="mt-1 w-full flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium text-red-600 border border-dashed border-red-200 bg-red-50/40 hover:bg-red-50 transition"
                  >
                    <Plus size={14} />
                    เพิ่ม{labels[type]}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Save & Clear Buttons */}
      <div className="px-4 md:px-8 pb-8 pt-4 space-y-3">
        <ActionButton
          label="บันทึก"
          successLabel="บันทึกแล้ว"
          onClick={handleSaveVariables}
          hasCompleted={hasSaved}
          variant="primary"
          icon={<Save size={18} />}
        />
        <ActionButton
          label="ล้างข้อมูลทั้งหมด"
          onClick={async () => {
            const ok = await confirmDialog({
              title: "ล้างข้อมูลงบดุลทั้งหมด?",
              message: "ข้อมูลที่กรอกไว้จะหายทั้งหมด การกระทำนี้ไม่สามารถย้อนกลับได้",
              confirmText: "ล้างข้อมูล",
              cancelText: "ยกเลิก",
              variant: "danger",
            });
            if (ok) clearAll();
          }}
          variant="danger"
          icon={<Trash2 size={16} />}
        />
      </div>

      {/* Category Popups (card view — for reassigning existing item's category) */}
      {categoryPopup && categoryPopup.type === "asset" && (
        <CategoryPopup
          title="ประเภทสินทรัพย์"
          options={ASSET_CATEGORIES}
          selectedValue={categoryPopup.currentValue}
          onSelect={(value) => {
            setAssetCategory(categoryPopup.itemId, value as AssetCategory);
            setCategoryPopup(null);
          }}
          onClose={() => setCategoryPopup(null)}
        />
      )}
      {categoryPopup && categoryPopup.type === "liability" && (
        <CategoryPopup
          title="ประเภทหนี้สิน"
          options={LIABILITY_CATEGORIES}
          selectedValue={categoryPopup.currentValue}
          onSelect={(value) => {
            setLiabilityCategory(
              categoryPopup.itemId,
              value as LiabilityCategory,
            );
            setCategoryPopup(null);
          }}
          onClose={() => setCategoryPopup(null)}
        />
      )}
    </div>
  );
}
