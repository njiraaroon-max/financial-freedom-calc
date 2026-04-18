"use client";

import React, { useEffect } from "react";
import { Settings, UtensilsCrossed, Sparkles, Landmark, ShieldCheck, Gavel, Award, Calculator, Building, TrendingUp, ChevronRight, ChevronDown, Check, Lock, LineChart } from "lucide-react";
import Link from "next/link";
import { useRetirementStore } from "@/store/retirement-store";
import PageHeader from "@/components/PageHeader";
import { useProfileStore } from "@/store/profile-store";

export default function RetirementHubPage() {
  const store = useRetirementStore();
  const { completedSteps, assumptions: a, expandedSteps, toggleExpandedStep } = store;
  const profile = useProfileStore();

  const profileAge = profile.getAge?.() ?? 0;

  // Auto-sync age & retireAge to retirement store when profile changes
  useEffect(() => {
    if (profileAge > 0 && profileAge !== a.currentAge) {
      store.updateAssumption("currentAge", profileAge);
    }
    if (profile.retireAge && profile.retireAge !== a.retireAge) {
      store.updateAssumption("retireAge", profile.retireAge);
    }
  }, [profile.birthDate, profile.retireAge]);

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

  // Collapsible step sections — persisted across navigation via store.
  // Default collapsed (undefined → falsy) for minimal big-picture view.
  const openSteps: Record<number, boolean> = {
    1: !!expandedSteps[1],
    2: !!expandedSteps[2],
    3: !!expandedSteps[3],
    4: !!expandedSteps[4],
  };
  const toggleStep = (n: number) => toggleExpandedStep(n);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="วางแผนเกษียณ"
        subtitle="Retirement Planning"
        characterImg="/character/retirement.png"
      />

      {/* ─── Step Progress Bar ─────────────────────────────────── */}
      <div className="px-4 md:px-8 pt-4">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-start">
            {[
              { n: 1, label: "Retirement Funds", sub: "ทุนเกษียณที่ต้องการ", done: step1Done },
              { n: 2, label: "Saving Funds", sub: "แหล่งเงินทุน", done: step2Done },
              { n: 3, label: "Shortage or Gap + Saving Plan", sub: "ส่วนที่ขาด + แผนการออม", done: step3Done },
            ].map((step, i) => {
              const baseColor = step.done
                ? "bg-emerald-500 text-white"
                : "bg-[#1e3a5f] text-white";
              const ringColor = openSteps[step.n]
                ? (step.done ? "ring-emerald-400" : "ring-[#1e3a5f]")
                : "ring-transparent";
              return (
                <React.Fragment key={step.n}>
                  <button onClick={() => toggleStep(step.n)} className="flex flex-col items-center cursor-pointer hover:opacity-80 active:scale-95 transition-all" style={{ width: 72 }}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-offset-2 transition-all ${baseColor} ${ringColor}`}>
                      {step.done ? <Check size={16} /> : step.n}
                    </div>
                    <div className="text-[12px] font-bold text-gray-700 mt-1.5 text-center leading-tight">Step {step.n}</div>
                    <div className="text-[11px] font-bold text-gray-500 text-center">{step.label}</div>
                    <div className="text-[10px] text-gray-400 text-center">{step.sub}</div>
                  </button>
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
              <div className="glass absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center">
                <Check size={10} className="text-emerald-500" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className={`text-[14px] font-bold ${assumptionsDone ? "text-emerald-700" : "text-gray-700"}`}>สมมติฐาน</div>
            <div className="text-[12px] text-gray-400">อัตราเงินเฟ้อ ผลตอบแทน อายุขัย ฯลฯ</div>
          </div>
          <ChevronRight size={18} className="text-gray-400 shrink-0" />
        </Link>
      </div>

      {/* Step 1: หาทุนเกษียณที่ต้องการ */}
      <div className="px-4 md:px-8 pt-4">
        <div className="glass rounded-2xl">
          <button onClick={() => toggleStep(1)} className="w-full p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold ${step1Done ? "bg-emerald-500 text-white" : "bg-[#1e3a5f] text-white"}`}>
                {step1Done ? <Check size={14} /> : "1"}
              </div>
              <div className="flex items-baseline gap-2 flex-wrap text-left">
                <span className={`text-sm font-bold ${step1Done ? "text-emerald-600" : "text-gray-700"}`}>Step 1 · Retirement Funds</span>
                <span className="text-[13px] text-gray-500">หาทุนเกษียณที่ต้องการ</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!openSteps[1] && <span className="text-[12px] font-bold text-gray-400">ดูรายละเอียด</span>}
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${openSteps[1] ? "rotate-180" : ""}`} />
            </div>
          </button>
          {openSteps[1] && (
            <div className="px-3 pb-3">
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
                          <div className="glass absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center">
                            <Check size={10} className="text-emerald-500" />
                          </div>
                        )}
                      </div>
                      <div className={`text-[13px] font-bold ${done ? "text-emerald-700" : "text-gray-700"}`}>{card.name}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">{card.desc}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: คำนวณแหล่งเงินทุน */}
      <div className="px-4 md:px-8 pt-3">
        <div className="glass rounded-2xl">
          <button onClick={() => toggleStep(2)} className="w-full p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold ${step2Done ? "bg-emerald-500 text-white" : "bg-[#1e3a5f] text-white"}`}>
                {step2Done ? <Check size={14} /> : "2"}
              </div>
              <div className="flex items-baseline gap-2 flex-wrap text-left">
                <span className={`text-sm font-bold ${step2Done ? "text-emerald-600" : "text-gray-700"}`}>Step 2 · Saving Funds</span>
                <span className="text-[13px] text-gray-500">แหล่งเงินทุนเพื่อการเกษียณ</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!openSteps[2] && <span className="text-[12px] font-bold text-gray-400">ดูรายละเอียด</span>}
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${openSteps[2] ? "rotate-180" : ""}`} />
            </div>
          </button>
          {openSteps[2] && (
            <div className="px-3 pb-3">
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
                      <div className="text-[13px] font-bold text-gray-400">{card.name}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">เร็วๆ นี้</div>
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
                          <div className="glass absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center">
                            <Check size={10} className="text-emerald-500" />
                          </div>
                        )}
                      </div>
                      <div className={`text-[13px] font-bold ${done ? "text-emerald-700" : "text-gray-700"}`}>{card.name}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">{card.desc}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 3: Shortage or Gap + Saving Plan */}
      <div className="px-4 md:px-8 pt-3">
        <div className="glass rounded-2xl">
          <button onClick={() => toggleStep(3)} className="w-full p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold ${step3Done ? "bg-emerald-500 text-white" : canCalculate ? "bg-[#1e3a5f] text-white" : "bg-gray-300 text-gray-500"}`}>
                {step3Done ? <Check size={14} /> : "3"}
              </div>
              <div className="flex items-baseline gap-2 flex-wrap text-left">
                <span className={`text-sm font-bold ${step3Done ? "text-emerald-600" : canCalculate ? "text-gray-700" : "text-gray-400"}`}>Step 3 · Shortage or Gap + Saving Plan</span>
                <span className="text-[13px] text-gray-500">ส่วนที่ขาด และแผนการออม</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!openSteps[3] && <span className="text-[12px] font-bold text-gray-400">ดูรายละเอียด</span>}
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${openSteps[3] ? "rotate-180" : ""}`} />
            </div>
          </button>
          {openSteps[3] && (
            <div className="px-3 pb-3">
              <div className="grid grid-cols-2 gap-2">
          {/* Card 3.1: คำนวณแผนเกษียณ (gap) */}
          {canCalculate ? (
            <Link
              href="/calculators/retirement/plan"
              className={`p-3 rounded-xl border text-center hover:shadow-md active:scale-[0.97] transition-all ${
                planDone ? "bg-emerald-50 border-emerald-300" : "bg-white border-gray-200"
              }`}
            >
              <div className={`w-10 h-10 ${planDone ? "bg-emerald-500" : "bg-cyan-500"} rounded-lg flex items-center justify-center mx-auto mb-2 relative`}>
                <Calculator size={18} className="text-white" />
                {planDone && (
                  <div className="glass absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center">
                    <Check size={10} className="text-emerald-500" />
                  </div>
                )}
              </div>
              <div className={`text-[13px] font-bold ${planDone ? "text-emerald-700" : "text-gray-700"}`}>คำนวณแผนเกษียณ</div>
              <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">ทุนเกษียณ − แหล่งเงิน = ส่วนที่ขาด</div>
            </Link>
          ) : (
            <div className="p-3 bg-white/60 rounded-xl border border-gray-200 opacity-50 text-center">
              <div className="w-10 h-10 bg-gray-300 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Lock size={16} className="text-white" />
              </div>
              <div className="text-[13px] font-bold text-gray-400">คำนวณแผนเกษียณ</div>
              <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">ทำ Step 1 + 2 ก่อน</div>
            </div>
          )}

          {/* Card 3.2: วางแผนการออม/ลงทุน */}
          {planDone ? (
            <Link
              href="/calculators/retirement/investment-plan"
              className={`p-3 rounded-xl border text-center hover:shadow-md active:scale-[0.97] transition-all ${
                isCompleted("investment_plan") ? "bg-emerald-50 border-emerald-300" : "bg-white border-gray-200"
              }`}
            >
              <div className={`w-10 h-10 ${isCompleted("investment_plan") ? "bg-emerald-500" : "bg-amber-500"} rounded-lg flex items-center justify-center mx-auto mb-2 relative`}>
                <TrendingUp size={18} className="text-white" />
                {isCompleted("investment_plan") && (
                  <div className="glass absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center">
                    <Check size={10} className="text-emerald-500" />
                  </div>
                )}
              </div>
              <div className={`text-[13px] font-bold ${isCompleted("investment_plan") ? "text-emerald-700" : "text-gray-700"}`}>วางแผนการออม/ลงทุน</div>
              <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">เงินออมต่อเดือน & ผลตอบแทน</div>
            </Link>
          ) : (
            <div className="p-3 bg-white/60 rounded-xl border border-gray-200 opacity-50 text-center">
              <div className="w-10 h-10 bg-gray-300 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Lock size={16} className="text-white" />
              </div>
              <div className="text-[13px] font-bold text-gray-400">วางแผนการออม/ลงทุน</div>
              <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">คำนวณแผนเกษียณก่อน</div>
            </div>
          )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* บทสรุป Cashflow หลังวางแผนเกษียณ (Wealth Journey) */}
      <div className="px-4 md:px-8 pt-3 pb-8">
        <div className="glass rounded-2xl">
          <button onClick={() => toggleStep(4)} className="w-full p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#1e3a5f] text-white">
                <LineChart size={14} />
              </div>
              <div className="flex items-baseline gap-2 flex-wrap text-left">
                <span className="text-sm font-bold text-gray-700">บทสรุป Cashflow หลังวางแผนเกษียณ</span>
                <span className="text-[11px] bg-amber-400 text-[#0B1E3F] font-bold px-1.5 py-0.5 rounded-full">NEW</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!openSteps[4] && <span className="text-[12px] font-bold text-gray-400">ดูรายละเอียด</span>}
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${openSteps[4] ? "rotate-180" : ""}`} />
            </div>
          </button>
          {openSteps[4] && (
            <div className="px-3 pb-3">
              <Link
                href="/calculators/retirement/journey"
                className="group block bg-gradient-to-br from-[#0B1E3F] via-[#1E3A5F] to-[#3B82F6] rounded-xl shadow-sm hover:shadow-md active:scale-[0.99] transition-all overflow-hidden relative"
              >
                <div className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                    <LineChart size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">เส้นทางสินทรัพย์ตลอดชีวิต</div>
                    <div className="text-[12px] text-blue-100/80 mt-0.5 leading-tight">ดูกราฟสินทรัพย์ก่อน-หลังเกษียณ • Base/Bad/Good • Monte Carlo</div>
                  </div>
                  <ChevronRight size={18} className="text-white/70 group-hover:translate-x-0.5 transition" />
                </div>
                {/* Decorative wave */}
                <svg className="absolute bottom-0 right-0 opacity-20 pointer-events-none" width="160" height="48" viewBox="0 0 200 60" fill="none">
                  <path d="M0 50 Q 30 20 60 35 T 120 25 T 200 15 L 200 60 L 0 60 Z" fill="white" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
