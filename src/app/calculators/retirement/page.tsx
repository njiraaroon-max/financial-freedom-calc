"use client";

import React, { useEffect } from "react";
import { Settings, UtensilsCrossed, Sparkles, Landmark, ShieldCheck, Gavel, Award, Calculator, Building, TrendingUp, ChevronRight, MousePointerClick, Check, Lock } from "lucide-react";
import Link from "next/link";
import { useRetirementStore } from "@/store/retirement-store";
import PageHeader from "@/components/PageHeader";
import { useProfileStore } from "@/store/profile-store";
import { futureValue, calcRetirementFund } from "@/types/retirement";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

export default function RetirementHubPage() {
  const store = useRetirementStore();
  const { completedSteps, assumptions: a } = store;
  const profile = useProfileStore();

  const profileAge = profile.getAge?.() ?? 0;
  const currentAge = profileAge > 0 ? profileAge : (a.currentAge > 0 ? a.currentAge : 35);
  const retireAge = (profile.retireAge && profile.retireAge > 0) ? profile.retireAge : (a.retireAge > 0 ? a.retireAge : 60);

  // Auto-sync age & retireAge to retirement store when profile changes
  useEffect(() => {
    if (profileAge > 0 && profileAge !== a.currentAge) {
      store.updateAssumption("currentAge", profileAge);
    }
    if (profile.retireAge && profile.retireAge !== a.retireAge) {
      store.updateAssumption("retireAge", profile.retireAge);
    }
  }, [profile.birthDate, profile.retireAge]);
  const lifeExpectancy = a.lifeExpectancy > 0 ? a.lifeExpectancy : 85;
  const workYears = Math.max(retireAge - currentAge, 1);
  const retireYears = Math.max(lifeExpectancy - retireAge, 1);

  // Calculate basic expense totals
  const totalBasicMonthly = store.basicExpenses.reduce((s, e) => s + e.monthlyAmount, 0);
  const basicMonthlyFV = futureValue(totalBasicMonthly, a.generalInflation, workYears);
  const basicRetireFund = calcRetirementFund(basicMonthlyFV, a.postRetireReturn, a.generalInflation, retireYears, a.residualFund);
  const residualPV = a.residualFund / Math.pow(1 + a.postRetireReturn, retireYears);
  const expensePV = basicRetireFund - residualPV;
  const multiplier = totalBasicMonthly > 0 ? basicMonthlyFV / totalBasicMonthly : 0;
  // พอใช้อีกกี่ปี = เงินคงเหลือ / ค่าใช้จ่ายรายปี ณ สิ้นอายุขัย (FV ของ FV เดือน × 12)
  const expenseAtLifeEnd = basicMonthlyFV * Math.pow(1 + a.generalInflation, retireYears) * 12;
  const extraYears = expenseAtLifeEnd > 0 ? a.residualFund / expenseAtLifeEnd : 0;

  const isCompleted = (step: string) => completedSteps[step] || false;

  // Step 1 cards (assumptions moved out to its own standalone block)
  const step1Cards = [
    { key: "basic_expenses", name: "รายจ่ายพื้นฐาน", desc: "ค่าใช้จ่ายหลังเกษียณ", icon: UtensilsCrossed, color: "bg-orange-500", href: "/calculators/retirement/basic-expenses" },
    { key: "special_expenses", name: "รายจ่ายพิเศษ", desc: "รถ ท่องเที่ยว รักษาพยาบาล", icon: Sparkles, color: "bg-pink-500", href: "/calculators/retirement/special-expenses" },
  ];

  // Step 2 cards
  const step2Cards = [
    { key: "pvd", name: "PVD", desc: "กองทุนสำรองเลี้ยงชีพ", icon: Landmark, color: "bg-blue-500", href: "/calculators/retirement/pvd" },
    { key: "social_security", name: "บำนาญ ปสก.", desc: "บำนาญประกันสังคม", icon: ShieldCheck, color: "bg-green-500", href: "/calculators/retirement/social-security" },
    { key: "pension_insurance", name: "ประกันบำนาญ", desc: "ประกันบำนาญเอกชน", icon: Award, color: "bg-purple-500", href: "/calculators/retirement/pension-insurance" },
    { key: "severance", name: "เงินชดเชย", desc: "ตามกฎหมายแรงงาน", icon: Gavel, color: "bg-amber-500", href: "/calculators/retirement/severance" },
    { key: "rmf", name: "RMF", desc: "กองทุนรวมเพื่อการเลี้ยงชีพ", icon: Calculator, color: "bg-indigo-500", href: "#", disabled: true },
    { key: "gpf", name: "กบข.", desc: "กองทุนบำเหน็จบำนาญข้าราชการ", icon: Building, color: "bg-teal-500", href: "#", disabled: true },
    { key: "gov_pension", name: "บำนาญข้าราชการ", desc: "บำนาญข้าราชการ/รัฐวิสาหกิจ", icon: Building, color: "bg-sky-500", href: "#", disabled: true },
    { key: "life_insurance_maturity", name: "ประกันชีวิตครบกำหนด", desc: "เงินครบกำหนดประกันชีวิต", icon: ShieldCheck, color: "bg-pink-500", href: "#", disabled: true },
    { key: "other_investment", name: "การลงทุนอื่นๆ", desc: "เงินลงทุนอื่นที่จัดสรรเพื่อเกษียณ", icon: TrendingUp, color: "bg-orange-500", href: "#", disabled: true },
  ];

  const step1Done = step1Cards.every((c) => isCompleted(c.key));
  const step2Done = step2Cards.filter((c) => !c.disabled).some((c) => isCompleted(c.key));
  const canCalculate = step1Done && step2Done;
  const planDone = isCompleted("retirement_plan");
  const step3Done = planDone && isCompleted("investment_plan");
  const assumptionsDone = isCompleted("assumptions");

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="วางแผนเกษียณ"
        subtitle="Retirement Planning"
        characterImg="/character/retirement.png"
      />

      {/* Combined Timeline + Expense Chart — single box */}
      <div className="px-4 md:px-8 pt-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          {/* Icons */}
          <div className="flex items-end mb-1" style={{ height: "40px" }}>
            <div className="flex flex-col items-center" style={{ width: "44px", flexShrink: 0 }}>
              <img src="/icons/working.png" alt="ทำงาน" width={32} height={32} />
            </div>
            <div style={{ flex: workYears }} />
            <div className="flex flex-col items-center" style={{ width: "44px", flexShrink: 0 }}>
              <img src="/icons/retired.png" alt="เกษียณ" width={28} height={28} />
            </div>
            <div style={{ flex: retireYears }} />
            <div className="flex flex-col items-center" style={{ width: "44px", flexShrink: 0 }}>
              <img src="/icons/bed.svg" alt="อายุขัย" width={28} height={28} className="opacity-50 mt-1" />
            </div>
          </div>

          {/* Labels */}
          <div className="flex items-center mb-2">
            <div className="text-[8px] text-[#c5cae9] font-bold text-center" style={{ width: "44px", flexShrink: 0 }}>อายุปัจจุบัน</div>
            <div style={{ flex: workYears }} />
            <div className="text-[8px] text-[#1e3a5f] font-bold text-center" style={{ width: "44px", flexShrink: 0 }}>อายุเกษียณ</div>
            <div style={{ flex: retireYears }} />
            <div className="text-[8px] text-gray-400 font-bold text-center" style={{ width: "44px", flexShrink: 0 }}>อายุขัย</div>
          </div>

          {/* Age boxes + Lines */}
          <div className="flex items-center mb-4">
            <div className="bg-[#c5cae9] text-[#1e3a5f] rounded-lg text-xs font-extrabold z-10 flex items-center justify-center" style={{ width: "44px", height: "28px", flexShrink: 0 }}>{currentAge}</div>
            <div className="relative mx-0.5" style={{ flex: workYears }}>
              <div className="border-t-2 border-dashed border-[#1e3a5f]" />
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-[#1e3a5f] bg-white px-1 whitespace-nowrap">{workYears} ปี</div>
            </div>
            <div className="bg-[#1e3a5f] text-white rounded-lg text-xs font-extrabold z-10 flex items-center justify-center" style={{ width: "44px", height: "28px", flexShrink: 0 }}>{retireAge}</div>
            <div className="relative mx-0.5" style={{ flex: retireYears }}>
              <div className="border-t-2 border-dashed border-gray-400" />
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-500 bg-white px-1 whitespace-nowrap">{retireYears} ปี</div>
            </div>
            <div className="bg-gray-200 text-gray-700 rounded-lg text-xs font-extrabold z-10 flex items-center justify-center" style={{ width: "44px", height: "28px", flexShrink: 0 }}>{lifeExpectancy}</div>
          </div>

          {/* SVG Bar Chart with diagonal arrows — only show if basic expenses data exists */}
          {isCompleted("basic_expenses") && totalBasicMonthly > 0 && (() => {
            // SVG dimensions
            const svgW = 600;
            const svgH = 200;
            const baseline = svgH - 10;
            const barW = 35;

            // Proportional x positions based on age spans
            const totalSpan = lifeExpectancy - currentAge;
            const pvX = 30; // PV bar center
            const fvX = pvX + ((retireAge - currentAge) / totalSpan) * (svgW - 80);
            const resX = svgW - 40; // residual bar center

            // Bar heights — unified scale with ÷100 for lump sums
            const maxH = 140;
            const scaleDivisor = 100;

            const scaleValues = [
              totalBasicMonthly,
              basicMonthlyFV,
              basicRetireFund / scaleDivisor,
              residualPV / scaleDivisor,
            ];
            const maxVal = Math.max(...scaleValues);

            const pvH = Math.max(Math.round(maxH * (totalBasicMonthly / maxVal)), 12);
            const fvH = Math.max(Math.round(maxH * (basicMonthlyFV / maxVal)), 15);
            const dotBoxH = Math.max(Math.round(maxH * ((basicRetireFund / scaleDivisor) / maxVal)), 20);
            const resH = Math.max(Math.round(maxH * ((residualPV / scaleDivisor) / maxVal)), 6);

            // Dot bar positions (between fvX and resX)
            const dotCount = Math.min(retireYears, 25);
            const dotSpacing = (resX - fvX - barW) / (dotCount + 1);

            return (
              <>
                <svg viewBox={`0 0 ${svgW} ${svgH + 30}`} className="w-full">
                  <defs>
                    <marker id="arrowUp" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                      <polygon points="0 0, 8 3, 0 6" fill="#1e3a5f" />
                    </marker>
                    <marker id="arrowDown" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                      <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
                    </marker>
                  </defs>

                  {/* ทุนเกษียณ (A) label above dot box */}
                  <text x={fvX} y={baseline - dotBoxH - 18} textAnchor="middle" className="text-[9px] fill-cyan-700 font-bold">
                    ทุนเกษียณ (A)
                  </text>
                  <text x={fvX} y={baseline - dotBoxH - 6} textAnchor="middle" className="text-[10px] fill-cyan-700 font-bold">
                    ฿{fmt(basicRetireFund)}
                  </text>

                  {/* Diagonal arrow 1: PV top → dot box top (rising) */}
                  <line
                    x1={pvX + barW / 2 + 2} y1={baseline - pvH}
                    x2={fvX - barW / 2 - 8} y2={baseline - dotBoxH}
                    stroke="#1e3a5f" strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#arrowUp)"
                  />

                  {/* Diagonal arrow 2: dot box top → Residual top (declining) */}
                  <line
                    x1={fvX + barW / 2 + 8} y1={baseline - dotBoxH}
                    x2={resX - barW / 2 - 4} y2={baseline - resH}
                    stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#arrowDown)"
                  />

                  {/* PV Bar + value inside */}
                  <rect x={pvX - barW / 2} y={baseline - pvH} width={barW} height={pvH} rx={3} fill="#c5cae9" />
                  <text x={pvX} y={baseline - pvH + 14} textAnchor="middle" className="text-[7px] fill-[#1e3a5f] font-bold">
                    ฿{fmt(totalBasicMonthly)}
                  </text>
                  <text x={pvX} y={baseline + 12} textAnchor="middle" className="text-[7px] fill-gray-400">ปัจจุบัน</text>

                  {/* Multiplier label — below baseline */}
                  <text x={(pvX + fvX) / 2} y={baseline + 22} textAnchor="middle" className="text-[9px] fill-red-500 font-bold">
                    x{multiplier.toFixed(2)} เท่า
                  </text>

                  {/* Dot box (dashed border) = ทุนเกษียณรวม — behind FV bar */}
                  <rect x={fvX - barW / 2 - 5} y={baseline - dotBoxH} width={barW + 10} height={dotBoxH} rx={4} fill="none" stroke="#1e3a5f" strokeWidth={2} strokeDasharray="4 3" />

                  {/* FV Bar (solid) = ค่าใช้จ่ายต่อเดือน — inside dot box, smaller */}
                  <rect x={fvX - barW / 2} y={baseline - fvH} width={barW} height={fvH} rx={3} fill="#1e3a5f" />

                  {/* ทุนเกษียณ label at top of dot box */}
                  {/* FV monthly value inside solid bar */}
                  <text x={fvX} y={baseline - fvH + 14} textAnchor="middle" className="text-[7px] fill-white font-bold">
                    ฿{fmt(basicMonthlyFV)}
                  </text>
                  <text x={fvX} y={baseline + 12} textAnchor="middle" className="text-[7px] fill-[#1e3a5f] font-bold">อนาคต</text>

                  {/* Declining dot bars — linearly from dotBoxH to resH */}
                  {Array.from({ length: dotCount }).map((_, i) => {
                    const progress = (i + 1) / (dotCount + 1);
                    const dotX = fvX + barW / 2 + dotSpacing * (i + 1);
                    // Linear interpolation from dotBoxH down to resH
                    const dotH = dotBoxH - progress * (dotBoxH - resH);
                    const opacity = 1 - progress * 0.35;
                    const dotW = Math.max(9 - progress * 4, 4);
                    return (
                      <rect
                        key={i}
                        x={dotX - dotW / 2}
                        y={baseline - dotH}
                        width={dotW}
                        height={dotH}
                        rx={2}
                        fill="none"
                        stroke="#1e3a5f"
                        strokeWidth={1.5}
                        strokeDasharray="3 2"
                        opacity={opacity}
                      />
                    );
                  })}

                  {/* Residual Bar — scaled to FV */}
                  <rect x={resX - barW / 2 - 2} y={baseline - resH - 2} width={barW + 4} height={resH + 4} rx={3} fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="3 2" />
                  <rect x={resX - barW / 2} y={baseline - resH} width={barW} height={resH} rx={3} fill="#d1d5db" />
                  <text x={resX} y={baseline - resH - 8} textAnchor="middle" className="text-[7px] fill-gray-500 font-bold">
                    ฿{fmt(a.residualFund)}
                  </text>
                  <text x={resX} y={baseline + 12} textAnchor="middle" className="text-[7px] fill-gray-400">เงินคงเหลือ</text>

                  {/* Baseline */}
                  <line x1={pvX - barW} y1={baseline} x2={resX + barW} y2={baseline} stroke="#e5e7eb" strokeWidth={1} />
                </svg>

                {/* Breakdown */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 mt-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">รวมค่าใช้จ่ายหลังเกษียณ {retireYears} ปี</span>
                    <span className="font-bold text-gray-700">฿{fmt(expensePV)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">เงินคงเหลือ ณ สิ้นอายุขัย</span>
                      <span className="font-bold text-gray-400">฿{fmt(a.residualFund)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 pl-2">→ มูลค่า ณ วันเกษียณ</span>
                      <span className="font-bold text-gray-700">฿{fmt(residualPV)}</span>
                    </div>
                    {a.residualFund > 0 && extraYears > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 pl-2">→ พอใช้อีก</span>
                        <span className="font-bold text-emerald-600">{extraYears.toFixed(1)} ปี</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-gray-200 pt-1.5 flex justify-between text-sm">
                    <span className="font-bold text-cyan-700">ทุนเกษียณ (A)</span>
                    <span className="font-bold text-cyan-700">฿{fmt(basicRetireFund)}</span>
                  </div>
                </div>

                <div className="text-[9px] text-gray-400 text-center mt-2">
                  สมมติฐาน: เงินเฟ้อ {(a.generalInflation * 100).toFixed(1)}% | ผลตอบแทนหลังเกษียณ {(a.postRetireReturn * 100).toFixed(1)}%
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* ─── Step Progress Bar ─────────────────────────────────── */}
      <div className="px-4 md:px-8 pt-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-start">
            {[
              { n: 1, label: "Retirement Funds", sub: "ทุนเกษียณที่ต้องการ", done: step1Done },
              { n: 2, label: "Saving Funds", sub: "แหล่งเงินทุน", done: step2Done },
              { n: 3, label: "The Gap + Plan", sub: "ส่วนที่ขาด + แผนลงทุน", done: step3Done },
            ].map((step, i) => {
              const baseColor = step.done
                ? "bg-emerald-500 text-white"
                : "bg-[#1e3a5f] text-white";
              return (
                <React.Fragment key={step.n}>
                  <div className="flex flex-col items-center" style={{ width: 72 }}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-all ${baseColor}`}>
                      {step.done ? <Check size={16} /> : step.n}
                    </div>
                    <div className="text-[10px] font-bold text-gray-700 mt-1.5 text-center leading-tight">Step {step.n}</div>
                    <div className="text-[9px] font-bold text-gray-500 text-center">{step.label}</div>
                    <div className="text-[8px] text-gray-400 text-center">{step.sub}</div>
                  </div>
                  {i < 2 && <div className={`flex-1 h-0.5 mt-[18px] ${step.done ? "bg-emerald-300" : "bg-gray-200"}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* สมมติฐาน (standalone) */}
      <div className="px-4 md:px-8 pt-4">
        <Link
          href="/calculators/retirement/assumptions"
          className={`flex items-center gap-3 p-3 rounded-xl border hover:shadow-md active:scale-[0.98] transition-all ${
            assumptionsDone ? "bg-emerald-50 border-emerald-300" : "bg-white border-gray-200"
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center relative shrink-0 ${assumptionsDone ? "bg-emerald-500" : "bg-slate-600"}`}>
            <Settings size={18} className="text-white" />
            {assumptionsDone && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                <Check size={10} className="text-emerald-500" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className={`text-[12px] font-bold ${assumptionsDone ? "text-emerald-700" : "text-gray-700"}`}>สมมติฐาน</div>
            <div className="text-[10px] text-gray-400">อัตราเงินเฟ้อ ผลตอบแทน อายุขัย ฯลฯ</div>
          </div>
          <ChevronRight size={18} className="text-gray-400 shrink-0" />
        </Link>
      </div>

      {/* Step 1: หาทุนเกษียณที่ต้องการ */}
      <div className="px-4 md:px-8 pt-5">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step1Done ? "bg-emerald-500 text-white" : "bg-[#1e3a5f] text-white"}`}>
            {step1Done ? <Check size={14} /> : "1"}
          </div>
          <span className={`text-sm font-bold ${step1Done ? "text-emerald-600" : "text-gray-700"}`}>หาทุนเกษียณที่ต้องการ</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {step1Cards.map((card) => {
            const Icon = card.icon;
            const done = isCompleted(card.key);
            return (
              <Link
                key={card.key}
                href={card.href}
                className={`p-3 rounded-xl border text-center hover:shadow-md active:scale-[0.97] transition-all ${
                  done ? "bg-emerald-50 border-emerald-300" : "bg-white border-gray-200"
                }`}
              >
                <div className={`w-10 h-10 ${done ? "bg-emerald-500" : card.color} rounded-lg flex items-center justify-center mx-auto mb-2 relative`}>
                  <Icon size={18} className="text-white" />
                  {done && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                      <Check size={10} className="text-emerald-500" />
                    </div>
                  )}
                </div>
                <div className={`text-[11px] font-bold ${done ? "text-emerald-700" : "text-gray-700"}`}>{card.name}</div>
                <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">{card.desc}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Step 2: คำนวณแหล่งเงินทุน */}
      <div className="px-4 md:px-8 pt-5">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step2Done ? "bg-emerald-500 text-white" : "bg-[#1e3a5f] text-white"}`}>
            {step2Done ? <Check size={14} /> : "2"}
          </div>
          <span className={`text-sm font-bold ${step2Done ? "text-emerald-600" : "text-gray-700"}`}>คำนวณแหล่งเงินทุนเกษียณ</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {step2Cards.map((card) => {
            const Icon = card.icon;
            const done = isCompleted(card.key);
            const disabled = card.disabled;
            return disabled ? (
              <div key={card.key} className="p-3 bg-white/60 rounded-xl border border-gray-200 opacity-40 text-center">
                <div className="w-10 h-10 bg-gray-300 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Icon size={18} className="text-white" />
                </div>
                <div className="text-[11px] font-bold text-gray-400">{card.name}</div>
                <div className="text-[9px] text-gray-400 mt-0.5">เร็วๆ นี้</div>
              </div>
            ) : (
              <Link
                key={card.key}
                href={card.href}
                className={`p-3 rounded-xl border text-center hover:shadow-md active:scale-[0.97] transition-all ${
                  done ? "bg-emerald-50 border-emerald-300" : "bg-white border-gray-200"
                }`}
              >
                <div className={`w-10 h-10 ${done ? "bg-emerald-500" : card.color} rounded-lg flex items-center justify-center mx-auto mb-2 relative`}>
                  <Icon size={18} className="text-white" />
                  {done && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                      <Check size={10} className="text-emerald-500" />
                    </div>
                  )}
                </div>
                <div className={`text-[11px] font-bold ${done ? "text-emerald-700" : "text-gray-700"}`}>{card.name}</div>
                <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">{card.desc}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* CTA: เริ่มคำนวณแผนเกษียณ */}
      <div className="px-4 md:px-8 pt-5">
        {canCalculate ? (
          <Link
            href="/calculators/retirement/plan"
            className={`block w-full rounded-2xl p-5 hover:shadow-2xl hover:scale-[1.01] active:scale-[0.97] transition-all shadow-lg border-2 ${
              planDone
                ? "bg-gradient-to-r from-emerald-500 to-green-600 border-emerald-300 shadow-emerald-200 text-white"
                : "bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 border-white/20 shadow-blue-300 text-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold mb-1">
                  {planDone ? "✅ คำนวณแผนเกษียณเสร็จแล้ว" : "🎯 เริ่มคำนวณแผนเกษียณ"}
                </div>
                <div className="text-xs opacity-90">สรุปทุนเกษียณ - แหล่งเงิน = ส่วนที่ขาด</div>
              </div>
              <div className="bg-white/20 rounded-2xl p-3 relative">
                <Calculator size={28} />
                <MousePointerClick size={16} className="absolute -bottom-1.5 -right-1.5 text-white/70 rotate-[15deg]" />
              </div>
            </div>
          </Link>
        ) : (
          <div className="w-full rounded-2xl p-5 bg-gray-200 text-gray-500 border-2 border-gray-300">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold mb-1 flex items-center gap-2">
                  <Lock size={18} />
                  เริ่มคำนวณแผนเกษียณ
                </div>
                <div className="text-xs opacity-70">
                  กรุณาคำนวณ Step 1 และ Step 2 ให้ครบก่อน
                </div>
              </div>
              <div className="bg-gray-300 rounded-2xl p-3">
                <Calculator size={28} className="text-gray-400" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 3: แผนลงทุนเพื่อเกษียณ */}
      <div className="px-4 md:px-8 pt-5 pb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isCompleted("investment_plan") ? "bg-emerald-500 text-white" : planDone ? "bg-[#1e3a5f] text-white" : "bg-gray-300 text-gray-500"}`}>
            {isCompleted("investment_plan") ? <Check size={14} /> : "3"}
          </div>
          <span className={`text-sm font-bold ${isCompleted("investment_plan") ? "text-emerald-600" : planDone ? "text-gray-700" : "text-gray-400"}`}>
            แผนลงทุนเพื่อเกษียณ
          </span>
        </div>
        {planDone ? (
          <Link
            href="/calculators/retirement/investment-plan"
            className={`p-4 rounded-xl border text-center hover:shadow-md active:scale-[0.97] transition-all ${
              isCompleted("investment_plan") ? "bg-emerald-50 border-emerald-300" : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 ${isCompleted("investment_plan") ? "bg-emerald-500" : "bg-amber-500"} rounded-xl flex items-center justify-center relative`}>
                <TrendingUp size={22} className="text-white" />
                {isCompleted("investment_plan") && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                    <Check size={12} className="text-emerald-500" />
                  </div>
                )}
              </div>
              <div className="flex-1 text-left">
                <div className={`text-sm font-bold ${isCompleted("investment_plan") ? "text-emerald-700" : "text-gray-700"}`}>วางแผนการออม/ลงทุน</div>
                <div className="text-[10px] text-gray-400">คำนวณเงินออมต่อเดือน & ผลตอบแทนที่ต้องการ</div>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </div>
          </Link>
        ) : (
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-100 opacity-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-300 rounded-xl flex items-center justify-center">
                <Lock size={18} className="text-gray-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-bold text-gray-400">วางแผนการออม/ลงทุน</div>
                <div className="text-[10px] text-gray-400">คำนวณแผนเกษียณก่อนจึงจะ unlock</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
