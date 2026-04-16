"use client";

import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { useToastStore, type ToastType } from "@/store/toast-store";

const STYLES: Record<
  ToastType,
  { bg: string; text: string; iconBg: string; icon: typeof CheckCircle2 }
> = {
  success: {
    bg: "bg-white border border-emerald-200 shadow-lg shadow-emerald-100/50",
    text: "text-emerald-800",
    iconBg: "bg-emerald-100 text-emerald-600",
    icon: CheckCircle2,
  },
  error: {
    bg: "bg-white border border-red-200 shadow-lg shadow-red-100/50",
    text: "text-red-800",
    iconBg: "bg-red-100 text-red-600",
    icon: XCircle,
  },
  info: {
    bg: "bg-white border border-indigo-200 shadow-lg shadow-indigo-100/50",
    text: "text-indigo-800",
    iconBg: "bg-indigo-100 text-indigo-600",
    icon: Info,
  },
  warning: {
    bg: "bg-white border border-amber-200 shadow-lg shadow-amber-100/50",
    text: "text-amber-800",
    iconBg: "bg-amber-100 text-amber-600",
    icon: AlertTriangle,
  },
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  // Split by severity: warning / error pop at the center of the screen so
  // validation feedback (e.g. "exceeded deduction cap") is impossible to miss.
  // Success / info stay at the top where they don't block the user's eye.
  const centerToasts = toasts.filter((t) => t.type === "warning" || t.type === "error");
  const topToasts = toasts.filter((t) => t.type === "success" || t.type === "info");

  const renderToast = (t: (typeof toasts)[number], big = false) => {
    const s = STYLES[t.type];
    const Icon = s.icon;
    return (
      <div
        key={t.id}
        className={`pointer-events-auto w-full flex items-start gap-3 rounded-2xl ${s.bg} animate-toast-in ${
          big ? "px-5 py-4 shadow-2xl" : "px-4 py-3"
        }`}
      >
        <div
          className={`shrink-0 rounded-full flex items-center justify-center ${s.iconBg} ${
            big ? "w-10 h-10" : "w-8 h-8"
          }`}
        >
          <Icon size={big ? 20 : 16} strokeWidth={2.5} />
        </div>
        <div
          className={`flex-1 font-medium leading-snug pt-0.5 ${s.text} ${big ? "text-base" : "text-sm"}`}
        >
          {t.message}
        </div>
        <button
          onClick={() => dismiss(t.id)}
          className="shrink-0 text-gray-300 hover:text-gray-500 active:scale-90 transition"
          aria-label="ปิด"
        >
          <X size={big ? 18 : 16} />
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Top-center: success / info — informational */}
      {topToasts.length > 0 && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 w-full max-w-sm px-4 pointer-events-none"
          role="status"
          aria-live="polite"
        >
          {topToasts.map((t) => renderToast(t, false))}
        </div>
      )}

      {/* Center-screen: warning / error — attention-grabbing */}
      {centerToasts.length > 0 && (
        <div
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] flex flex-col items-center gap-2 w-full max-w-md px-6 pointer-events-none animate-center-pop"
          role="alert"
          aria-live="assertive"
        >
          {centerToasts.map((t) => renderToast(t, true))}
        </div>
      )}

      <style jsx>{`
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(-12px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-toast-in {
          animation: toast-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes center-pop {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.85);
          }
          60% {
            transform: translate(-50%, -50%) scale(1.04);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        .animate-center-pop {
          animation: center-pop 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
    </>
  );
}
