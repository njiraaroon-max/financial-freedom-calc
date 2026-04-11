"use client";

import Link from "next/link";
import { FileText, Shield, BarChart3, Check, Table2, ClipboardList } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useInsuranceStore } from "@/store/insurance-store";

const steps = [
  {
    key: "policies",
    href: "/calculators/insurance/policies",
    icon: FileText,
    title: "สรุปกรมธรรม์ที่มีอยู่",
    subtitle: "Insurance Policies",
    description: "บันทึกข้อมูลกรมธรรม์ประกันภัยทั้งหมด",
  },
  {
    key: "needs",
    href: "/calculators/insurance/needs",
    icon: Shield,
    title: "ความคุ้มครองที่ควรมี",
    subtitle: "Coverage Needs",
    description: "ประเมินความคุ้มครองที่เหมาะสม",
  },
  {
    key: "existing",
    href: "/calculators/insurance/existing",
    icon: ClipboardList,
    title: "ความคุ้มครองที่มีอยู่",
    subtitle: "Existing Coverage",
    description: "สวัสดิการนายจ้าง + ประกันที่ทำเอง + สินทรัพย์",
  },
  {
    key: "overview",
    href: "/calculators/insurance/overview",
    icon: BarChart3,
    title: "สรุปภาพรวมการบริหารความเสี่ยง",
    subtitle: "Risk Overview",
    description: "วิเคราะห์ช่องว่างและเปรียบเทียบเบี้ยประกัน",
  },
  {
    key: "summary",
    href: "/calculators/insurance/summary",
    icon: Table2,
    title: "ตารางสรุปกรมธรรม์",
    subtitle: "Policy Summary",
    description: "Gantt chart, สิทธิลดหย่อนภาษี, ทุนคุ้มครองตามอายุ",
  },
];

export default function InsurancePage() {
  const store = useInsuranceStore();
  const policyCount = store.policies.length;
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
          <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl p-4 text-white">
            <div className="text-xs opacity-70 mb-2">สรุปกรมธรรม์ปัจจุบัน</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/15 rounded-lg p-2">
                <div className="opacity-70 text-[10px]">จำนวนกรมธรรม์</div>
                <div className="font-bold text-lg">{policyCount} ฉบับ</div>
              </div>
              <div className="bg-white/15 rounded-lg p-2">
                <div className="opacity-70 text-[10px]">เบี้ยประกันรวม/ปี</div>
                <div className="font-bold text-lg">฿{Math.round(totalPremium).toLocaleString("th-TH")}</div>
              </div>
            </div>
          </div>
        )}

        {/* Steps */}
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const done = store.isStepCompleted(step.key);
          return (
            <Link key={step.key} href={step.href}>
              <div className={`bg-white rounded-2xl border p-4 flex items-center gap-4 transition-all active:scale-[0.98] ${
                done ? "border-emerald-300" : "border-gray-200 hover:border-emerald-300"
              }`}>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  done ? "bg-emerald-100" : "bg-gray-100"
                }`}>
                  {done ? (
                    <Check size={20} className="text-emerald-600" />
                  ) : (
                    <Icon size={20} className="text-gray-500" />
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
