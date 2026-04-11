"use client";

import Link from "next/link";
import { BarChart3, Shield, ClipboardList, PieChart, Check } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useInsuranceStore } from "@/store/insurance-store";

const steps = [
  {
    key: "policies",
    href: "/calculators/insurance/policies",
    icon: BarChart3,
    title: "สรุปกรมธรรม์",
    subtitle: "Portfolio Dashboard",
    description: "Gantt chart, ทุนประกันรวม, สิทธิลดหย่อนภาษี",
    color: "from-[#1e3a5f] to-[#2d5a8e]",
  },
  {
    key: "existing",
    href: "/calculators/insurance/existing",
    icon: ClipboardList,
    title: "ความคุ้มครองที่มีอยู่",
    subtitle: "Existing Coverage",
    description: "กรมธรรม์ส่วนตัว + สวัสดิการจากที่ทำงาน",
    color: "from-teal-500 to-emerald-600",
  },
  {
    key: "needs",
    href: "/calculators/insurance/needs",
    icon: Shield,
    title: "ความคุ้มครองที่ควรมี",
    subtitle: "Coverage Needs",
    description: "ประเมินความคุ้มครองที่เหมาะสมตามหลัก CFP",
    color: "from-amber-500 to-orange-600",
  },
  {
    key: "overview",
    href: "/calculators/insurance/overview",
    icon: PieChart,
    title: "สรุปภาพรวมการจัดการความเสี่ยง",
    subtitle: "Risk Overview",
    description: "Gap Analysis: ควรมี − มีอยู่ = ส่วนที่ขาด",
    color: "from-purple-500 to-indigo-600",
  },
];

export default function InsurancePage() {
  const store = useInsuranceStore();
  const policyCount = store.policies.length;
  const totalSumInsured = store.policies.reduce((s, p) => s + p.sumInsured, 0);
  const totalPremium = store.policies.reduce((s, p) => s + p.premium, 0);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="จัดการความเสี่ยง"
        subtitle="Risk Management"
        characterImg="/circle-icons/risk-management.png"
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-3">
        {/* Summary */}
        {policyCount > 0 && (
          <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e] rounded-2xl p-4 text-white">
            <div className="text-xs opacity-70 mb-2">สรุปกรมธรรม์ปัจจุบัน</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-white/15 rounded-lg p-2 text-center">
                <div className="opacity-70 text-[9px]">จำนวน</div>
                <div className="font-bold text-lg">{policyCount}</div>
              </div>
              <div className="bg-white/15 rounded-lg p-2 text-center">
                <div className="opacity-70 text-[9px]">ทุนรวม</div>
                <div className="font-bold text-lg">
                  {totalSumInsured >= 1_000_000
                    ? `${(totalSumInsured / 1_000_000).toFixed(1)}M`
                    : `${Math.round(totalSumInsured / 1000)}K`}
                </div>
              </div>
              <div className="bg-white/15 rounded-lg p-2 text-center">
                <div className="opacity-70 text-[9px]">เบี้ย/ปี</div>
                <div className="font-bold text-lg">
                  {totalPremium >= 1_000_000
                    ? `${(totalPremium / 1_000_000).toFixed(1)}M`
                    : `${Math.round(totalPremium / 1000)}K`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4 Step Cards */}
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const done = store.isStepCompleted(step.key);
          return (
            <Link key={step.key} href={step.href}>
              <div className={`bg-white rounded-2xl border p-4 flex items-center gap-4 transition-all active:scale-[0.98] ${
                done ? "border-emerald-300" : "border-gray-200 hover:border-gray-300"
              }`}>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${step.color}`}>
                  {done ? (
                    <Check size={20} className="text-white" />
                  ) : (
                    <Icon size={20} className="text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400">{idx + 1}</span>
                    <span className="text-sm font-bold text-gray-800">{step.title}</span>
                  </div>
                  <div className="text-[10px] text-gray-400">{step.description}</div>
                </div>
                <div className="text-gray-300">›</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
