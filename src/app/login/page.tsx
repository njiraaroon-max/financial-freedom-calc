"use client";

/**
 * Login page — FA (financial advisor) sign-in.
 *
 * Email + password only for MVP. Redirects to ?next=... after success
 * (set by middleware when bouncing an unauthed user). Middleware also
 * bounces already-authed users AWAY from /login → so if you land here
 * you're guaranteed logged out.
 */

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Mail, Lock, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Phase = "idle" | "authenticating" | "redirecting";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPhase("authenticating");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(
        error.message.includes("Invalid login")
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : error.message,
      );
      setPhase("idle");
      return;
    }

    // Auth OK — now the slow bit (middleware → home render → ClientDataSync
    // plan_data fetch) kicks in and can take 1-3s. Flip to "redirecting" so
    // the UI signals success explicitly instead of keeping the button stuck
    // on a spinner.
    setPhase("redirecting");
    router.push(next);
    router.refresh();
  };

  // Full-card success state — replaces the form so the 1-3s bridge between
  // auth-OK and home-render feels like a deliberate "loading the app" step
  // instead of a frozen login button.
  if (phase === "redirecting") {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4 py-12 bg-gradient-to-br from-indigo-50 via-white to-sky-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-200 mb-4">
              <CheckCircle2 size={32} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">เข้าสู่ระบบสำเร็จ</h1>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin text-indigo-500" />
              <span>กำลังโหลดหน้าหลัก...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12 bg-gradient-to-br from-indigo-50 via-white to-sky-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-200 mb-4">
            <LogIn size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">เข้าสู่ระบบ</h1>
          <p className="text-sm text-gray-500 mt-1">
            Financial Friend — สำหรับนักวางแผนการเงิน
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

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-gray-600">
                รหัสผ่าน
              </label>
              <Link
                href="/forgot-password"
                className="text-[14px] text-indigo-600 hover:text-indigo-700 font-medium"
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type={showPassword ? "text" : "password"}
                required
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

          {error && (
            <div className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={phase === "authenticating"}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600 active:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {phase === "authenticating" ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                กำลังเข้าสู่ระบบ...
              </>
            ) : (
              <>
                <LogIn size={16} />
                เข้าสู่ระบบ
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 text-xs text-gray-500">
          ยังไม่มีบัญชี?{" "}
          <Link
            href="/signup"
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            สมัครใช้งาน
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <LoginForm />
    </Suspense>
  );
}
