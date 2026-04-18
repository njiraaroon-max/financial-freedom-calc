"use client";

/**
 * Forgot password — request a reset-password email.
 *
 * Supabase sends a magic link to the user's email. Clicking it lands
 * on /auth/callback which exchanges the code for a session, then
 * redirects to /reset-password where they pick a new password.
 */

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4 py-12 bg-gradient-to-br from-indigo-50 via-white to-sky-50">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-200 mb-4">
            <CheckCircle2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            ตรวจสอบอีเมลของคุณ
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปที่ <b>{email}</b> แล้ว
            <br />
            คลิกลิงก์ในอีเมลเพื่อตั้งรหัสผ่านใหม่
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600 transition"
          >
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12 bg-gradient-to-br from-indigo-50 via-white to-sky-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-200 mb-4">
            <KeyRound size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">ลืมรหัสผ่าน</h1>
          <p className="text-sm text-gray-500 mt-1">
            กรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              อีเมล
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition"
                placeholder="you@example.com"
              />
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600 active:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                กำลังส่ง...
              </>
            ) : (
              <>
                <KeyRound size={16} />
                ส่งลิงก์รีเซ็ต
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 text-xs text-gray-500">
          จำรหัสผ่านได้แล้ว?{" "}
          <Link
            href="/login"
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
