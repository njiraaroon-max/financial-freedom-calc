// ─── "ดึงจากกรมธรรม์ Allianz" modal for Pillar-2 ────────────────────────────
// Lets the user turn their already-stored Allianz health policies into the
// age-banded `premiumBrackets` that Pillar-2 needs for NPV projection.
//
// UX:
//   • Lists every priceable Allianz health rider (IPD/OPD/Dental/CI) on file
//   • Checkbox per policy (default: all selected)
//   • Age range (currentAge → max coverageEndAge across selected, capped 99)
//   • Bracket width dropdown (3 / 5 / 10 years, default 5)
//   • Occupation-class picker inside the modal (1-4, default 1).  We keep
//     occupation local here — user said not to promote it to profile.
//   • Live preview table showing `ageFrom-ageTo: baht/year`
//   • Actions: แทนที่ทั้งหมด | รวมกับของเดิม | ยกเลิก
"use client";

import React, { useMemo, useState } from "react";
import { X, Package } from "lucide-react";
import type { InsurancePolicy, PremiumBracket } from "@/store/insurance-store";
import type { Gender, OccClass } from "@/lib/allianz/types";
import {
  isPriceableAllianzHealthPolicy,
  computeBracketsFromPolicies,
} from "@/lib/allianz/policyPricing";
import { getProductByCode } from "@/lib/allianz/data";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Full policy list from the insurance store. */
  policies: InsurancePolicy[];
  /** Subject's current age — lower bound for projection. */
  currentAge: number;
  /** Gender from profile (used by the Allianz rate tables). */
  gender: Gender;
  /** Existing brackets in Pillar-2 state (used for "รวมกับของเดิม"). */
  existingBrackets: PremiumBracket[];
  /** Called when the user commits.  `mode` picks replace vs. merge semantics. */
  onCommit: (brackets: PremiumBracket[], mode: "replace" | "merge") => void;
}

const BAND_OPTIONS = [3, 5, 10];

const OCC_OPTIONS: { value: OccClass; label: string; desc: string }[] = [
  { value: 1, label: "ชั้น 1", desc: "พนักงานออฟฟิศ" },
  { value: 2, label: "ชั้น 2", desc: "งานนอกสถานที่เล็กน้อย" },
  { value: 3, label: "ชั้น 3", desc: "งานใช้แรงงาน" },
  { value: 4, label: "ชั้น 4", desc: "งานเสี่ยงสูง" },
];

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

/** Build a human-readable label for one policy card row. */
function policyLabel(p: InsurancePolicy): { title: string; sub: string } {
  const product = p.productCode ? getProductByCode(p.productCode) : undefined;
  const title = product?.name_th ?? p.planName ?? p.productCode ?? "Allianz policy";
  const parts: string[] = [];
  if (p.planCode) parts.push(p.planCode);
  if (p.sumInsured > 0) parts.push(`SA ${fmt(p.sumInsured)}`);
  if (p.dailyBenefit && p.dailyBenefit > 0) parts.push(`HB ${fmt(p.dailyBenefit)}/วัน`);
  if (p.coverageEndAge > 0) parts.push(`ถึงอายุ ${p.coverageEndAge}`);
  return { title, sub: parts.join(" · ") };
}

/** Merge two bracket lists by (ageFrom, ageTo): same band ⇒ sum premiums;
 *  otherwise keep both.  Sorts the result by ageFrom for sanity. */
function mergeBrackets(
  existing: PremiumBracket[],
  incoming: PremiumBracket[],
): PremiumBracket[] {
  const keyOf = (b: PremiumBracket) => `${b.ageFrom}-${b.ageTo}`;
  const byKey = new Map<string, PremiumBracket>();
  for (const b of existing) byKey.set(keyOf(b), { ...b });
  for (const b of incoming) {
    const k = keyOf(b);
    const prev = byKey.get(k);
    if (prev) byKey.set(k, { ...prev, annualPremium: prev.annualPremium + b.annualPremium });
    else byKey.set(k, { ...b });
  }
  return [...byKey.values()].sort((a, b) => a.ageFrom - b.ageFrom);
}

export default function ImportFromPoliciesModal({
  open,
  onClose,
  policies,
  currentAge,
  gender,
  existingBrackets,
  onCommit,
}: Props) {
  // ─── Filter down to what we can actually price ──────────────────────────
  const priceable = useMemo(
    () => policies.filter(isPriceableAllianzHealthPolicy),
    [policies],
  );

  // ─── Selection state (default: all selected) ────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(priceable.map((p) => p.id)),
  );

  // Re-sync selection when the priceable list changes (e.g. store re-hydration).
  React.useEffect(() => {
    if (!open) return;
    setSelectedIds((prev) => {
      const next = new Set<string>();
      let changed = false;
      for (const p of priceable) {
        if (prev.has(p.id)) next.add(p.id);
      }
      // If `prev` had ids that aren't priceable anymore, drop them (changed).
      if (next.size !== prev.size) changed = true;
      // If this is the first time after opening, default-select all.
      if (prev.size === 0 && priceable.length > 0) {
        priceable.forEach((p) => next.add(p.id));
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [open, priceable]);

  // ─── Config state ───────────────────────────────────────────────────────
  const selected = priceable.filter((p) => selectedIds.has(p.id));
  const maxCoverageAge = selected.reduce(
    (m, p) => (p.coverageEndAge > m ? p.coverageEndAge : m),
    0,
  );
  const defaultAgeTo = Math.min(maxCoverageAge > 0 ? maxCoverageAge : 85, 99);

  const [ageFrom, setAgeFrom] = useState<number>(currentAge);
  const [ageTo, setAgeTo] = useState<number>(defaultAgeTo);
  const [bandWidth, setBandWidth] = useState<number>(5);
  const [occClass, setOccClass] = useState<OccClass>(1);

  // Whenever selected policies change, bump ageTo upwards to cover them all
  // (but don't clobber user-shrunk ranges).
  React.useEffect(() => {
    if (!open) return;
    setAgeTo((prev) => (defaultAgeTo > prev ? defaultAgeTo : prev));
  }, [defaultAgeTo, open]);

  // ─── Preview: run the pricer ────────────────────────────────────────────
  const preview = useMemo(() => {
    if (selected.length === 0 || ageTo < ageFrom) {
      return { brackets: [] as PremiumBracket[], byAge: {} as Record<number, { total: number }> };
    }
    const { brackets, byAge } = computeBracketsFromPolicies({
      policies: selected,
      currentAge,
      ageFrom,
      ageTo,
      bandWidth,
      gender,
      occClass,
    });
    return { brackets, byAge };
  }, [selected, ageFrom, ageTo, bandWidth, gender, occClass, currentAge]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReplace = () => {
    onCommit(preview.brackets, "replace");
    onClose();
  };

  const handleMerge = () => {
    onCommit(mergeBrackets(existingBrackets, preview.brackets), "merge");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4">
      <div className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl md:rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-teal-600" />
            <h2 className="text-sm font-bold text-gray-800">ดึงจากกรมธรรม์ Allianz</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
          {priceable.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-sm text-gray-500 mb-2">
                ยังไม่พบกรมธรรม์สุขภาพ Allianz ที่ผูกกับรหัสสินค้าในระบบ
              </div>
              <div className="text-[13px] text-gray-400">
                นำเข้ากรมธรรม์ Allianz จากหน้า "คำนวณเบี้ยจริง Allianz" แล้วกลับมาลองอีกครั้ง
              </div>
            </div>
          ) : (
            <>
              {/* Policy checkboxes */}
              <div className="space-y-2">
                <div className="text-[13px] font-bold text-gray-600 mb-1">
                  เลือกกรมธรรม์ที่ต้องการรวม ({selected.length}/{priceable.length})
                </div>
                {priceable.map((p) => {
                  const { title, sub } = policyLabel(p);
                  const checked = selectedIds.has(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        checked
                          ? "border-teal-300 bg-teal-50/60"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(p.id)}
                        className="mt-0.5 w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-gray-800 truncate">{title}</div>
                        {sub && <div className="text-[12px] text-gray-500 truncate">{sub}</div>}
                      </div>
                      <div className="text-[12px] text-gray-500 shrink-0">
                        ปัจจุบัน {fmt(p.premium)}/ปี
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Config row */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-3 border border-gray-100">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[12px] text-gray-500 font-semibold block mb-1">
                      ช่วงอายุเริ่ม
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={ageFrom}
                      onChange={(e) => setAgeFrom(parseInt(e.target.value) || currentAge)}
                      className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] text-gray-500 font-semibold block mb-1">
                      ถึงอายุ
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={ageTo}
                      onChange={(e) => setAgeTo(parseInt(e.target.value) || defaultAgeTo)}
                      className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[12px] text-gray-500 font-semibold block mb-1">
                    ขนาดช่วง (ปี)
                  </label>
                  <div className="flex gap-2">
                    {BAND_OPTIONS.map((w) => (
                      <button
                        key={w}
                        onClick={() => setBandWidth(w)}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition ${
                          bandWidth === w
                            ? "bg-teal-500 text-white shadow"
                            : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {w} ปี
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[12px] text-gray-500 font-semibold block mb-1">
                    อาชีพ (Occupation class)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {OCC_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setOccClass(opt.value)}
                        title={opt.desc}
                        className={`px-2 py-2 rounded-lg text-[12px] font-bold transition ${
                          occClass === opt.value
                            ? "bg-teal-500 text-white shadow"
                            : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-gray-400">
                  ใช้เพศ <b>{gender === "M" ? "ชาย" : "หญิง"}</b> จากข้อมูลส่วนตัว —
                  เปลี่ยนได้ที่หน้า Personal Info
                </div>
              </div>

              {/* Preview */}
              <div>
                <div className="text-[13px] font-bold text-gray-600 mb-2">
                  ตัวอย่างผลลัพธ์ ({preview.brackets.length} ช่วง)
                </div>
                {preview.brackets.length === 0 ? (
                  <div className="text-[12px] text-gray-400 py-4 text-center">
                    ไม่มีข้อมูลในช่วงนี้ — ลองขยายช่วงอายุ หรือเลือกกรมธรรม์เพิ่ม
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-[12px]">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold">ช่วงอายุ</th>
                          <th className="text-right px-3 py-2 font-semibold">เบี้ยประกัน/ปี (เฉลี่ย)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.brackets.map((b, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                            <td className="px-3 py-1.5 text-gray-700">
                              {b.ageFrom}–{b.ageTo}
                            </td>
                            <td className="px-3 py-1.5 text-right font-bold text-gray-800">
                              {fmt(b.annualPremium)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 md:p-5 border-t border-gray-100 flex items-center gap-2 bg-white rounded-b-3xl md:rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-[13px] font-bold hover:bg-gray-200 transition"
          >
            ยกเลิก
          </button>
          <div className="flex-1" />
          <button
            onClick={handleMerge}
            disabled={preview.brackets.length === 0}
            className="px-4 py-2.5 rounded-xl bg-white border border-teal-300 text-teal-700 text-[13px] font-bold hover:bg-teal-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            รวมกับของเดิม
          </button>
          <button
            onClick={handleReplace}
            disabled={preview.brackets.length === 0}
            className="px-4 py-2.5 rounded-xl bg-teal-500 text-white text-[13px] font-bold hover:bg-teal-600 transition disabled:opacity-40 disabled:cursor-not-allowed shadow"
          >
            แทนที่ทั้งหมด
          </button>
        </div>
      </div>
    </div>
  );
}
