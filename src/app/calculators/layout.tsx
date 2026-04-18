"use client";

/**
 * Calculators layout — guards all /calculators/* routes with an active
 * client check. If no client is selected, render a full-screen prompt
 * telling the FA to pick one. Data editing on the calculators always
 * writes into the current client's plan_data, so editing without a
 * target client would orphan the data.
 */

import Link from "next/link";
import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useActiveClientStore } from "@/store/active-client-store";

export default function CalculatorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const activeClientId = useActiveClientStore((s) => s.activeClientId);
  const [hydrated, setHydrated] = useState(false);

  // Wait for zustand persist to rehydrate before deciding — otherwise
  // we flash the "no client" screen on every page load.
  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  if (!activeClientId) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users size={28} />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            ยังไม่ได้เลือก Client
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            กรุณาเลือก client ก่อนเริ่มวางแผน — ข้อมูลทุกอย่างบนหน้า
            calculators จะถูกบันทึกใน profile ของ client ที่เปิดอยู่
          </p>
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
          >
            <Users size={16} />
            ไปที่หน้า Clients
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
