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
    name: "Goals",
    description: "เป้าหมายชีวิต",
    icon: Target,
    href: "/calculators/goals",
    color: "bg-amber-500",
    colorHex: "#f59e0b",
    ready: false,
  },
  {
    name: "Cash Flow",
    description: "รายรับ-รายจ่าย",
    icon: Wallet,
    href: "/calculators/cashflow",
    color: "bg-indigo-500",
    colorHex: "#6366f1",
    ready: true,
  },
  {
    name: "Balance Sheet",
    description: "งบดุลส่วนบุคคล",
    icon: Scale,
    href: "/calculators/balance-sheet",
    color: "bg-purple-500",
    colorHex: "#a855f7",
    ready: true,
  },
  {
    name: "Emergency",
    description: "เงินสำรองฉุกเฉิน",
    icon: ShieldAlert,
    href: "/calculators/emergency-fund",
    color: "bg-teal-500",
    colorHex: "#14b8a6",
    ready: true,
  },
  {
    name: "Retirement",
    description: "วางแผนเกษียณ",
    icon: Palmtree,
    href: "/calculators/retirement",
    color: "bg-cyan-500",
    colorHex: "#06b6d4",
    ready: true,
  },
  {
    name: "Tax",
    description: "วางแผนภาษี",
    icon: Receipt,
    href: "/calculators/tax",
    color: "bg-violet-500",
    colorHex: "#8b5cf6",
    ready: true,
  },
  {
    name: "Risk Mgmt",
    description: "ความคุ้มครอง",
    icon: Shield,
    href: "/calculators/insurance",
    color: "bg-emerald-500",
    colorHex: "#10b981",
    ready: false,
  },
  {
    name: "Debt",
    description: "วางแผนปลดหนี้",
    icon: CreditCard,
    href: "/calculators/debt",
    color: "bg-red-500",
    colorHex: "#ef4444",
    ready: false,
  },
  {
    name: "Investment",
    description: "ลงทุน DCA",
    icon: TrendingUp,
    href: "/calculators/investment",
    color: "bg-orange-500",
    colorHex: "#f97316",
    ready: false,
  },
  {
    name: "CF Projection",
    description: "ประมาณการเงินสด",
    icon: LineChart,
    href: "/calculators/cf-projection",
    color: "bg-sky-500",
    colorHex: "#0ea5e9",
    ready: false,
  },
  {
    name: "Education",
    description: "การศึกษาบุตร",
    icon: GraduationCap,
    href: "/calculators/education",
    color: "bg-blue-500",
    colorHex: "#3b82f6",
    ready: false,
  },
  {
    name: "Must Know",
    description: "ความรู้การเงิน",
    icon: BookOpen,
    href: "/calculators/must-know",
    color: "bg-rose-500",
    colorHex: "#f43f5e",
    ready: false,
  },
];

export default function HomePage() {
  const profile = useProfileStore();
  const firstName = profile.name ? profile.name.split(" ")[0] : "";

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
          <Link href="/profile" className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-gray-100 transition">
            <UserCircle size={26} className="text-[var(--color-primary)]" />
            <span className="text-[10px] text-[var(--color-primary)] font-bold">
              {firstName ? `คุณ${firstName}` : "Profile"}
            </span>
          </Link>
        </div>
      </div>

      {/* Radial Dashboard — central circle + radial cards + bottom tabs */}
      <RadialDashboard pieces={calculators} />
    </div>
  );
}
