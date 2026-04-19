"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import type {
  AssetItem,
  LiabilityItem,
  AssetCategory,
  LiabilityCategory,
} from "@/types/balance-sheet";
import MoneyInput from "@/components/MoneyInput";

interface BalanceSheetTableProps {
  assets: AssetItem[];
  liabilities: LiabilityItem[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  liquidTotal: number;
  investmentTotal: number;
  personalTotal: number;
  shortTermTotal: number;
  longTermTotal: number;
  onUpdateValue: (id: string, value: number) => void;
  onUpdateName: (id: string, name: string) => void;
  onRemoveItem: (id: string) => void;
  onAddAsset: (type: AssetCategory) => void;
  onAddLiability: (type: LiabilityCategory) => void;
}

function fmt(n: number): string {
  if (n === 0) return "0";
  return n.toLocaleString("th-TH");
}

function pct(value: number, total: number): string {
  if (total === 0) return "0.0%";
  return ((value / total) * 100).toFixed(1) + "%";
}

/**
 * Inline editable item name. Text-like look; becomes an editable input on
 * focus. Commits on blur / Enter. Escape cancels. A small trash icon is
 * revealed on row-hover.
 */
function EditableName({
  name,
  onCommit,
  onRemove,
  textClass,
}: {
  name: string;
  onCommit: (next: string) => void;
  onRemove: () => void;
  textClass?: string;
}) {
  const [draft, setDraft] = useState(name);
  useEffect(() => {
    setDraft(name);
  }, [name]);

  return (
    <div className="group flex items-center gap-1 min-w-0">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = draft.trim();
          if (!next) {
            setDraft(name);
          } else if (next !== name) {
            onCommit(next);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(name);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={`flex-1 min-w-0 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 rounded px-1 py-0.5 ${textClass || ""}`}
      />
      <button
        onClick={onRemove}
        className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 hover:bg-red-50 transition p-1 rounded"
        title="ลบ"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

export default function BalanceSheetTable({
  assets,
  liabilities,
  totalAssets,
  totalLiabilities,
  netWorth,
  liquidTotal,
  investmentTotal,
  personalTotal,
  shortTermTotal,
  longTermTotal,
  onUpdateValue,
  onUpdateName,
  onRemoveItem,
  onAddAsset,
  onAddLiability,
}: BalanceSheetTableProps) {
  const [editCell, setEditCell] = useState<{
    id: string;
    name: string;
    value: number;
  } | null>(null);
  const [editValue, setEditValue] = useState(0);
  const [optimize, setOptimize] = useState(false);

  const handleEditSave = () => {
    if (editCell) {
      onUpdateValue(editCell.id, editValue);
    }
    setEditCell(null);
  };

  const openEdit = (id: string, name: string, value: number) => {
    setEditCell({ id, name, value });
    setEditValue(value);
  };

  // Filter items when optimize mode is on — hide zero-valued rows so the
  // user sees only what's actually on the balance sheet.
  const visible = <T extends { value: number }>(items: T[]): T[] =>
    optimize ? items.filter((x) => x.value > 0) : items;

  const liquidAssets = visible(assets.filter((a) => a.assetType === "liquid"));
  const investmentAssets = visible(
    assets.filter((a) => a.assetType === "investment"),
  );
  const personalAssets = visible(
    assets.filter((a) => a.assetType === "personal"),
  );
  const shortTermLiabilities = visible(
    liabilities.filter((l) => l.liabilityType === "short_term"),
  );
  const longTermLiabilities = visible(
    liabilities.filter((l) => l.liabilityType === "long_term"),
  );

  // Hidden counts for the optimize summary
  const totalItems = assets.length + liabilities.length;
  const hiddenCount =
    totalItems -
    (liquidAssets.length +
      investmentAssets.length +
      personalAssets.length +
      shortTermLiabilities.length +
      longTermLiabilities.length);

  // Styles — same tones as Cash Flow annual table
  const darkBlue = "bg-[#1e3a5f]"; // header (same as CF)
  const subHeader = "bg-[#2c5282]"; // sub-header (same as CF income header)
  const darkRed = "bg-[#c53030]"; // expense header (same as CF)
  // Fresh emerald green — Tailwind emerald-500 tone. Brighter than the
  // previous forest-green so the netWorth block pops on the dashboard.
  const greenBg = "bg-[#10b981]";
  const hWhite = "px-3 py-2 text-xs font-bold text-white";
  const stickyCol = "sticky left-0 z-10"; // first column stays fixed
  const item = "px-3 py-1.5 text-xs border-b border-gray-100";
  const itemSticky = `${item} ${stickyCol} bg-white whitespace-nowrap`;
  const val = "px-3 py-1.5 text-xs text-right border-b border-gray-100";
  const valClick =
    "cursor-pointer hover:bg-indigo-50 active:bg-indigo-100 transition";
  const subtotalL = "px-3 py-1.5 text-xs font-bold border-b border-gray-200";
  const subtotalV =
    "px-3 py-1.5 text-xs font-bold text-right border-b border-gray-200";
  const pinkBg = "bg-red-50";

  // Clickable value cell
  const valTd = (id: string, name: string, value: number) => (
    <td
      className={`${val} ${valClick}`}
      onClick={() => openEdit(id, name, value)}
    >
      {fmt(value)}
    </td>
  );

  // Percentage cell
  const pctTd = (value: number) => (
    <td className={`${val} text-gray-400`}>{pct(value, totalAssets)}</td>
  );

  // Empty right side (3 cells)
  const empty3 = (
    <>
      <td className={item} />
      <td className={val} />
      <td className={val} />
    </>
  );

  // Add-row button (one side, colSpan=3)
  const addBtnCell = (
    label: string,
    onClick: () => void,
    side: "asset" | "liability",
    sticky?: boolean,
  ) => (
    <td
      colSpan={3}
      className={`border-b border-gray-100 p-0 ${sticky ? "sticky left-0 z-10 bg-white" : ""}`}
    >
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition ${
          side === "asset"
            ? "text-emerald-600 hover:bg-emerald-50/60"
            : "text-red-600 hover:bg-red-50/60"
        }`}
      >
        <Plus size={11} />
        {label}
      </button>
    </td>
  );

  // Paired rows helper — asset on left, liability on right
  const pairedRows = (
    leftItems: AssetItem[],
    rightItems: LiabilityItem[],
    keyPrefix: string,
  ) => {
    const maxLen = Math.max(leftItems.length, rightItems.length);
    if (maxLen === 0) return [];
    const rows = [];
    for (let i = 0; i < maxLen; i++) {
      const a = leftItems[i];
      const l = rightItems[i];
      rows.push(
        <tr key={`${keyPrefix}-${i}`} className="bg-white">
          {a ? (
            <>
              <td className={itemSticky}>
                <EditableName
                  name={a.name}
                  onCommit={(next) => onUpdateName(a.id, next)}
                  onRemove={() => onRemoveItem(a.id)}
                />
              </td>
              {valTd(a.id, a.name, a.value)}
              {pctTd(a.value)}
            </>
          ) : (
            <>
              <td className={itemSticky} />
              <td className={val} />
              <td className={val} />
            </>
          )}
          {l ? (
            <>
              <td className={item}>
                <EditableName
                  name={l.name}
                  onCommit={(next) => onUpdateName(l.id, next)}
                  onRemove={() => onRemoveItem(l.id)}
                />
              </td>
              {valTd(l.id, l.name, l.value)}
              {pctTd(l.value)}
            </>
          ) : (
            empty3
          )}
        </tr>,
      );
    }
    return rows;
  };

  return (
    <div className="mx-2 mb-4">
      {/* Optimize Toolbar */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={() => setOptimize((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition ${
            optimize
              ? "bg-indigo-500 text-white shadow-sm"
              : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"
          }`}
          title={optimize ? "แสดงทุกรายการ" : "ซ่อนรายการที่เป็น 0"}
        >
          {optimize ? <EyeOff size={13} /> : <Eye size={13} />}
          {optimize ? "Optimize: เปิด" : "Optimize"}
        </button>
        {optimize && hiddenCount > 0 && (
          <span className="text-[11px] text-gray-400">
            ซ่อน {hiddenCount} รายการ
          </span>
        )}
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-xs md:text-sm"
            style={{ minWidth: 680 }}
          >
            <thead>
              <tr className={darkBlue}>
                <th
                  className={`${hWhite} text-left ${stickyCol} bg-[#1e3a5f]`}
                  style={{ minWidth: 170 }}
                >
                  สินทรัพย์
                </th>
                <th className={`${hWhite} text-right`} style={{ minWidth: 90 }}></th>
                <th className={`${hWhite} text-right`} style={{ minWidth: 50 }}>
                  %
                </th>
                <th
                  className={`${hWhite} text-left bg-[#9b2c2c]`}
                  style={{ minWidth: 170 }}
                >
                  หนี้สินและความมั่งคั่งสุทธิ
                </th>
                <th
                  className={`${hWhite} text-right bg-[#9b2c2c]`}
                  style={{ minWidth: 90 }}
                ></th>
                <th
                  className={`${hWhite} text-right bg-[#9b2c2c]`}
                  style={{ minWidth: 50 }}
                >
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {/* === สินทรัพย์สภาพคล่อง | หนี้สินระยะสั้น === */}
              <tr className={subHeader}>
                <td
                  className={`${hWhite} ${stickyCol} bg-[#2c5282] whitespace-nowrap`}
                >
                  สินทรัพย์สภาพคล่อง (Liquid Asset)
                </td>
                <td colSpan={2} className={`${hWhite}`}></td>
                <td colSpan={3} className={`${hWhite} bg-[#c53030]`}>
                  หนี้สินระยะสั้น (Short-term Liabilities)
                </td>
              </tr>

              {pairedRows(liquidAssets, shortTermLiabilities, "ls")}

              {/* Add rows */}
              <tr className="bg-white">
                {addBtnCell(
                  "เพิ่มสินทรัพย์สภาพคล่อง",
                  () => onAddAsset("liquid"),
                  "asset",
                  true,
                )}
                {addBtnCell(
                  "เพิ่มหนี้สินระยะสั้น",
                  () => onAddLiability("short_term"),
                  "liability",
                )}
              </tr>

              {/* Subtotal */}
              <tr className="bg-white">
                <td
                  className={`${subtotalL} ${stickyCol} bg-white whitespace-nowrap`}
                >
                  รวมสินทรัพย์สภาพคล่อง
                </td>
                <td className={subtotalV}>{fmt(liquidTotal)}</td>
                <td className={subtotalV}>{pct(liquidTotal, totalAssets)}</td>
                <td className={`${subtotalL} ${pinkBg}`}>รวมหนี้สินระยะสั้น</td>
                <td className={`${subtotalV} ${pinkBg}`}>
                  {fmt(shortTermTotal)}
                </td>
                <td className={`${subtotalV} ${pinkBg}`}>
                  {pct(shortTermTotal, totalAssets)}
                </td>
              </tr>

              {/* === สินทรัพย์เพื่อการลงทุน | หนี้สินระยะยาว === */}
              <tr className={subHeader}>
                <td
                  className={`${hWhite} ${stickyCol} bg-[#2c5282] whitespace-nowrap`}
                >
                  สินทรัพย์ลงทุน (Investment Asset)
                </td>
                <td colSpan={2} className={`${hWhite}`}></td>
                <td colSpan={3} className={`${hWhite} bg-[#c53030]`}>
                  หนี้สินระยะยาว (Long-term Liabilities)
                </td>
              </tr>

              {pairedRows(investmentAssets, longTermLiabilities, "il")}

              {/* Add rows */}
              <tr className="bg-white">
                {addBtnCell(
                  "เพิ่มสินทรัพย์ลงทุน",
                  () => onAddAsset("investment"),
                  "asset",
                  true,
                )}
                {addBtnCell(
                  "เพิ่มหนี้สินระยะยาว",
                  () => onAddLiability("long_term"),
                  "liability",
                )}
              </tr>

              {/* Subtotal */}
              <tr className="bg-white">
                <td
                  className={`${subtotalL} ${stickyCol} bg-white whitespace-nowrap`}
                >
                  รวมสินทรัพย์เพื่อการลงทุน
                </td>
                <td className={subtotalV}>{fmt(investmentTotal)}</td>
                <td className={subtotalV}>
                  {pct(investmentTotal, totalAssets)}
                </td>
                <td className={`${subtotalL} ${pinkBg}`}>รวมหนี้สินระยะยาว</td>
                <td className={`${subtotalV} ${pinkBg}`}>
                  {fmt(longTermTotal)}
                </td>
                <td className={`${subtotalV} ${pinkBg}`}>
                  {pct(longTermTotal, totalAssets)}
                </td>
              </tr>

              {/* === สินทรัพย์ใช้ส่วนตัว | รวมหนี้สิน === */}
              <tr className={subHeader}>
                <td
                  className={`${hWhite} ${stickyCol} bg-[#2c5282] whitespace-nowrap`}
                >
                  สินทรัพย์ใช้ส่วนตัว (Personal Asset)
                </td>
                <td colSpan={2} className={`${hWhite}`}></td>
                <td className={`${hWhite} ${darkRed}`}>รวมหนี้สิน</td>
                <td className={`${hWhite} text-right ${darkRed}`}>
                  {fmt(totalLiabilities)}
                </td>
                <td className={`${hWhite} text-right ${darkRed}`}>
                  {pct(totalLiabilities, totalAssets)}
                </td>
              </tr>

              {/* Personal assets + ความมั่งคั่งสุทธิ.
                  Keep the netWorth cells per-row (no rowSpan crossing the
                  add row) so the green block is guaranteed contiguous even
                  when the browser collapses borders oddly. The label is
                  placed on the first asset row; remaining asset rows and
                  the add row just fill the right side with solid green. */}
              {(() => {
                const pLen = personalAssets.length;
                const rows = [];

                if (pLen === 0) {
                  // No personal assets yet — render ONE combined row: add
                  // button on the left, netWorth block on the right.
                  rows.push(
                    <tr key="p-add" className="bg-white">
                      {addBtnCell(
                        "เพิ่มสินทรัพย์ใช้ส่วนตัว",
                        () => onAddAsset("personal"),
                        "asset",
                        true,
                      )}
                      <td
                        className={`px-3 py-2 text-xs font-bold text-white ${greenBg} align-middle`}
                      >
                        ความมั่งคั่งสุทธิ
                      </td>
                      <td
                        className={`px-3 py-2 text-xs font-bold text-right text-white ${greenBg} align-middle`}
                      >
                        {fmt(netWorth)}
                      </td>
                      <td
                        className={`px-3 py-2 text-xs font-bold text-right text-white ${greenBg} align-middle`}
                      >
                        {pct(netWorth, totalAssets)}
                      </td>
                    </tr>,
                  );
                  return rows;
                }

                // rowSpan here only covers the asset rows — the add row
                // below gets its own green filler cells.
                for (let i = 0; i < pLen; i++) {
                  const asset = personalAssets[i];
                  rows.push(
                    <tr key={`p-${i}`} className="bg-white">
                      <td className={itemSticky}>
                        <EditableName
                          name={asset.name}
                          onCommit={(next) => onUpdateName(asset.id, next)}
                          onRemove={() => onRemoveItem(asset.id)}
                        />
                      </td>
                      {valTd(asset.id, asset.name, asset.value)}
                      {pctTd(asset.value)}
                      {i === 0 ? (
                        <>
                          <td
                            className={`px-3 py-2 text-xs font-bold text-white ${greenBg} align-middle`}
                            rowSpan={pLen}
                          >
                            ความมั่งคั่งสุทธิ
                          </td>
                          <td
                            className={`px-3 py-2 text-xs font-bold text-right text-white ${greenBg} align-middle`}
                            rowSpan={pLen}
                          >
                            {fmt(netWorth)}
                          </td>
                          <td
                            className={`px-3 py-2 text-xs font-bold text-right text-white ${greenBg} align-middle`}
                            rowSpan={pLen}
                          >
                            {pct(netWorth, totalAssets)}
                          </td>
                        </>
                      ) : null}
                    </tr>,
                  );
                }

                // Add row — add button on left; solid green filler on right
                // so the netWorth block visually continues down to the
                // subtotal boundary with no white gap.
                rows.push(
                  <tr key="p-add" className="bg-white">
                    {addBtnCell(
                      "เพิ่มสินทรัพย์ใช้ส่วนตัว",
                      () => onAddAsset("personal"),
                      "asset",
                      true,
                    )}
                    <td className={`${greenBg}`} />
                    <td className={`${greenBg}`} />
                    <td className={`${greenBg}`} />
                  </tr>,
                );
                return rows;
              })()}

              {/* Subtotal: personal */}
              <tr className="bg-white">
                <td
                  className={`${subtotalL} ${stickyCol} bg-white whitespace-nowrap`}
                >
                  รวมสินทรัพย์ใช้ส่วนตัว
                </td>
                <td className={subtotalV}>{fmt(personalTotal)}</td>
                <td className={subtotalV}>{pct(personalTotal, totalAssets)}</td>
                <td className={subtotalL} />
                <td className={subtotalV} />
                <td className={subtotalV} />
              </tr>

              {/* Grand Total */}
              <tr className={darkBlue}>
                <td
                  className={`${hWhite} ${stickyCol} bg-[#1e3a5f] whitespace-nowrap`}
                >
                  สินทรัพย์รวม
                </td>
                <td className={`${hWhite} text-right`}>{fmt(totalAssets)}</td>
                <td className={`${hWhite} text-right`}>100.0%</td>
                <td className={`${hWhite} bg-[#9b2c2c]`}>
                  หนี้สินและความมั่งคั่งสุทธิ
                </td>
                <td className={`${hWhite} text-right bg-[#9b2c2c]`}>
                  {fmt(totalLiabilities + netWorth)}
                </td>
                <td className={`${hWhite} text-right bg-[#9b2c2c]`}>100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Cell Popup */}
      {editCell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setEditCell(null)}
        >
          <div
            className="glass rounded-2xl p-5 mx-6 w-full max-w-xs md:max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-bold text-gray-700 mb-3">
              {editCell.name}
            </div>
            <MoneyInput
              value={editValue}
              onChange={setEditValue}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEditSave();
                if (e.key === "Escape") setEditCell(null);
              }}
              className="w-full text-center text-lg font-bold bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 transition"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditCell(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleEditSave}
                className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-dark)] transition"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
