"use client";

import { useMemo, useState } from "react";
import { Landmark, Coins, TrendingUp, BarChart2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useInsuranceStore } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG Bar Chart — same axis style as InsuranceCharts.tsx
// ═══════════════════════════════════════════════════════════════════════════════
function LongLiveBarChart({
  barData,
  birthYear,
}: {
  barData: { age: number; endowment: number; annuity: number; total: number }[];
  birthYear: number;
}) {
  const [hoverAge, setHoverAge] = useState<number | null>(null);
  if (barData.length === 0) return null;

  const BE_OFFSET = 543;
  const yearColW = 16;
  const padL = 44;
  const padR = 12;
  const padT = 20;
  const chartH = 160;
  const axisH = 80;
  const barW = 6;

  const barMax = Math.max(...barData.map((r) => r.total), 1);
  const minAge = barData[0].age;
  const maxAge = barData[barData.length - 1].age;

  // Full age range for axis (include every year)
  const allAges: number[] = [];
  for (let a = minAge; a <= maxAge; a++) allAges.push(a);

  const chartW = (maxAge - minAge + 1) * yearColW;
  const svgW = padL + chartW + padR;
  const svgH = padT + chartH + axisH;

  const xPos = (age: number) => padL + (age - minAge) * yearColW + yearColW / 2;
  const yVal = (val: number) => padT + chartH - (val / barMax) * chartH;

  const ySteps = 4;
  const yTicks = Array.from({ length: ySteps + 1 }, (_, i) => (barMax / ySteps) * i);

  const hoveredBar = hoverAge !== null ? barData.find((d) => d.age === hoverAge) ?? null : null;

  return (
    <div className="overflow-x-auto">
      <svg width={svgW} height={svgH} style={{ minWidth: svgW, display: "block" }}>

        {/* ─── Y grid + labels ─────────────────────────────────────── */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={yVal(v)} x2={padL + chartW} y2={yVal(v)}
              stroke={i === 0 ? "#d1d5db" : "#f0f0f0"} strokeWidth={i === 0 ? 1 : 0.5} />
            <text x={padL - 4} y={yVal(v) + 3} textAnchor="end" fontSize={8} fill="#9ca3af">
              {fmtShort(v)}
            </text>
          </g>
        ))}

        {/* ─── X axis ticks + dual labels (พ.ศ. / อายุ) ──────────── */}
        {allAges.map((age) => {
          const isMajor = age % 10 === 0;
          const isMinor = age % 5 === 0;
          const showLabel = isMajor || isMinor;
          const cx = xPos(age);
          return (
            <g key={age}>
              {isMajor && (
                <line x1={cx} y1={padT} x2={cx} y2={padT + chartH}
                  stroke="#e5e7eb" strokeWidth={1} />
              )}
              <line x1={cx} y1={padT + chartH}
                x2={cx} y2={padT + chartH + (isMajor ? 8 : isMinor ? 5 : 3)}
                stroke={isMajor ? "#6b7280" : "#d1d5db"}
                strokeWidth={isMajor ? 1.5 : 0.5} />
              {showLabel && (
                <>
                  <g transform={`translate(${cx},${padT + chartH + 12}) rotate(90)`}>
                    <text x={0} y={4} fontSize={8}
                      fill={isMajor ? "#4b5563" : "#9ca3af"}
                      fontWeight={isMajor ? "700" : "400"}>
                      {birthYear + age + BE_OFFSET}
                    </text>
                  </g>
                  <g transform={`translate(${cx},${padT + chartH + 44}) rotate(90)`}>
                    <text x={0} y={4} fontSize={8}
                      fill={isMajor ? "#3b82f6" : "#93c5fd"}
                      fontWeight={isMajor ? "700" : "400"}>
                      {age}
                    </text>
                  </g>
                </>
              )}
            </g>
          );
        })}

        {/* ─── Bars ────────────────────────────────────────────────── */}
        {barData.map((row) => {
          const cx = xPos(row.age);
          const bx = cx - barW / 2;
          const annuityH = (row.annuity / barMax) * chartH;
          const endowH   = (row.endowment / barMax) * chartH;
          const totalH   = annuityH + endowH;
          const isHov = hoverAge === row.age;

          return (
            <g key={row.age}>
              {/* Hover column highlight */}
              {isHov && (
                <rect x={cx - yearColW / 2} y={padT} width={yearColW} height={chartH} fill="#eef2ff" />
              )}
              {/* Endowment (purple) — top segment */}
              {endowH > 0 && (
                <rect x={bx} y={padT + chartH - totalH} width={barW} height={endowH}
                  fill={isHov ? "#9333ea" : "#a855f7"} rx={2} />
              )}
              {/* Annuity (indigo) — bottom segment */}
              {annuityH > 0 && (
                <rect x={bx} y={padT + chartH - annuityH} width={barW} height={annuityH}
                  fill={isHov ? "#4f46e5" : "#818cf8"} rx={2} />
              )}
              {/* Invisible hover hit area */}
              <rect
                x={cx - yearColW / 2} y={padT}
                width={yearColW} height={chartH}
                fill="transparent"
                onMouseEnter={() => setHoverAge(row.age)}
                onMouseLeave={() => setHoverAge(null)}
                style={{ cursor: "crosshair" }}
              />
            </g>
          );
        })}

        {/* ─── Tooltip ─────────────────────────────────────────────── */}
        {hoveredBar && (() => {
          const cx = xPos(hoverAge!);
          const lines = ([
            hoveredBar.endowment > 0
              ? { label: "สะสมทรัพย์", val: hoveredBar.endowment, color: "#a855f7" }
              : null,
            hoveredBar.annuity > 0
              ? { label: "บำนาญ",      val: hoveredBar.annuity,   color: "#818cf8" }
              : null,
          ] as ({ label: string; val: number; color: string } | null)[]).filter(Boolean) as { label: string; val: number; color: string }[];

          const hasTwo = lines.length > 1;
          const ttW = 152;
          const ttH = 22 + lines.length * 18 + (hasTwo ? 24 : 0);
          const tx = cx + ttW + 16 > svgW ? cx - ttW - 8 : cx + 10;
          const ty = Math.max(padT, Math.min(padT + chartH - ttH, padT + chartH / 2 - ttH / 2));

          return (
            <g>
              <line x1={cx} y1={padT} x2={cx} y2={padT + chartH}
                stroke="#1e3a5f" strokeWidth={1} strokeDasharray="3,2" opacity={0.35} />
              <rect x={tx} y={ty} width={ttW} height={ttH} rx={7}
                fill="white" stroke="#e5e7eb" strokeWidth={1}
                style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.10))" }} />
              <text x={tx + 10} y={ty + 15} fontSize={9} fill="#6b7280" fontWeight="500">
                พ.ศ.{birthYear + hoverAge! + BE_OFFSET} · อายุ {hoverAge}
              </text>
              {lines.map((l, i) => (
                <g key={i}>
                  <rect x={tx + 10} y={ty + 23 + i * 18} width={7} height={7} rx={1.5} fill={l.color} />
                  <text x={tx + 22} y={ty + 31 + i * 18} fontSize={9} fill="#374151">{l.label}</text>
                  <text x={tx + ttW - 10} y={ty + 31 + i * 18} fontSize={9}
                    fill={l.color} fontWeight="700" textAnchor="end">
                    ฿{fmtShort(l.val)}
                  </text>
                </g>
              ))}
              {hasTwo && (
                <g>
                  <line x1={tx + 10} y1={ty + ttH - 20} x2={tx + ttW - 10} y2={ty + ttH - 20}
                    stroke="#f3f4f6" strokeWidth={1} />
                  <text x={tx + 10} y={ty + ttH - 6} fontSize={9} fill="#111827" fontWeight="bold">รวม</text>
                  <text x={tx + ttW - 10} y={ty + ttH - 6} fontSize={10}
                    fill="#1e3a5f" fontWeight="bold" textAnchor="end">
                    ฿{fmtShort(hoveredBar.total)}
                  </text>
                </g>
              )}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function LongLivePage() {
  const { policies } = useInsuranceStore();
  const profile = useProfileStore();

  const currentAge = profile.getAge?.() || 35;
  const currentYear = new Date().getFullYear();
  const birthYear = currentYear - currentAge;
  const BE_OFFSET = 543;

  const endowmentPolicies = policies.filter((p) => p.policyType === "endowment");
  const annuityPolicies   = policies.filter((p) => p.policyType === "annuity");

  // ─── Compute maturity age for each endowment policy ───────────────────
  function getEndowmentMaturityAge(p: (typeof endowmentPolicies)[0]): number {
    const startYear = p.startDate ? new Date(p.startDate).getFullYear() : currentYear;
    const startAge  = startYear - birthYear;
    const d = p.endowmentDetails;
    if (d?.maturityYear && d.maturityYear > 0) {
      // maturityYear = ปีที่ N ของกรมธรรม์ (policy year number)
      return startAge + d.maturityYear;
    }
    if (p.coverageMode === "age" && p.coverageEndAge > 0)   return p.coverageEndAge;
    if (p.coverageMode === "years" && p.coverageYears > 0)  return startAge + p.coverageYears;
    return 0;
  }

  // ─── Build cashflow event list ─────────────────────────────────────────
  type Event =
    | { kind: "lump";     age: number; amount: number; label: string; policyId: string }
    | { kind: "dividend"; age: number; amount: number; label: string; policyId: string; policyYear: number }
    | { kind: "annuity";  startAge: number; endAge: number; perYear: number; label: string; policyId: string };

  const events = useMemo<Event[]>(() => {
    const result: Event[] = [];

    endowmentPolicies.forEach((p) => {
      const startYear = p.startDate ? new Date(p.startDate).getFullYear() : currentYear;
      const label = [p.planName, p.company].filter(Boolean).join(" · ") || "สะสมทรัพย์";
      const maturityAge = getEndowmentMaturityAge(p);
      const d = p.endowmentDetails;

      // Lump sum at maturity
      const lumpAmount = d?.maturityPayout || p.sumInsured || 0;
      if (maturityAge > 0 && lumpAmount > 0) {
        result.push({ kind: "lump", age: maturityAge, amount: lumpAmount, label, policyId: p.id });
      }

      // Dividends (ปีที่ N = policy year N, convert to age)
      if (d?.dividends) {
        d.dividends.forEach((dv) => {
          if (dv.year > 0 && dv.amount > 0) {
            const divAge = (startYear - birthYear) + dv.year;
            result.push({ kind: "dividend", age: divAge, amount: dv.amount, label, policyId: p.id, policyYear: dv.year });
          }
        });
      }
    });

    annuityPolicies.forEach((p) => {
      const d = p.annuityDetails;
      if (!d || d.payoutPerYear <= 0) return;
      const label = [p.planName, p.company].filter(Boolean).join(" · ") || "บำนาญ";
      const startAge = d.payoutStartAge || 60;
      const endAge   = d.payoutEndAge > 0 ? d.payoutEndAge : 99;
      result.push({ kind: "annuity", startAge, endAge, perYear: d.payoutPerYear, label, policyId: p.id });
    });

    return result.sort((a, b) => {
      const aAge = a.kind === "annuity" ? a.startAge : a.age;
      const bAge = b.kind === "annuity" ? b.startAge : b.age;
      return aAge - bAge;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endowmentPolicies, annuityPolicies, birthYear, currentYear]);

  // ─── Timeline range ────────────────────────────────────────────────────
  const { tlMin, tlMax } = useMemo(() => {
    const ages: number[] = [currentAge];
    events.forEach((e) => {
      if (e.kind === "annuity") { ages.push(e.startAge, e.endAge); }
      else { ages.push(e.age); }
    });
    return { tlMin: Math.min(...ages), tlMax: Math.max(...ages) };
  }, [events, currentAge]);
  const tlRange = Math.max(tlMax - tlMin, 1);

  // ─── Summary totals ────────────────────────────────────────────────────
  const { totalLump, totalDiv, totalAnnuity, grandTotal } = useMemo(() => {
    let totalLump = 0, totalDiv = 0, totalAnnuity = 0;
    events.forEach((e) => {
      if (e.kind === "lump")     totalLump += e.amount;
      if (e.kind === "dividend") totalDiv  += e.amount;
      if (e.kind === "annuity")  totalAnnuity += e.perYear * (e.endAge - e.startAge + 1);
    });
    return { totalLump, totalDiv, totalAnnuity, grandTotal: totalLump + totalDiv + totalAnnuity };
  }, [events]);

  // ─── Bar chart data — year-by-year cashflow ────────────────────────
  const barData = useMemo(() => {
    if (events.length === 0) return [];
    const byAge = new Map<number, { endowment: number; annuity: number }>();

    events.forEach((e) => {
      if (e.kind === "lump" || e.kind === "dividend") {
        const r = byAge.get(e.age) || { endowment: 0, annuity: 0 };
        r.endowment += e.amount;
        byAge.set(e.age, r);
      } else if (e.kind === "annuity") {
        for (let a = e.startAge; a <= e.endAge; a++) {
          const r = byAge.get(a) || { endowment: 0, annuity: 0 };
          r.annuity += e.perYear;
          byAge.set(a, r);
        }
      }
    });

    return Array.from(byAge.entries())
      .sort(([a], [b]) => a - b)
      .map(([age, d]) => ({ age, endowment: d.endowment, annuity: d.annuity, total: d.endowment + d.annuity }));
  }, [events]);

  const hasData = endowmentPolicies.length > 0 || annuityPolicies.length > 0;

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="Long Live Protection"
        subtitle="สรุปเงินออกจากประกันตลอดชีวิต"
        characterImg="/circle-icons/risk-management.png"
        backHref="/calculators/insurance"
      />

      <div className="px-2 md:px-4 pt-3 pb-8 space-y-3">

        {/* ── Intro ─────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-4 text-white mx-1">
          <div className="flex items-center gap-2 mb-1">
            <Landmark size={20} />
            <span className="text-sm font-bold">เงินจากประกัน — ตลอดช่วงชีวิต</span>
          </div>
          <p className="text-[11px] opacity-80 leading-relaxed">
            รวมเงินก้อน เงินปันผล และเงินบำนาญรายปีจากกรมธรรม์ทั้งหมด
          </p>
        </div>

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {!hasData && (
          <div className="bg-white rounded-2xl shadow-sm p-10 mx-1 text-center">
            <div className="text-3xl mb-2">📋</div>
            <div className="text-sm font-bold text-gray-500">ยังไม่มีกรมธรรม์สะสมทรัพย์หรือบำนาญ</div>
            <div className="text-[10px] text-gray-400 mt-1">เพิ่มได้ที่หน้าสรุปกรมธรรม์ → เลือกประเภท &ldquo;สะสมทรัพย์&rdquo; หรือ &ldquo;บำนาญ&rdquo;</div>
          </div>
        )}

        {hasData && (
          <>
            {/* ── Summary totals ──────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mx-1 space-y-3">
              <div className="text-center">
                <div className="text-[10px] text-gray-400">เงินจากประกันรวมตลอดชีวิต (ประมาณการ)</div>
                <div className="text-2xl font-extrabold text-indigo-600 mt-0.5">฿{fmtShort(grandTotal)}</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-purple-50 rounded-xl p-2.5 text-center">
                  <div className="text-[9px] text-purple-400">เงินก้อน (สะสม)</div>
                  <div className="text-sm font-bold text-purple-700">{totalLump > 0 ? fmtShort(totalLump) : "—"}</div>
                </div>
                <div className="bg-violet-50 rounded-xl p-2.5 text-center">
                  <div className="text-[9px] text-violet-400">เงินปันผล (สะสม)</div>
                  <div className="text-sm font-bold text-violet-700">{totalDiv > 0 ? fmtShort(totalDiv) : "—"}</div>
                </div>
                <div className="bg-indigo-50 rounded-xl p-2.5 text-center">
                  <div className="text-[9px] text-indigo-400">บำนาญ (รวม)</div>
                  <div className="text-sm font-bold text-indigo-700">{totalAnnuity > 0 ? fmtShort(totalAnnuity) : "—"}</div>
                </div>
              </div>
            </div>

            {/* ── Endowment policy cards ───────────────────────────────────── */}
            {endowmentPolicies.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-4 mx-1 space-y-3">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {endowmentPolicies.length}
                  </span>
                  <Coins size={14} className="text-purple-600" />
                  กรมธรรม์สะสมทรัพย์
                </h3>

                {endowmentPolicies.map((p) => {
                  const maturityAge = getEndowmentMaturityAge(p);
                  const d = p.endowmentDetails;
                  const lumpAmount = d?.maturityPayout || p.sumInsured || 0;
                  const totalDivAmt = d?.dividends?.reduce((s, dv) => s + dv.amount, 0) || 0;
                  const startYear = p.startDate ? new Date(p.startDate).getFullYear() : currentYear;

                  return (
                    <div key={p.id} className="border border-purple-100 rounded-xl p-3 space-y-2.5">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-bold text-gray-800">{p.planName || "—"}</div>
                          <div className="text-[10px] text-gray-400">{p.company}</div>
                        </div>
                        {maturityAge > 0 && (
                          <div className="text-right">
                            <div className="text-xs font-bold text-purple-600">ครบอายุ {maturityAge} ปี</div>
                            <div className="text-[9px] text-gray-400">พ.ศ. {birthYear + maturityAge + BE_OFFSET}</div>
                          </div>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                        <div className="bg-purple-50 rounded-lg p-2 text-center">
                          <div className="text-purple-400">เบี้ยที่จ่าย/ปี</div>
                          <div className="font-bold text-purple-700">{fmtShort(p.premium)}</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-2 text-center">
                          <div className="text-purple-400">เงินก้อนครบ</div>
                          <div className="font-bold text-purple-700">{lumpAmount > 0 ? fmtShort(lumpAmount) : "—"}</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-2 text-center">
                          <div className="text-purple-400">เงินปันผลรวม</div>
                          <div className="font-bold text-purple-700">{totalDivAmt > 0 ? fmtShort(totalDivAmt) : "—"}</div>
                        </div>
                      </div>

                      {/* Dividend detail */}
                      {d?.dividends && d.dividends.length > 0 && (
                        <div className="bg-purple-50/50 rounded-lg px-3 py-2">
                          <div className="text-[9px] text-purple-500 font-bold mb-1">เงินปันผลรายปี</div>
                          <div className="flex flex-wrap gap-2">
                            {d.dividends.map((dv, i) => (
                              <div key={i} className="text-[9px] bg-white border border-purple-100 rounded-lg px-2 py-1 text-center">
                                <div className="text-gray-400">ปีที่ {dv.year}</div>
                                <div className="font-bold text-purple-600">{fmtShort(dv.amount)}</div>
                                <div className="text-[8px] text-gray-400">อายุ {(startYear - birthYear) + dv.year} ปี</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mini timeline bar */}
                      {maturityAge > 0 && (
                        <div>
                          <div className="text-[9px] text-gray-400 mb-1">
                            ระยะเวลา: อายุ {startYear - birthYear} → {maturityAge} ปี
                          </div>
                          <div className="h-4 bg-gray-100 rounded-full overflow-visible relative">
                            <div
                              className="absolute h-full bg-purple-200 rounded-full"
                              style={{
                                left: `${Math.max(0, (startYear - birthYear - tlMin) / tlRange * 100)}%`,
                                width: `${Math.min((maturityAge - (startYear - birthYear)) / tlRange * 100, 100)}%`,
                              }}
                            />
                            {/* Maturity marker */}
                            <div
                              className="absolute top-0 w-4 h-4 bg-purple-500 rounded-full border-2 border-white shadow"
                              style={{ left: `calc(${(maturityAge - tlMin) / tlRange * 100}% - 8px)` }}
                            />
                            {/* Dividend markers */}
                            {d?.dividends?.map((dv, i) => {
                              const divAge = (startYear - birthYear) + dv.year;
                              return (
                                <div
                                  key={i}
                                  className="absolute top-0.5 w-3 h-3 bg-purple-400 rounded-full border border-white"
                                  style={{ left: `calc(${(divAge - tlMin) / tlRange * 100}% - 6px)` }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Annuity policy cards ─────────────────────────────────────── */}
            {annuityPolicies.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-4 mx-1 space-y-3">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {annuityPolicies.length}
                  </span>
                  <TrendingUp size={14} className="text-indigo-600" />
                  กรมธรรม์บำนาญ
                </h3>

                {annuityPolicies.map((p) => {
                  const d = p.annuityDetails;
                  const startAge  = d?.payoutStartAge || 60;
                  const endAge    = d?.payoutEndAge && d.payoutEndAge > 0 ? d.payoutEndAge : 99;
                  const perYear   = d?.payoutPerYear || 0;
                  const years     = endAge - startAge + 1;
                  const totalPay  = perYear * years;

                  return (
                    <div key={p.id} className="border border-indigo-100 rounded-xl p-3 space-y-2.5">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-bold text-gray-800">{p.planName || "—"}</div>
                          <div className="text-[10px] text-gray-400">{p.company}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-indigo-600">{fmt(perYear)} บาท/ปี</div>
                          <div className="text-[9px] text-gray-400">อายุ {startAge}–{endAge} ปี</div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                        <div className="bg-indigo-50 rounded-lg p-2 text-center">
                          <div className="text-indigo-400">เบี้ยที่จ่าย/ปี</div>
                          <div className="font-bold text-indigo-700">{fmtShort(p.premium)}</div>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-2 text-center">
                          <div className="text-indigo-400">รับ {years} ปี</div>
                          <div className="font-bold text-indigo-700">{fmtShort(perYear)}/ปี</div>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-2 text-center">
                          <div className="text-indigo-400">รวมทั้งหมด</div>
                          <div className="font-bold text-indigo-700">{fmtShort(totalPay)}</div>
                        </div>
                      </div>

                      {/* Payout timeline bar */}
                      <div>
                        <div className="text-[9px] text-gray-400 mb-1">
                          ช่วงรับบำนาญ: อายุ {startAge}–{endAge} ปี ({years} ปี)
                        </div>
                        <div className="h-4 bg-gray-100 rounded-full overflow-hidden relative">
                          <div
                            className="absolute h-full bg-indigo-400 rounded-full"
                            style={{
                              left:  `${Math.max(0, (startAge - tlMin) / tlRange * 100)}%`,
                              width: `${Math.min(years / tlRange * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[8px] text-gray-400 mt-0.5 px-0.5">
                          <span>อายุ {tlMin}</span>
                          <span>อายุ {tlMax}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Bar Chart ────────────────────────────────────────────────── */}
            {barData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-4 mx-1 space-y-2">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <BarChart2 size={14} className="text-indigo-600" />
                  ผลตอบแทนรายปี (แยกตามอายุ)
                </h3>

                <LongLiveBarChart barData={barData} birthYear={birthYear} />

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-[9px] text-gray-500 pt-1 border-t border-gray-50">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-purple-500" />
                    <span>เงินก้อน / ปันผล (สะสมทรัพย์)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-indigo-400" />
                    <span>เงินบำนาญ (รายปี)</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Cashflow Table ───────────────────────────────────────────── */}
            {events.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm mx-1 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-800">ตารางเงินออก</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#1e3a5f] text-white">
                        <th className="px-3 py-2 text-left sticky left-0 bg-[#1e3a5f] z-10">ประเภท</th>
                        <th className="px-2 py-2 text-center">อายุ</th>
                        <th className="px-2 py-2 text-left">กรมธรรม์</th>
                        <th className="px-2 py-2 text-right font-bold">จำนวน (บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((e, idx) => {
                        if (e.kind === "lump") return (
                          <tr key={idx} className="border-b border-gray-50 bg-purple-50">
                            <td className="px-3 py-2 sticky left-0 bg-purple-50 z-10">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">
                                💰 เงินก้อน
                              </span>
                            </td>
                            <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap">
                              {e.age} ปี<br />
                              <span className="text-[9px] text-gray-400">{birthYear + e.age + BE_OFFSET}</span>
                            </td>
                            <td className="px-2 py-2 text-gray-700">{e.label}</td>
                            <td className="px-2 py-2 text-right font-extrabold text-purple-700">{fmt(e.amount)}</td>
                          </tr>
                        );

                        if (e.kind === "dividend") return (
                          <tr key={idx} className="border-b border-gray-50 bg-violet-50/40">
                            <td className="px-3 py-2 sticky left-0 bg-violet-50/40 z-10">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-full">
                                📈 ปันผล
                              </span>
                            </td>
                            <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap">
                              {e.age} ปี<br />
                              <span className="text-[9px] text-gray-400">(ปีที่ {e.policyYear})</span>
                            </td>
                            <td className="px-2 py-2 text-gray-700">{e.label}</td>
                            <td className="px-2 py-2 text-right font-bold text-violet-700">{fmt(e.amount)}</td>
                          </tr>
                        );

                        if (e.kind === "annuity") return (
                          <tr key={idx} className="border-b border-gray-50 bg-indigo-50/40">
                            <td className="px-3 py-2 sticky left-0 bg-indigo-50/40 z-10">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full">
                                🏦 บำนาญ
                              </span>
                            </td>
                            <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap">
                              {e.startAge}–{e.endAge} ปี<br />
                              <span className="text-[9px] text-gray-400">{e.endAge - e.startAge + 1} ปี</span>
                            </td>
                            <td className="px-2 py-2 text-gray-700">{e.label}</td>
                            <td className="px-2 py-2 text-right whitespace-nowrap">
                              <span className="font-bold text-indigo-700">{fmt(e.perYear)}/ปี</span>
                              <br />
                              <span className="text-[9px] text-indigo-500">รวม {fmtShort(e.perYear * (e.endAge - e.startAge + 1))}</span>
                            </td>
                          </tr>
                        );

                        return null;
                      })}

                      {/* Summary row */}
                      <tr className="bg-[#1e3a5f] text-white font-bold">
                        <td colSpan={3} className="px-3 py-2.5 sticky left-0 bg-[#1e3a5f] z-10">รวมเงินออกทั้งหมด</td>
                        <td className="px-2 py-2.5 text-right text-base">{fmtShort(grandTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 bg-gray-50 text-[9px] text-gray-400">
                  * บำนาญแสดงเป็นช่วงอายุ ไม่แจกแจงรายปี | เงินก้อน = ณ วันครบกำหนดกรมธรรม์
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
