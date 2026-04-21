"use client";

// ─── AllianzQuoteCard ──────────────────────────────────────────────────────
// Takes a sum-assured target (typically the Pillar-1 coverage gap) and shows
// the real annual premium for a handful of Allianz presets, calculated from
// the bundled rate tables under src/data/allianz/output/.
//
// Two modes:
//   • แนะนำ (preset)   — each preset priced at the full gap; pick one.
//   • จัดเอง (portfolio) — custom sum-assured per preset with running total
//                        vs gap, per-main rider config, one-click import of
//                        the whole basket.

import { useMemo, useState } from "react";
import { ChevronDown, Plus, Check, Briefcase, Wand2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { calcMainPremium, calcRiderPremium } from "@/lib/allianz/premium";
import { calculateCashflow } from "@/lib/allianz/cashflow";
import { getProductByCode } from "@/lib/allianz/data";
import { buildPolicyFromQuote } from "@/lib/allianz/toPolicy";
import type { Gender, OccClass, CalcRiderInput } from "@/lib/allianz/types";
import { useInsuranceStore } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";

// ─── Quote presets ────────────────────────────────────────────────────────
interface Preset {
  productCode: string;
  planCode?: string;
  label: string;
  sub: string;
  premiumYears: number;
  /** Coverage age (for imported policy). Defaults handled in toPolicy. */
  coverageEndAge?: number;
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
    coverageEndAge: 90,
  },
  {
    productCode: "MWLA9906",
    label: "Wealth Legacy A99/6",
    sub: "มาย เวลท์ เลกาซี A99/6 (มีเงินปันผล)",
    premiumYears: 6,
    coverageEndAge: 99,
  },
  {
    productCode: "MWLA9920",
    label: "Whole Life A99/20",
    sub: "มาย โฮล ไลฟ์ A99/20 (มีเงินปันผล)",
    premiumYears: 20,
    coverageEndAge: 99,
  },
  {
    productCode: "TM1",
    label: "Term ปีต่อปี",
    sub: "อยุธยาชั่วระยะเวลา",
    premiumYears: 1,
  },
  {
    productCode: "SLA85",
    planCode: "A85/20",
    label: "ชีวิตมั่นคง A85/20",
    sub: "อยุธยาชีวิตมั่นคง A85/20 (จ่าย 20 ปี คุ้มครองถึง 85)",
    premiumYears: 20,
    coverageEndAge: 85,
  },
];

// ─── Rider presets ────────────────────────────────────────────────────────
const HB_OPTIONS = [1000, 2000, 3000, 4000, 5000];
const CI_OPTIONS = [500_000, 1_000_000, 2_000_000, 3_000_000];
const OCC_OPTIONS: { value: OccClass; label: string }[] = [
  { value: 1, label: "ระดับ 1-2" },
  { value: 3, label: "ระดับ 3" },
  { value: 4, label: "ระดับ 4" },
];

// ─── Colours (match recharts cashflow chart) ──────────────────────────────
const COLOR_MAIN = "#003781";
const COLOR_HB = "#0891b2";
const COLOR_CI = "#dc2626";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}

export interface AllianzQuoteCardProps {
  sumAssured: number;
  currentAge: number;
  initialGender?: Gender;
}

type Mode = "preset" | "portfolio";

interface Allocation {
  sumAssured: number;
  hbBenefit: number;
  ciSum: number;
  occClass: OccClass;
  ridersOpen: boolean;
}

function emptyAllocations(): Record<string, Allocation> {
  const out: Record<string, Allocation> = {};
  for (const p of PRESETS) {
    out[p.productCode] = {
      sumAssured: 0,
      hbBenefit: 0,
      ciSum: 0,
      occClass: 1,
      ridersOpen: false,
    };
  }
  return out;
}

export default function AllianzQuoteCard({
  sumAssured,
  currentAge,
  initialGender,
}: AllianzQuoteCardProps) {
  const [mode, setMode] = useState<Mode>("preset");
  // Gender: prop (if provided) > profile store > "M" default.  Clicking the
  // toggle writes through to the profile so every other page picks it up.
  const profileGender = useProfileStore((s) => s.gender);
  const setProfileGender = useProfileStore((s) => s.updateProfile);
  const gender: Gender = initialGender ?? profileGender;
  const setGender = (g: Gender) => setProfileGender("gender", g);

  // Preset-mode shared state
  const [occClass, setOccClass] = useState<OccClass>(1);
  const [hbBenefit, setHbBenefit] = useState<number>(0);
  const [ciSum, setCiSum] = useState<number>(0);
  const [expandedPreset, setExpandedPreset] = useState<string | null>(null);
  const [ridersOpen, setRidersOpen] = useState<boolean>(false);
  const [justImported, setJustImported] = useState<string | null>(null);

  // Portfolio-mode per-row state
  const [allocations, setAllocations] = useState<Record<string, Allocation>>(
    () => emptyAllocations(),
  );
  const [portfolioImported, setPortfolioImported] = useState<boolean>(false);

  const addPolicy = useInsuranceStore((s) => s.addPolicy);

  const activeRiders: CalcRiderInput[] = useMemo(() => {
    const list: CalcRiderInput[] = [];
    if (hbBenefit > 0) list.push({ productCode: "HB", dailyBenefit: hbBenefit });
    if (ciSum > 0) list.push({ productCode: "CI48", sumAssured: ciSum });
    return list;
  }, [hbBenefit, ciSum]);

  // ─── Preset-mode quotes (main + riders at currentAge) ────────────────────
  const quotes = useMemo(() => {
    if (sumAssured <= 0) return [];
    return PRESETS.map((p) => {
      const product = getProductByCode(p.productCode);
      const mainRes = calcMainPremium(
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
      const riders = activeRiders.map((r) => {
        const res = calcRiderPremium(r, currentAge, gender, occClass, currentAge);
        return { code: r.productCode, premium: res.premium, warnings: res.warnings };
      });
      const ridersTotal = riders.reduce((s, r) => s + r.premium, 0);
      return {
        preset: p,
        productNameTh: product?.name_th ?? p.sub,
        mainPremium: mainRes.premium,
        mainWarnings: mainRes.warnings,
        riders,
        ridersTotal,
        total: mainRes.premium + ridersTotal,
      };
    });
  }, [sumAssured, currentAge, gender, occClass, activeRiders]);

  // ─── Preset-mode cashflow chart ──────────────────────────────────────────
  const expandedCashflow = useMemo(() => {
    if (!expandedPreset) return null;
    const preset = PRESETS.find((p) => p.productCode === expandedPreset);
    if (!preset) return null;
    const out = calculateCashflow({
      currentAge,
      retireAge: Math.max(currentAge + preset.premiumYears, 60),
      gender,
      occupationClass: occClass,
      main: {
        productCode: preset.productCode,
        planCode: preset.planCode,
        sumAssured,
        premiumYears: preset.premiumYears,
      },
      riders: activeRiders,
    });
    const data = out.cashflow
      .filter((y) => y.totalPremium > 0)
      .map((y) => {
        const row: Record<string, number> = { age: y.age, main: y.mainPremium };
        for (const r of y.ridersPremium) row[r.code] = r.premium;
        row.total = y.totalPremium;
        return row;
      });
    return { data, summary: out.summary };
  }, [expandedPreset, currentAge, gender, occClass, sumAssured, activeRiders]);

  // ─── Portfolio quotes (per-allocation pricing) ───────────────────────────
  const portfolioQuotes = useMemo(() => {
    return PRESETS.map((p) => {
      const a = allocations[p.productCode];
      if (!a || a.sumAssured <= 0) {
        return {
          preset: p,
          allocation: a,
          mainPremium: 0,
          riders: [] as { code: string; premium: number }[],
          totalPerYear: 0,
          totalAllYears: 0,
        };
      }
      const mainRes = calcMainPremium(
        {
          productCode: p.productCode,
          planCode: p.planCode,
          sumAssured: a.sumAssured,
          premiumYears: p.premiumYears,
        },
        currentAge,
        gender,
        currentAge,
      );
      const riders: { code: string; premium: number }[] = [];
      if (a.hbBenefit > 0) {
        const r = calcRiderPremium(
          { productCode: "HB", dailyBenefit: a.hbBenefit },
          currentAge,
          gender,
          a.occClass,
          currentAge,
        );
        riders.push({ code: "HB", premium: r.premium });
      }
      if (a.ciSum > 0) {
        const r = calcRiderPremium(
          { productCode: "CI48", sumAssured: a.ciSum },
          currentAge,
          gender,
          a.occClass,
          currentAge,
        );
        riders.push({ code: "CI48", premium: r.premium });
      }
      const ridersTotal = riders.reduce((s, r) => s + r.premium, 0);
      const totalPerYear = mainRes.premium + ridersTotal;
      const totalAllYears = totalPerYear * p.premiumYears;
      return {
        preset: p,
        allocation: a,
        mainPremium: mainRes.premium,
        riders,
        totalPerYear,
        totalAllYears,
      };
    });
  }, [allocations, currentAge, gender]);

  const portfolioSummary = useMemo(() => {
    let allocated = 0;
    let totalPerYear = 0;
    let totalAllYears = 0;
    let policyCount = 0;
    for (const q of portfolioQuotes) {
      if (q.allocation && q.allocation.sumAssured > 0) {
        allocated += q.allocation.sumAssured;
        totalPerYear += q.totalPerYear;
        totalAllYears += q.totalAllYears;
        policyCount += 1 + q.riders.length;
      }
    }
    const remaining = Math.max(0, sumAssured - allocated);
    const pct = sumAssured > 0 ? Math.min(100, (allocated / sumAssured) * 100) : 0;
    return { allocated, remaining, pct, totalPerYear, totalAllYears, policyCount };
  }, [portfolioQuotes, sumAssured]);

  // ─── Allocation mutators ─────────────────────────────────────────────────
  const setAllocField = <K extends keyof Allocation>(
    code: string,
    key: K,
    value: Allocation[K],
  ) => {
    setAllocations((prev) => ({
      ...prev,
      [code]: { ...prev[code], [key]: value },
    }));
    setPortfolioImported(false);
  };

  const fillRemaining = (code: string) => {
    const current = allocations[code]?.sumAssured ?? 0;
    const addable = portfolioSummary.remaining;
    setAllocField(code, "sumAssured", current + addable);
  };

  const clearAll = () => {
    setAllocations(emptyAllocations());
    setPortfolioImported(false);
  };

  // ─── Import handlers ─────────────────────────────────────────────────────
  const handleImportPreset = (presetCode: string) => {
    const q = quotes.find((x) => x.preset.productCode === presetCode);
    if (!q) return;

    const mainPayload = buildPolicyFromQuote({
      productCode: q.preset.productCode,
      planCode: q.preset.planCode,
      premium: q.mainPremium,
      sumInsured: sumAssured,
      premiumYears: q.preset.premiumYears,
      coverageEndAge: q.preset.coverageEndAge,
      currentAge,
    });
    if (mainPayload) addPolicy(mainPayload);

    for (const r of q.riders) {
      if (r.premium <= 0) continue;
      const isHb = r.code === "HB";
      const isCi = r.code === "CI48";
      const payload = buildPolicyFromQuote({
        productCode: r.code,
        premium: r.premium,
        sumInsured: 0,
        premiumYears: Math.min(q.preset.premiumYears, 70 - currentAge),
        currentAge,
        ...(isHb ? { dailyBenefit: hbBenefit } : {}),
        ...(isCi ? { ciLumpSum: ciSum } : {}),
      });
      if (payload) addPolicy(payload);
    }

    setJustImported(presetCode);
    setTimeout(() => setJustImported(null), 2500);
  };

  const handleImportPortfolio = () => {
    let added = 0;
    for (const q of portfolioQuotes) {
      const a = q.allocation;
      if (!a || a.sumAssured <= 0) continue;

      const mainPayload = buildPolicyFromQuote({
        productCode: q.preset.productCode,
        planCode: q.preset.planCode,
        premium: q.mainPremium,
        sumInsured: a.sumAssured,
        premiumYears: q.preset.premiumYears,
        coverageEndAge: q.preset.coverageEndAge,
        currentAge,
      });
      if (mainPayload) {
        addPolicy(mainPayload);
        added++;
      }

      for (const r of q.riders) {
        if (r.premium <= 0) continue;
        const isHb = r.code === "HB";
        const isCi = r.code === "CI48";
        const payload = buildPolicyFromQuote({
          productCode: r.code,
          premium: r.premium,
          sumInsured: 0,
          premiumYears: Math.min(q.preset.premiumYears, 70 - currentAge),
          currentAge,
          ...(isHb ? { dailyBenefit: a.hbBenefit } : {}),
          ...(isCi ? { ciLumpSum: a.ciSum } : {}),
        });
        if (payload) {
          addPolicy(payload);
          added++;
        }
      }
    }
    if (added > 0) {
      setPortfolioImported(true);
      setTimeout(() => setPortfolioImported(false), 3000);
    }
  };

  if (sumAssured <= 0) return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-blue-100 bg-white">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#003781] to-[#1e3a5f] px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-white uppercase tracking-wide">
            เบี้ยจริงจาก Allianz
          </div>
          <div className="text-[13px] text-white/70 mt-0.5">
            ทุนประกัน {fmtShort(sumAssured)} บาท • อายุ {currentAge} ปี
          </div>
        </div>
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

      {/* ─── Mode tabs ──────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={() => setMode("preset")}
          className={`flex-1 py-2.5 text-[13px] font-bold transition ${
            mode === "preset"
              ? "bg-white text-[#003781] border-b-2 border-[#003781]"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          แนะนำ
        </button>
        <button
          type="button"
          onClick={() => setMode("portfolio")}
          className={`flex-1 py-2.5 text-[13px] font-bold transition ${
            mode === "portfolio"
              ? "bg-white text-[#003781] border-b-2 border-[#003781]"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          จัดเอง
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PRESET MODE                                                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {mode === "preset" && (
        <>
          {/* Rider selector (shared across all presets) */}
          <div className="border-b border-gray-100">
            <button
              type="button"
              onClick={() => setRidersOpen((v) => !v)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left"
            >
              <span className="text-[13px] font-bold text-gray-700">
                เพิ่มความคุ้มครอง rider
                {activeRiders.length > 0 && (
                  <span className="ml-2 text-[11px] text-blue-600 font-bold">
                    ({activeRiders.length} เลือก)
                  </span>
                )}
              </span>
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform ${ridersOpen ? "rotate-180" : ""}`}
              />
            </button>

            {ridersOpen && (
              <div className="px-4 pb-3 space-y-3">
                <RiderPickerHB value={hbBenefit} onChange={setHbBenefit} />
                <RiderPickerCI value={ciSum} onChange={setCiSum} />
                {activeRiders.length > 0 && (
                  <OccPicker value={occClass} onChange={setOccClass} />
                )}
              </div>
            )}
          </div>

          {/* Quote rows */}
          <div className="divide-y divide-gray-100">
            {quotes.map((q) => {
              const presetCode = q.preset.productCode;
              const isExpanded = expandedPreset === presetCode;
              const isImported = justImported === presetCode;
              const hasData = q.mainPremium > 0;

              return (
                <div key={presetCode} className="p-3">
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
                      {hasData ? (
                        <>
                          <div className="text-base font-extrabold text-[#003781]">
                            {fmt(q.total)}
                          </div>
                          <div className="text-[13px] text-gray-400">บาท/ปี</div>
                        </>
                      ) : (
                        <div className="text-[13px] text-gray-400">ไม่มีข้อมูล</div>
                      )}
                    </div>
                  </div>

                  {hasData && activeRiders.length > 0 && (
                    <div className="mt-2 flex items-center justify-between text-[13px] text-gray-500 gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>
                          Main{" "}
                          <span className="font-bold text-gray-700">
                            {fmt(q.mainPremium)}
                          </span>
                        </span>
                        {q.riders.map((r) => (
                          <span key={r.code}>
                            {r.code}{" "}
                            <span className="font-bold text-gray-700">
                              {fmt(r.premium)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasData && q.preset.premiumYears > 1 && (
                    <div className="mt-1.5 flex items-center justify-between text-[13px] text-gray-500">
                      <span>จ่าย {q.preset.premiumYears} ปี</span>
                      <span>
                        รวมทั้งหมด{" "}
                        <span className="font-bold text-gray-700">
                          {fmtShort(q.total * q.preset.premiumYears)}
                        </span>
                      </span>
                    </div>
                  )}

                  {hasData && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleImportPreset(presetCode)}
                        disabled={isImported}
                        className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[13px] font-bold transition ${
                          isImported
                            ? "bg-emerald-500 text-white"
                            : "bg-[#003781] text-white hover:bg-[#1e3a5f] active:scale-[0.98]"
                        }`}
                      >
                        {isImported ? (
                          <>
                            <Check size={13} /> เพิ่มแล้ว
                          </>
                        ) : (
                          <>
                            <Plus size={13} /> เพิ่มในพอร์ต
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPreset(isExpanded ? null : presetCode)
                        }
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                      >
                        ดูรายปี
                        <ChevronDown
                          size={13}
                          className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>
                  )}

                  {isExpanded && expandedCashflow && expandedCashflow.data.length > 0 && (
                    <div className="mt-3 rounded-xl bg-gray-50 p-2 pt-3">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={expandedCashflow.data}
                          margin={{ top: 4, right: 8, left: -10, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                          <XAxis
                            dataKey="age"
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v: number) => fmtShort(v)}
                          />
                          <Tooltip
                            formatter={(v) => fmt(Number(v) || 0)}
                            labelFormatter={(age) => `อายุ ${age}`}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="main" name="Main" stackId="p" fill={COLOR_MAIN} />
                          {activeRiders.some((r) => r.productCode === "HB") && (
                            <Bar dataKey="HB" name="HB" stackId="p" fill={COLOR_HB} />
                          )}
                          {activeRiders.some((r) => r.productCode === "CI48") && (
                            <Bar
                              dataKey="CI48"
                              name="CI48"
                              stackId="p"
                              fill={COLOR_CI}
                            />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 px-2">
                        <span>
                          เบี้ยรวมตลอดสัญญา{" "}
                          <span className="font-bold text-gray-700">
                            {fmtShort(expandedCashflow.summary.totalPaid)}
                          </span>{" "}
                          บาท
                        </span>
                        <span>
                          จ่ายครั้งสุดท้ายอายุ {expandedCashflow.summary.lastPremiumAge}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PORTFOLIO MODE                                                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {mode === "portfolio" && (
        <>
          {/* Progress banner */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-b from-blue-50/60 to-white">
            {/* Hero: remaining / done */}
            <div className="flex items-end justify-between gap-3 mb-2">
              <div className="min-w-0">
                {portfolioSummary.remaining > 0 ? (
                  <>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-amber-600">
                      ยังขาดอีก
                    </div>
                    <div className="text-2xl font-extrabold text-amber-600 leading-tight">
                      {fmtShort(portfolioSummary.remaining)}
                      <span className="text-sm font-bold text-amber-500 ml-1">บาท</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">
                      ครบทุนแล้ว
                    </div>
                    <div className="text-2xl font-extrabold text-emerald-600 leading-tight">
                      ✓ {fmtShort(portfolioSummary.allocated)}
                      <span className="text-sm font-bold text-emerald-500 ml-1">บาท</span>
                    </div>
                  </>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] text-gray-400">
                  จัดสรรแล้ว
                </div>
                <div className="text-[13px] font-bold text-gray-700 tabular-nums">
                  {fmtShort(portfolioSummary.allocated)} / {fmtShort(sumAssured)}
                </div>
                <div className="text-[11px] text-gray-400">
                  {portfolioSummary.pct.toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  portfolioSummary.pct >= 100
                    ? "bg-emerald-500"
                    : portfolioSummary.pct >= 50
                      ? "bg-blue-500"
                      : "bg-amber-400"
                }`}
                style={{ width: `${portfolioSummary.pct}%` }}
              />
            </div>

            {portfolioSummary.allocated > 0 && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] text-gray-400 hover:text-gray-600 underline-offset-2 hover:underline"
                >
                  ล้างทั้งหมด
                </button>
              </div>
            )}
          </div>

          {/* Allocation rows */}
          <div className="divide-y divide-gray-100">
            {portfolioQuotes.map((q) => {
              const code = q.preset.productCode;
              const a = q.allocation;
              if (!a) return null;
              const hasAlloc = a.sumAssured > 0;
              const ridersCount = (a.hbBenefit > 0 ? 1 : 0) + (a.ciSum > 0 ? 1 : 0);

              return (
                <div key={code} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-gray-800 truncate">
                        {q.preset.label}
                      </div>
                      <div className="text-[13px] text-gray-400 truncate">
                        {q.preset.sub} · จ่าย {q.preset.premiumYears} ปี
                      </div>
                    </div>
                  </div>

                  {/* Sum-assured input */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 flex items-center rounded-lg border border-gray-200 focus-within:border-[#003781] focus-within:ring-2 focus-within:ring-blue-100 transition">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={a.sumAssured === 0 ? "" : fmt(a.sumAssured)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^\d]/g, "");
                          const n = digits === "" ? 0 : parseInt(digits, 10);
                          setAllocField(code, "sumAssured", Number.isFinite(n) ? n : 0);
                        }}
                        placeholder="ทุนประกัน"
                        className="flex-1 px-3 py-1.5 text-sm font-bold text-gray-800 placeholder:text-gray-300 bg-transparent outline-none"
                      />
                      <span className="pr-3 text-[11px] text-gray-400">บาท</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fillRemaining(code)}
                      disabled={portfolioSummary.remaining <= 0}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-blue-50 text-[#003781] hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition whitespace-nowrap"
                      title="เติมทุนที่เหลือลงช่องนี้"
                    >
                      <Wand2 size={12} /> เติมที่เหลือ
                    </button>
                  </div>

                  {/* Premium preview */}
                  {hasAlloc && q.mainPremium > 0 && (
                    <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-gray-500">เบี้ย/ปี</span>
                        <span className="font-extrabold text-[#003781]">
                          {fmt(q.totalPerYear)} บาท
                        </span>
                      </div>
                      {q.riders.length > 0 && (
                        <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                          <span>
                            Main {fmt(q.mainPremium)}
                            {q.riders.map((r) => ` · ${r.code} ${fmt(r.premium)}`)}
                          </span>
                        </div>
                      )}
                      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                        <span>เบี้ยตลอดสัญญา</span>
                        <span className="font-bold text-gray-700">
                          {fmtShort(q.totalAllYears)} บาท
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Rider toggle for this main */}
                  {hasAlloc && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setAllocField(code, "ridersOpen", !a.ridersOpen)
                        }
                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] font-bold bg-gray-50 text-gray-600 hover:bg-gray-100 transition"
                      >
                        <span>
                          เพิ่ม rider กับกรมธรรม์นี้
                          {ridersCount > 0 && (
                            <span className="ml-1.5 text-[11px] text-blue-600">
                              ({ridersCount})
                            </span>
                          )}
                        </span>
                        <ChevronDown
                          size={13}
                          className={`transition-transform ${a.ridersOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {a.ridersOpen && (
                        <div className="mt-2 px-1 space-y-2.5">
                          <RiderPickerHB
                            value={a.hbBenefit}
                            onChange={(v) => setAllocField(code, "hbBenefit", v)}
                          />
                          <RiderPickerCI
                            value={a.ciSum}
                            onChange={(v) => setAllocField(code, "ciSum", v)}
                          />
                          {ridersCount > 0 && (
                            <OccPicker
                              value={a.occClass}
                              onChange={(v) => setAllocField(code, "occClass", v)}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer summary + import */}
          {portfolioSummary.allocated > 0 && (
            <div className="px-4 py-3 bg-gradient-to-b from-gray-50 to-white border-t border-gray-100">
              <div className="flex items-baseline justify-between text-[13px] text-gray-500 mb-3">
                <span>เบี้ยรวม/ปี</span>
                <span className="text-base font-extrabold text-[#003781]">
                  {fmt(portfolioSummary.totalPerYear)} บาท
                </span>
              </div>
              <button
                type="button"
                onClick={handleImportPortfolio}
                disabled={portfolioImported}
                className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition ${
                  portfolioImported
                    ? "bg-emerald-500 text-white"
                    : "bg-[#003781] text-white hover:bg-[#1e3a5f] active:scale-[0.99]"
                }`}
              >
                {portfolioImported ? (
                  <>
                    <Check size={15} /> เพิ่มทั้งหมดแล้ว
                  </>
                ) : (
                  <>
                    <Plus size={15} /> เพิ่มทั้งหมดในพอร์ต ({portfolioSummary.policyCount} กรมธรรม์)
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── Footnote ───────────────────────────────────────────────── */}
      <div className="bg-gray-50 px-4 py-2 text-[11px] text-gray-400 leading-relaxed">
        คำนวณจากตารางเบี้ยจริงของ Allianz Ayudhya (ข้อมูล ณ เม.ย. 2026)
        ตัวเลขเป็นประมาณการก่อนพิจารณารับประกัน
      </div>
    </div>
  );
}

// ─── Shared rider pickers ─────────────────────────────────────────────────
function RiderPickerHB({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="text-[13px] font-bold text-gray-700 mb-1">
        ค่ารักษาพยาบาลรายวัน (HB)
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(0)}
          className={`px-2.5 py-1 rounded-lg text-[13px] font-bold transition border ${
            value === 0
              ? "bg-gray-700 text-white border-gray-700"
              : "bg-white text-gray-500 border-gray-200"
          }`}
        >
          ไม่เลือก
        </button>
        {HB_OPTIONS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`px-2.5 py-1 rounded-lg text-[13px] font-bold transition border ${
              value === v
                ? "bg-[#0891b2] text-white border-[#0891b2]"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#0891b2]"
            }`}
          >
            {v.toLocaleString()} บ./วัน
          </button>
        ))}
      </div>
    </div>
  );
}

function RiderPickerCI({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="text-[13px] font-bold text-gray-700 mb-1">
        โรคร้ายแรง 48 (CI48)
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(0)}
          className={`px-2.5 py-1 rounded-lg text-[13px] font-bold transition border ${
            value === 0
              ? "bg-gray-700 text-white border-gray-700"
              : "bg-white text-gray-500 border-gray-200"
          }`}
        >
          ไม่เลือก
        </button>
        {CI_OPTIONS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`px-2.5 py-1 rounded-lg text-[13px] font-bold transition border ${
              value === v
                ? "bg-[#dc2626] text-white border-[#dc2626]"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#dc2626]"
            }`}
          >
            {fmtShort(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

function OccPicker({
  value,
  onChange,
}: {
  value: OccClass;
  onChange: (v: OccClass) => void;
}) {
  return (
    <div>
      <div className="text-[13px] font-bold text-gray-700 mb-1 flex items-center gap-1">
        <Briefcase size={12} /> อาชีพ
      </div>
      <div className="flex gap-1.5">
        {OCC_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-3 py-1 rounded-lg text-[13px] font-bold transition border ${
              value === o.value
                ? "bg-gray-700 text-white border-gray-700"
                : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="text-[11px] text-gray-400 mt-1 leading-relaxed">
        ระดับ 1-2 = งานออฟฟิศ/บริการ · 3 = แรงงานทั่วไป · 4 = งานเสี่ยงสูง
      </div>
    </div>
  );
}
