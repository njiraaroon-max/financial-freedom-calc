"use client";

/**
 * /calculators/sales/coming-soon — friendly placeholder for Pyramid
 * layers whose 5-Act sales journey isn't built yet. Rather than 404,
 * Victory FAs land here when they tap a "SOON" layer in the Pyramid
 * shell — keeps the navigation feeling intentional during rollout.
 */

import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="กำลังพัฒนา"
        subtitle="Coming soon"
        backHref="/"
      />
      <div className="px-4 md:px-8 pt-10 max-w-md mx-auto">
        <div className="glass rounded-2xl p-6 text-center">
          <div
            className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #d6b56d 0%, #b89150 100%)",
            }}
          >
            <Sparkles size={26} className="text-white" />
          </div>
          <div className="text-base font-bold text-gray-800 mb-2">
            ชั้นนี้ของ Pyramid กำลังจะมา
          </div>
          <div className="text-[13px] text-gray-500 leading-relaxed">
            เครื่องมือนี้อยู่ระหว่างการพัฒนา จะใช้งานได้ในเร็วๆ นี้ —
            ระหว่างนี้ใช้ Wealth Legacy หรือเครื่องมือที่พร้อมใน Pyramid
            ชั้นอื่นได้ก่อน
          </div>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-1 text-[13px] text-indigo-600 font-bold hover:underline"
          >
            <ChevronRight size={14} className="rotate-180" />
            กลับ Pyramid
          </Link>
        </div>
      </div>
    </div>
  );
}
