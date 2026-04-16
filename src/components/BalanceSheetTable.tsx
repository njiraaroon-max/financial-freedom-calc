"use client";

import { useState } from "react";
import type { AssetItem, LiabilityItem } from "@/types/balance-sheet";
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
}

function fmt(n: number): string {
  if (n === 0) return "0";
  return n.toLocaleString("th-TH");
}

function pct(value: number, total: number): string {
  if (total === 0) return "0.0%";
  return ((value / total) * 100).toFixed(1) + "%";
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
}: BalanceSheetTableProps) {
  const [editCell, setEditCell] = useState<{
    id: string;
    name: string;
    value: number;
  } | null>(null);
  const [editValue, setEditValue] = useState(0);

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

  const liquidAssets = assets.filter((a) => a.assetType === "liquid");
  const investmentAssets = assets.filter((a) => a.assetType === "investment");
  const personalAssets = assets.filter((a) => a.assetType === "personal");
  const shortTermLiabilities = liabilities.filter((l) => l.liabilityType === "short_term");
  const longTermLiabilities = liabilities.filter((l) => l.liabilityType === "long_term");

  // Styles — same tones as Cash Flow annual table
  const darkBlue = "bg-[#1e3a5f]";       // header (same as CF)
  const subHeader = "bg-[#2c5282]";      // sub-header (same as CF income header)
  const darkRed = "bg-[#c53030]";        // expense header (same as CF)
  const subRed = "bg-[#ef9a9a]";         // sub expense (same as CF)
  const netRow = "bg-[#1a365d]";         // net cashflow row (same as CF)
  const greenBg = "bg-[#276749]";        // green for net worth
  const hWhite = "px-3 py-2 text-xs font-bold text-white";
  const stickyCol = "sticky left-0 z-10";  // first column stays fixed
  const item = "px-3 py-1.5 text-xs border-b border-gray-100";
  const itemSticky = `${item} ${stickyCol} bg-white whitespace-nowrap`;
  const val = "px-3 py-1.5 text-xs text-right border-b border-gray-100";
  const valClick = "cursor-pointer hover:bg-indigo-50 active:bg-indigo-100 transition";
  const subtotalL = "px-3 py-1.5 text-xs font-bold border-b border-gray-200";
  const subtotalV = "px-3 py-1.5 text-xs font-bold text-right border-b border-gray-200";
  const pinkBg = "bg-red-50";

  // Render clickable value cell
  const valTd = (id: string, name: string, value: number) => (
    <td className={`${val} ${valClick}`} onClick={() => openEdit(id, name, value)}>
      {fmt(value)}
    </td>
  );

  // Render percentage cell
  const pctTd = (value: number) => (
    <td className={`${val} text-gray-400`}>{pct(value, totalAssets)}</td>
  );

  // Empty 3 cells
  const empty3 = <><td className={item} /><td className={val} /><td className={val} /></>;

  // Paired rows helper
  const pairedRows = (
    leftItems: AssetItem[],
    rightItems: LiabilityItem[],
    keyPrefix: string,
  ) => {
    const maxLen = Math.max(leftItems.length, rightItems.length, 1);
    const rows = [];
    for (let i = 0; i < maxLen; i++) {
      const a = leftItems[i];
      const l = rightItems[i];
      rows.push(
        <tr key={`${keyPrefix}-${i}`} className="bg-white">
          {a ? (
            <><td className={itemSticky}>{a.name}</td>{valTd(a.id, a.name, a.value)}{pctTd(a.value)}</>
          ) : <><td className={itemSticky} /><td className={val} /><td className={val} /></>}
          {l ? (
            <><td className={item}>{l.name}</td>{valTd(l.id, l.name, l.value)}{pctTd(l.value)}</>
          ) : empty3}
        </tr>
      );
    }
    return rows;
  };

  return (
    <div className="mx-2 mb-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs md:text-sm" style={{ minWidth: 680 }}>
          <thead>
            <tr className={darkBlue}>
              <th className={`${hWhite} text-left ${stickyCol} bg-[#1e3a5f]`} style={{ minWidth: 170 }}>สินทรัพย์</th>
              <th className={`${hWhite} text-right`} style={{ minWidth: 90 }}></th>
              <th className={`${hWhite} text-right`} style={{ minWidth: 50 }}>%</th>
              <th className={`${hWhite} text-left bg-[#9b2c2c]`} style={{ minWidth: 170 }}>หนี้สินและความมั่งคั่งสุทธิ</th>
              <th className={`${hWhite} text-right bg-[#9b2c2c]`} style={{ minWidth: 90 }}></th>
              <th className={`${hWhite} text-right bg-[#9b2c2c]`} style={{ minWidth: 50 }}>%</th>
            </tr>
          </thead>
          <tbody>
            {/* === สินทรัพย์สภาพคล่อง | หนี้สินระยะสั้น === */}
            <tr className={subHeader}>
              <td className={`${hWhite} ${stickyCol} bg-[#2c5282] whitespace-nowrap`}>สินทรัพย์สภาพคล่อง (Liquid Asset)</td>
              <td colSpan={2} className={`${hWhite}`}></td>
              <td colSpan={3} className={`${hWhite} bg-[#c53030]`}>หนี้สินระยะสั้น (Short-term Liabilities)</td>
            </tr>

            {pairedRows(liquidAssets, shortTermLiabilities, "ls")}

            {/* Subtotal */}
            <tr className="bg-white">
              <td className={`${subtotalL} ${stickyCol} bg-white whitespace-nowrap`}>รวมสินทรัพย์สภาพคล่อง</td>
              <td className={subtotalV}>{fmt(liquidTotal)}</td>
              <td className={subtotalV}>{pct(liquidTotal, totalAssets)}</td>
              <td className={`${subtotalL} ${pinkBg}`}>รวมหนี้สินระยะสั้น</td>
              <td className={`${subtotalV} ${pinkBg}`}>{fmt(shortTermTotal)}</td>
              <td className={`${subtotalV} ${pinkBg}`}>{pct(shortTermTotal, totalAssets)}</td>
            </tr>

            {/* === สินทรัพย์เพื่อการลงทุน | หนี้สินระยะยาว === */}
            <tr className={subHeader}>
              <td className={`${hWhite} ${stickyCol} bg-[#2c5282] whitespace-nowrap`}>สินทรัพย์ลงทุน (Investment Asset)</td>
              <td colSpan={2} className={`${hWhite}`}></td>
              <td colSpan={3} className={`${hWhite} bg-[#c53030]`}>หนี้สินระยะยาว (Long-term Liabilities)</td>
            </tr>

            {pairedRows(investmentAssets, longTermLiabilities, "il")}

            {/* Subtotal */}
            <tr className="bg-white">
              <td className={`${subtotalL} ${stickyCol} bg-white whitespace-nowrap`}>รวมสินทรัพย์เพื่อการลงทุน</td>
              <td className={subtotalV}>{fmt(investmentTotal)}</td>
              <td className={subtotalV}>{pct(investmentTotal, totalAssets)}</td>
              <td className={`${subtotalL} ${pinkBg}`}>รวมหนี้สินระยะยาว</td>
              <td className={`${subtotalV} ${pinkBg}`}>{fmt(longTermTotal)}</td>
              <td className={`${subtotalV} ${pinkBg}`}>{pct(longTermTotal, totalAssets)}</td>
            </tr>

            {/* === สินทรัพย์ใช้ส่วนตัว | รวมหนี้สิน === */}
            <tr className={subHeader}>
              <td className={`${hWhite} ${stickyCol} bg-[#2c5282] whitespace-nowrap`}>สินทรัพย์ใช้ส่วนตัว (Personal Asset)</td>
              <td colSpan={2} className={`${hWhite}`}></td>
              <td className={`${hWhite} ${darkRed}`}>รวมหนี้สิน</td>
              <td className={`${hWhite} text-right ${darkRed}`}>{fmt(totalLiabilities)}</td>
              <td className={`${hWhite} text-right ${darkRed}`}>{pct(totalLiabilities, totalAssets)}</td>
            </tr>

            {/* Personal assets + ความมั่งคั่งสุทธิ (rowSpan) */}
            {(() => {
              const pLen = Math.max(personalAssets.length, 1);
              const rows = [];
              for (let i = 0; i < pLen; i++) {
                const asset = personalAssets[i];
                rows.push(
                  <tr key={`p-${i}`} className="bg-white">
                    {asset ? (
                      <><td className={itemSticky}>{asset.name}</td>{valTd(asset.id, asset.name, asset.value)}{pctTd(asset.value)}</>
                    ) : (
                      <><td className={itemSticky} /><td className={val} /><td className={val} /></>
                    )}
                    {i === 0 ? (
                      <>
                        <td className={`px-3 py-2 text-xs font-bold text-white ${greenBg} align-middle`} rowSpan={pLen}>
                          ความมั่งคั่งสุทธิ
                        </td>
                        <td className={`px-3 py-2 text-xs font-bold text-right text-white ${greenBg} align-middle`} rowSpan={pLen}>
                          {fmt(netWorth)}
                        </td>
                        <td className={`px-3 py-2 text-xs font-bold text-right text-white ${greenBg} align-middle`} rowSpan={pLen}>
                          {pct(netWorth, totalAssets)}
                        </td>
                      </>
                    ) : null}
                  </tr>
                );
              }
              return rows;
            })()}

            {/* Subtotal: personal */}
            <tr className="bg-white">
              <td className={`${subtotalL} ${stickyCol} bg-white whitespace-nowrap`}>รวมสินทรัพย์ใช้ส่วนตัว</td>
              <td className={subtotalV}>{fmt(personalTotal)}</td>
              <td className={subtotalV}>{pct(personalTotal, totalAssets)}</td>
              <td className={subtotalL} /><td className={subtotalV} /><td className={subtotalV} />
            </tr>

            {/* Grand Total */}
            <tr className={darkBlue}>
              <td className={`${hWhite} ${stickyCol} bg-[#1e3a5f] whitespace-nowrap`}>สินทรัพย์รวม</td>
              <td className={`${hWhite} text-right`}>{fmt(totalAssets)}</td>
              <td className={`${hWhite} text-right`}>100.0%</td>
              <td className={`${hWhite} bg-[#9b2c2c]`}>หนี้สินและความมั่งคั่งสุทธิ</td>
              <td className={`${hWhite} text-right bg-[#9b2c2c]`}>{fmt(totalLiabilities + netWorth)}</td>
              <td className={`${hWhite} text-right bg-[#9b2c2c]`}>100.0%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Edit Cell Popup */}
      {editCell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setEditCell(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-5 mx-6 w-full max-w-xs md:max-w-sm"
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
