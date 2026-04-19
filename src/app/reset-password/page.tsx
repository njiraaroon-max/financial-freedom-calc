"use client";

/**
 * Reset password — lands here after clicking the reset link in email.
 *
 * By the time this page loads, /auth/callback has exchanged the code
 * for a session, so `supabase.auth.updateUser({ password })` works
 * without re-authenticating. If the user hits this page without a
 * session, we bounce them back to /forgot-password.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านและการยืนยันไม่ตรงกัน");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1500);
  };

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4 py-12 bg-gradient-to-br from-indigo-50 via-white to-sky-50">
        <div className="w-full max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            ลิงก์หมดอายุ หรือไม่ถูกต้อง
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            กรุณาขอลิงก์รีเซ็ตรหัสผ่านใหม่อีกครั้ง
          </p>
          <Link
            href="/forgot-password"
            className="inline-block px-6 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600 transition"
          >
            ขอลิงก์ใหม่
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4 py-12 bg-gradient-to-br from-indigo-50 via-white to-sky-50">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-200 mb-4">
            <CheckCircle2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            ตั้งรหัสผ่านใหม่สำเร็จ
          </h1>
          <p className="text-sm text-gray-500">กำลังพาไปหน้าหลัก...</p>
        </div>
      </div>
    );
  }

  const inputType = showPassword ? "text" : "password";
  const passwordsDiffer =
    confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12 bg-gradient-to-br from-indigo-50 via-white to-sky-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-200 mb-4">
            <KeyRound size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">ตั้งรหัสผ่านใหม่</h1>
          <p className="text-sm text-gray-500 mt-1">
            เลือกรหัสผ่านใหม่สำหรับบัญชีของคุณ
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              รหัสผ่านใหม่{" "}
              <span className="text-gray-400">(อย่างน้อย 8 ตัว)</span>
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type={inputType}
                required
                autoFocus
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                tabIndex={-1}
                aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              ยืนยันรหัสผ่านใหม่
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type={inputType}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 transition ${
                  passwordsDiffer
                    ? "ring-2 ring-rose-300 focus:ring-rose-400"
                    : "focus:ring-indigo-400"
                }`}
                placeholder="••••••••"
              />
            </div>
            {passwordsDiffer && (
              <div className="mt-1 text-[14px] text-rose-600">
                รหัสผ่านไม่ตรงกัน
              </div>
            )}
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
                กำลังบันทึก...
              </>
            ) : (
              <>
                <KeyRound size={16} />
                บันทึกรหัสผ่านใหม่
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
