"use client";

/**
 * /pending-approval — gate shown to newly-signed-up FAs waiting for
 * an admin to approve their account. Middleware redirects here for
 * any user whose fa_profiles.status is 'pending' or 'rejected'.
 *
 * From here the user can only sign out; every protected route will
 * bounce them back.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, LogOut, ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function PendingApprovalPage() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [status, setStatus] = useState<"pending" | "rejected">("pending");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const sb = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await sb.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        router.push("/login");
        return;
      }
      setEmail(data.user.email ?? "");
      const { data: profile } = await sb
        .from("fa_profiles")
        .select("status")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profile?.status === "approved") {
        router.replace("/");
      } else if (profile?.status === "rejected") {
        setStatus("rejected");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await fetch("/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const rejected = status === "rejected";

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12 bg-gradient-to-br from-indigo-50 via-white to-sky-50">
      <div className="w-full max-w-md text-center">
        <div
          className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-lg mb-4 ${
            rejected
              ? "bg-rose-500 shadow-rose-200"
              : "bg-amber-500 shadow-amber-200"
          }`}
        >
          {rejected ? (
            <ShieldX size={28} className="text-white" />
          ) : (
            <Clock size={28} className="text-white" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {rejected ? "บัญชีไม่ได้รับการอนุมัติ" : "รอการอนุมัติจาก Admin"}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {rejected ? (
            <>
              ขออภัย บัญชีของคุณ (<b>{email}</b>) ไม่ได้รับการอนุมัติ
              <br />
              หากคิดว่าผิดพลาด กรุณาติดต่อผู้ดูแลระบบ
            </>
          ) : (
            <>
              บัญชีของคุณ (<b>{email}</b>) รอการอนุมัติจากผู้ดูแลระบบ
              <br />
              เมื่ออนุมัติแล้วจะสามารถใช้งานได้ทันที — ลอง refresh หน้านี้
              อีกครั้งสักพัก หรือ logout แล้วเข้าใหม่
            </>
          )}
        </p>
        <div className="flex flex-col items-center gap-3">
          {!rejected && (
            <button
              onClick={() => router.refresh()}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              ตรวจสถานะอีกครั้ง
            </button>
          )}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition"
          >
            <LogOut size={15} />
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}
