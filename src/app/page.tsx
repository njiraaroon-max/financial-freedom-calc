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
  Building2,
  HeartPulse,
  UserCircle,
  Users,
} from "lucide-react";
import JigsawDashboard from "@/components/JigsawDashboard";
import { useProfileStore } from "@/store/profile-store";

const calculators = [
  {
    name: "Cash Flow",
    description: "รายรับ-รายจ่าย รายเดือน",
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
    name: "Emergency Fund",
    description: "แผนเงินสำรองฉุกเฉิน",
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
    description: "วางแผนภาษี & ลดหย่อน",
    icon: Receipt,
    href: "/calculators/tax",
    color: "bg-violet-500",
    colorHex: "#8b5cf6",
    ready: true,
  },
  {
    name: "Risk Management",
    description: "วิเคราะห์ความคุ้มครอง & ความเสี่ยง",
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
    description: "Compound Interest, DCA",
    icon: TrendingUp,
    href: "/calculators/investment",
    color: "bg-amber-500",
    colorHex: "#f59e0b",
    ready: false,
  },
];

export default function HomePage() {
  const profile = useProfileStore();
  const firstName = profile.name ? profile.name.split(" ")[0] : "";

  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      {/* Header with Character */}
      <div className="px-4 md:px-8 pt-8 md:pt-6 pb-4 md:pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/character/home.png" alt="Financial Friend" className="w-14 h-14 md:w-16 md:h-16 object-contain" />
          <div>
            <h1 className="text-lg font-bold">Financial Freedom</h1>
            <p className="text-[10px] text-gray-400 mt-0.5">
              วางแผนการเงินแบบองค์รวม
            </p>
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

      {/* iPad: Jigsaw + Financial Health side by side */}
      <div className="md:flex md:gap-3 md:px-8 md:mb-2">
        {/* Jigsaw Dashboard */}
        <div className="md:flex-1">
          <JigsawDashboard
            pieces={calculators.map((c) => ({
              name: c.name,
              icon: c.icon,
              color: c.color,
              colorHex: c.colorHex,
              ready: c.ready,
            }))}
          />
        </div>

        {/* สรุปแผนการเงินองค์รวม Card (single) */}
        <div className="md:w-[200px] md:shrink-0">
          <Link
            href="/summary"
            className="mx-4 md:mx-0 mb-6 md:mb-0 p-4 md:p-4 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-emerald-500 text-white flex md:flex-col md:justify-center items-center md:items-start gap-3 hover:shadow-lg active:scale-[0.98] transition-all md:h-full"
          >
            <div className="w-10 h-10 md:w-10 md:h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <HeartPulse size={22} />
            </div>
            <div className="flex-1 md:flex-none">
              <div className="text-sm font-bold">สรุปแผนการเงิน</div>
              <div className="text-[10px] opacity-80 mt-0.5">สุขภาพการเงิน + แผนองค์รวม</div>
            </div>
            <div className="text-white/60 text-lg md:hidden">›</div>
          </Link>
        </div>
      </div>

      {/* Calculator Grid */}
      <div className="px-4 md:px-8 pb-8 md:pb-4">
        <h2 className="text-sm font-bold text-gray-500 mb-3 md:mb-2">
          เครื่องคิดเลขการเงิน
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {calculators.map((calc) => {
            const Icon = calc.icon;
            return calc.ready ? (
              <Link
                key={calc.name}
                href={calc.href}
                className="p-4 md:p-3 bg-white rounded-2xl border border-[var(--color-border)] hover:shadow-md active:scale-[0.97] transition-all"
              >
                <div
                  className={`w-10 h-10 ${calc.color} rounded-xl flex items-center justify-center mb-3`}
                >
                  <Icon size={20} className="text-white" />
                </div>
                <div className="text-sm font-bold">{calc.name}</div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {calc.description}
                </div>
              </Link>
            ) : (
              <div
                key={calc.name}
                className="p-4 bg-white/60 rounded-2xl border border-[var(--color-border)] opacity-50"
              >
                <div
                  className={`w-10 h-10 bg-gray-300 rounded-xl flex items-center justify-center mb-3`}
                >
                  <Icon size={20} className="text-white" />
                </div>
                <div className="text-sm font-bold text-gray-400">
                  {calc.name}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">เร็วๆ นี้</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
