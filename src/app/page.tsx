"use client";

import Link from "next/link";
import {
  Wallet,
  Scale,
  ShieldAlert,
  CreditCard,
  Shield,
  TrendingUp,
  Palmtree,
  Receipt,
  HeartPulse,
  UserCircle,
  Users,
  Target,
  GraduationCap,
  LineChart,
  BookOpen,
} from "lucide-react";
import RadialDashboard from "@/components/RadialDashboard";
import { useProfileStore } from "@/store/profile-store";

const calculators = [
  {
    name: "Personal Info",
    description: "ข้อมูลส่วนตัว",
    icon: UserCircle,
    customIcon: "/circle-icons/profile.png",
    href: "/calculators/personal-info",
    color: "bg-rose-500",
    colorHex: "#f43f5e",
    ready: true, // dynamically set below
  },
  {
    name: "Goals",
    description: "เป้าหมายชีวิต",
    icon: Target,
    customIcon: "/circle-icons/goals.png",
    href: "/calculators/goals",
    color: "bg-amber-500",
    colorHex: "#f59e0b",
    ready: true,
  },
  {
    name: "Cash Flow",
    description: "รายรับ-รายจ่าย",
    icon: Wallet,
    customIcon: "/circle-icons/cashflow.png",
    href: "/calculators/cashflow",
    color: "bg-indigo-500",
    colorHex: "#6366f1",
    ready: true,
  },
  {
    name: "Balance Sheet",
    description: "งบดุลส่วนบุคคล",
    icon: Scale,
    customIcon: "/circle-icons/balance-sheet.png",
    href: "/calculators/balance-sheet",
    color: "bg-purple-500",
    colorHex: "#a855f7",
    ready: true,
  },
  {
    name: "Emergency",
    description: "เงินสำรองฉุกเฉิน",
    icon: ShieldAlert,
    customIcon: "/circle-icons/emergency.png",
    href: "/calculators/emergency-fund",
    color: "bg-teal-500",
    colorHex: "#14b8a6",
    ready: true,
  },
  {
    name: "Retirement",
    description: "วางแผนเกษียณ",
    icon: Palmtree,
    customIcon: "/circle-icons/retirement.png",
    href: "/calculators/retirement",
    color: "bg-cyan-500",
    colorHex: "#06b6d4",
    ready: true,
  },
  {
    name: "Tax",
    description: "วางแผนภาษี",
    icon: Receipt,
    customIcon: "/circle-icons/tax.png",
    href: "/calculators/tax",
    color: "bg-violet-500",
    colorHex: "#8b5cf6",
    ready: true,
  },
  {
    name: "Risk Mgmt",
    description: "จัดการความเสี่ยง",
    icon: Shield,
    customIcon: "/circle-icons/risk-management.png",
    href: "/calculators/insurance",
    color: "bg-emerald-500",
    colorHex: "#10b981",
    ready: true,
  },
  {
    name: "Debt",
    description: "วางแผนปลดหนี้",
    icon: CreditCard,
    customIcon: "/circle-icons/debt.png",
    href: "/calculators/debt",
    color: "bg-red-500",
    colorHex: "#ef4444",
    ready: false,
  },
  {
    name: "Investment",
    description: "ลงทุนเพื่อเป้าหมาย",
    icon: TrendingUp,
    customIcon: "/circle-icons/investment.png",
    href: "/calculators/investment",
    color: "bg-orange-500",
    colorHex: "#f97316",
    ready: false,
  },
  {
    name: "Education",
    description: "การศึกษาบุตร",
    icon: GraduationCap,
    customIcon: "/circle-icons/education.png",
    href: "/calculators/education",
    color: "bg-blue-500",
    colorHex: "#3b82f6",
    ready: false,
  },
  {
    name: "CF Projection",
    description: "ประมาณการเงินสด",
    icon: LineChart,
    customIcon: "/circle-icons/cf-projection.png",
    href: "/calculators/cf-projection",
    color: "bg-sky-500",
    colorHex: "#0ea5e9",
    ready: false,
  },
];

export default function HomePage() {
  const profile = useProfileStore();
  const firstName = profile.name ? profile.name.split(" ")[0] : "";
  const profileReady = !!(profile.name && profile.birthDate);

  // Override ready for Personal Info dynamically
  const piecesWithDynamic = calculators.map((c) =>
    c.name === "Personal Info" ? { ...c, ready: profileReady } : c
  );

  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      {/* Header */}
      <div className="px-4 md:px-8 pt-8 md:pt-6 pb-4 md:pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/character/home.png" alt="Financial Friend" className="w-14 h-14 md:w-16 md:h-16 object-contain" />
          <div>
            <h1 className="text-lg font-bold">Financial Freedom</h1>
            <p className="text-[10px] text-gray-400 mt-0.5">วางแผนการเงินแบบองค์รวม</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/clients" className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-gray-100 transition">
            <Users size={22} className="text-gray-500" />
            <span className="text-[9px] text-gray-500 font-medium">Users</span>
          </Link>
          <div className="flex flex-col items-center gap-0.5 p-2">
            <UserCircle size={26} className="text-[var(--color-primary)]" />
            <span className="text-[10px] text-[var(--color-primary)] font-bold">
              {firstName ? `คุณ${firstName}` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Radial Dashboard — central circle + radial cards + bottom tabs */}
      <RadialDashboard pieces={piecesWithDynamic} />
    </div>
  );
}
