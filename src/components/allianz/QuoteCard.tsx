"use client";

// ─── AllianzQuoteCard ──────────────────────────────────────────────────────
// Takes a sum-assured target (typically the Pillar-1 coverage gap) and shows
// the real annual premium for 3 Allianz products, calculated from the bundled
// rate tables under src/data/allianz/output/.
//
// This is the first user-visible consumer of the calculator engine under
// src/lib/allianz/.

import { useMemo, useState } from "react";
import { calcMainPremium } from "@/lib/allianz/premium";
import { getProductByCode } from "@/lib/allianz/data";
import type { Gender } from "@/lib/allianz/types";

// ─── Quote presets ────────────────────────────────────────────────────────
interface Preset {
  productCode: string;
  planCode?: string;
  label: string;
  sub: string;
  premiumYears: number;
}

const PRESETS: Preset[] = [
  {
    productCode: "T1010",
    label: "Term 10 ปี",
    sub: "อยุธยาเฉพาะกาล 10/10",
    premiumYears: 10,
  },
  {
    productCode: "MWLA9021",
    label: "Whole Life A90/21",
    sub: "มาย โฮล ไลฟ์ A90/21",
    premiumYears: 21,
  },
  {
    productCode: "TM1",
    label: "Term ปีต่อปี",
    sub: "อยุธยาชั่วระยะเวลา",
    premiumYears: 1, // annual renewable
  },
];

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}

export interface AllianzQuoteCardProps {
  /** Target sum assured in baht. Typically the computed pillar-1 gap. */
  sumAssured: number;
  /** Current age of the policyholder (used for rate lookup). */
  currentAge: number;
  /** Optional initial gender. User can toggle in the card. */
  initialGender?: Gender;
}

export default function AllianzQuoteCard({
  sumAssured,
  currentAge,
  initialGender = "M",
}: AllianzQuoteCardProps) {
  const [gender, setGender] = useState<Gender>(initialGender);

  const quotes = useMemo(() => {
    if (sumAssured <= 0) return [];
    return PRESETS.map((p) => {
      const product = getProductByCode(p.productCode);
      const res = calcMainPremium(
        {
          productCode: p.productCode,
          planCode: p.planCode,
          sumAssured,
          premiumYears: p.premiumYears,
        },
        currentAge,
        gender,
        currentAge,
      );
      const totalOverTerm = res.premium * p.premiumYears;
      return {
        preset: p,
        productNameTh: product?.name_th ?? p.sub,
        premium: res.premium,
        warnings: res.warnings,
        totalOverTerm,
      };
    });
  }, [sumAssured, currentAge, gender]);

  if (sumAssured <= 0) return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-blue-100 bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#003781] to-[#1e3a5f] px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-white uppercase tracking-wide">
            เบี้ยจริงจาก Allianz
          </div>
          <div className="text-[13px] text-white/70 mt-0.5">
            ทุนประกัน {fmtShort(sumAssured)} บาท • อายุ {currentAge} ปี
          </div>
        </div>
        {/* Gender toggle */}
        <div className="flex bg-white/15 rounded-full p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setGender("M")}
            className={`px-3 py-1 rounded-full text-xs font-bold transition ${
              gender === "M" ? "bg-white text-[#003781]" : "text-white/80"
            }`}
          >
            ชาย
          </button>
          <button
            type="button"
            onClick={() => setGender("F")}
            className={`px-3 py-1 rounded-full text-xs font-bold transition ${
              gender === "F" ? "bg-white text-[#003781]" : "text-white/80"
            }`}
          >
            หญิง
          </button>
        </div>
      </div>

      {/* Quote list */}
      <div className="divide-y divide-gray-100">
        {quotes.map((q) => {
          const hasWarning = q.warnings.length > 0 || q.premium === 0;
          return (
            <div key={q.preset.productCode} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-800 truncate">
                    {q.preset.label}
                  </div>
                  <div className="text-[13px] text-gray-400 truncate">
                    {q.preset.sub}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {hasWarning ? (
                    <div className="text-[13px] text-gray-400">ไม่มีข้อมูล</div>
                  ) : (
                    <>
                      <div className="text-base font-extrabold text-[#003781]">
                        {fmt(q.premium)}
                      </div>
                      <div className="text-[13px] text-gray-400">บาท/ปี</div>
                    </>
                  )}
                </div>
              </div>
              {!hasWarning && q.preset.premiumYears > 1 && (
                <div className="mt-1.5 flex items-center justify-between text-[13px] text-gray-500">
                  <span>จ่าย {q.preset.premiumYears} ปี</span>
                  <span>
                    รวมทั้งหมด{" "}
                    <span className="font-bold text-gray-700">
                      {fmtShort(q.totalOverTerm)}
                    </span>
                  </span>
                </div>
              )}
              {hasWarning && q.warnings[0] && (
                <div className="mt-1 text-[13px] text-amber-600">
                  {q.warnings[0]}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footnote */}
      <div className="bg-gray-50 px-4 py-2 text-[13px] text-gray-400 leading-relaxed">
        คำนวณจากตารางเบี้ยจริงของ Allianz Ayudhya (ข้อมูล ณ เม.ย. 2026)
        ตัวเลขเป็นประมาณการก่อนพิจารณารับประกัน
      </div>
    </div>
  );
}
