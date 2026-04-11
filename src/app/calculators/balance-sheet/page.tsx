"use client";

import { useState } from "react";
import { Plus, Save, Scale, Trash2, Table, LayoutList } from "lucide-react";
import { useBalanceSheetStore } from "@/store/balance-sheet-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import { useVariableStore } from "@/store/variable-store";
import { ASSET_CATEGORIES, LIABILITY_CATEGORIES } from "@/types/balance-sheet";
import type { AssetCategory, LiabilityCategory } from "@/types/balance-sheet";
import BalanceSheetItemRow from "@/components/BalanceSheetItemRow";
import BalanceSheetTable from "@/components/BalanceSheetTable";
import CategoryPopup from "@/components/CategoryPopup";

function formatCurrency(n: number): string {
  return `฿${n.toLocaleString("th-TH")}`;
}

function parseNum(s: string): number {
  const cleaned = s.replace(/[^0-9.-]/g, "");
  return Number(cleaned) || 0;
}

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

  const { setVariable, variables } = useVariableStore();

  const [hasSaved, setHasSaved] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [categoryPopup, setCategoryPopup] = useState<{
    type: "asset" | "liability";
    itemId: string;
    currentValue: string;
  } | null>(null);
  const [addPopup, setAddPopup] = useState<"asset" | "liability" | null>(null);
  const [newItemEdit, setNewItemEdit] = useState<{ id: string; name: string } | null>(null);
  const [newItemValue, setNewItemValue] = useState("");
  const [newItemName, setNewItemName] = useState("");

  const totalAssets = getTotalAssets();
  const totalLiabilities = getTotalLiabilities();
  const netWorth = getNetWorth();

  const liquidTotal = getTotalByAssetType("liquid");
  const investmentTotal = getTotalByAssetType("investment");
  const personalTotal = getTotalByAssetType("personal");
  const shortTermTotal = getTotalByLiabilityType("short_term");
  const longTermTotal = getTotalByLiabilityType("long_term");

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
        <div className={`rounded-xl overflow-hidden text-white ${netWorth >= 0 ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-red-500 to-rose-600"}`}>
          <div className="p-4">
            <div className="text-xs opacity-80 mb-1">ความมั่งคั่งสุทธิ (Net Worth)</div>
            <div className="text-2xl font-bold mb-3">{formatCurrency(netWorth)}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/20 rounded-xl p-2.5">
                <div className="text-[10px] opacity-80">สินทรัพย์รวม</div>
                <div className="text-sm font-bold">{formatCurrency(totalAssets)}</div>
              </div>
              <div className="bg-red-500/80 rounded-xl p-2.5">
                <div className="text-[10px] opacity-90">หนี้สินรวม</div>
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
          />

          {/* spacer for FAB */}
          <div className="h-4" />
        </div>
      </div>

      {/* === CARD VIEW === (hide on iPad) */}
      {!showTable && (
        <div className="md:hidden">
          {/* Assets Section */}
          <div className="px-4 md:px-8 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-700">สินทรัพย์</h2>
              <button
                onClick={() => setAddPopup("asset")}
                className="flex items-center gap-1 text-xs text-[var(--color-primary)] font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 transition"
              >
                <Plus size={14} />
                เพิ่ม
              </button>
            </div>

            {(["liquid", "investment", "personal"] as const).map((type) => {
              const items = assets.filter((a) => a.assetType === type);
              const totals = { liquid: liquidTotal, investment: investmentTotal, personal: personalTotal };
              const labels = { liquid: "สินทรัพย์สภาพคล่อง", investment: "สินทรัพย์ลงทุน", personal: "สินทรัพย์ใช้ส่วนตัว" };
              if (items.length === 0) return null;
              return (
                <div key={type} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-emerald-600">{labels[type]}</span>
                    <span className="text-[11px] font-bold text-emerald-700">{formatCurrency(totals[type])}</span>
                  </div>
                  {items.map((item) => (
                    <BalanceSheetItemRow
                      key={item.id}
                      name={item.name}
                      value={item.value}
                      colorType="asset"
                      categoryLabel={ASSET_CATEGORIES.find((c) => c.value === item.assetType)?.label}
                      onValueChange={(val) => updateValue(item.id, val)}
                      onNameChange={(name) => updateName(item.id, name)}
                      onRemove={() => removeItem(item.id)}
                      onCategoryClick={() => setCategoryPopup({ type: "asset", itemId: item.id, currentValue: item.assetType })}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Liabilities Section */}
          <div className="px-4 md:px-8 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-700">หนี้สิน</h2>
              <button
                onClick={() => setAddPopup("liability")}
                className="flex items-center gap-1 text-xs text-[var(--color-primary)] font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 transition"
              >
                <Plus size={14} />
                เพิ่ม
              </button>
            </div>

            {(["short_term", "long_term"] as const).map((type) => {
              const items = liabilities.filter((l) => l.liabilityType === type);
              const totals = { short_term: shortTermTotal, long_term: longTermTotal };
              const labels = { short_term: "หนี้สินระยะสั้น", long_term: "หนี้สินระยะยาว" };
              if (items.length === 0) return null;
              return (
                <div key={type} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-red-600">{labels[type]}</span>
                    <span className="text-[11px] font-bold text-red-700">{formatCurrency(totals[type])}</span>
                  </div>
                  {items.map((item) => (
                    <BalanceSheetItemRow
                      key={item.id}
                      name={item.name}
                      value={item.value}
                      colorType="liability"
                      categoryLabel={LIABILITY_CATEGORIES.find((c) => c.value === item.liabilityType)?.label}
                      onValueChange={(val) => updateValue(item.id, val)}
                      onNameChange={(name) => updateName(item.id, name)}
                      onRemove={() => removeItem(item.id)}
                      onCategoryClick={() => setCategoryPopup({ type: "liability", itemId: item.id, currentValue: item.liabilityType })}
                    />
                  ))}
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
          onClick={() => {
            if (confirm("ต้องการล้างข้อมูลงบดุลทั้งหมดใช่ไหม?\nข้อมูลที่กรอกไว้จะหายทั้งหมด")) {
              clearAll();
            }
          }}
          variant="danger"
          icon={<Trash2 size={16} />}
        />
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-4 z-30 flex flex-col gap-2">
        <button
          onClick={() => setAddPopup("asset")}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-600 active:scale-95 transition-all"
        >
          <Plus size={14} />
          เพิ่มสินทรัพย์
        </button>
        <button
          onClick={() => setAddPopup("liability")}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-200 hover:bg-red-600 active:scale-95 transition-all"
        >
          <Plus size={14} />
          เพิ่มหนี้สิน
        </button>
      </div>

      {/* Add Asset Popup — choose category */}
      {addPopup === "asset" && (
        <CategoryPopup
          title="เพิ่มสินทรัพย์ประเภท"
          options={ASSET_CATEGORIES}
          selectedValue=""
          onSelect={(value) => {
            const defaultNames: Record<string, string> = { liquid: "สินทรัพย์สภาพคล่อง", investment: "สินทรัพย์ลงทุน", personal: "สินทรัพย์ส่วนตัว" };
            const name = defaultNames[value] || "สินทรัพย์ใหม่";
            const id = addAsset(name, value as AssetCategory);
            setAddPopup(null);
            setNewItemName(name);
            setNewItemValue("");
            setNewItemEdit({ id, name });
          }}
          onClose={() => setAddPopup(null)}
        />
      )}

      {/* Add Liability Popup — choose category */}
      {addPopup === "liability" && (
        <CategoryPopup
          title="เพิ่มหนี้สินประเภท"
          options={LIABILITY_CATEGORIES}
          selectedValue=""
          onSelect={(value) => {
            const defaultNames: Record<string, string> = { short_term: "หนี้สินระยะสั้น", long_term: "หนี้สินระยะยาว" };
            const name = defaultNames[value] || "หนี้สินใหม่";
            const id = addLiability(name, value as LiabilityCategory);
            setAddPopup(null);
            setNewItemName(name);
            setNewItemValue("");
            setNewItemEdit({ id, name });
          }}
          onClose={() => setAddPopup(null)}
        />
      )}

      {/* New Item — Name + Value Popup */}
      {newItemEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => {
            setNewItemEdit(null);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-5 mx-6 w-full max-w-xs md:max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-bold text-gray-700 mb-3">
              เพิ่มรายการ
            </div>
            <input
              type="text"
              autoFocus
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition mb-3"
              placeholder="ชื่อรายการ"
            />
            <input
              type="text"
              inputMode="numeric"
              value={newItemValue}
              onChange={(e) => setNewItemValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateName(newItemEdit.id, newItemName);
                  updateValue(newItemEdit.id, parseNum(newItemValue));
                  setNewItemEdit(null);
                }
              }}
              className="w-full text-center text-lg font-bold bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition"
              placeholder="มูลค่า"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setNewItemEdit(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  updateName(newItemEdit.id, newItemName);
                  updateValue(newItemEdit.id, parseNum(newItemValue));
                  setNewItemEdit(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-dark)] transition"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Popups (card view) */}
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
            setLiabilityCategory(categoryPopup.itemId, value as LiabilityCategory);
            setCategoryPopup(null);
          }}
          onClose={() => setCategoryPopup(null)}
        />
      )}
    </div>
  );
}
