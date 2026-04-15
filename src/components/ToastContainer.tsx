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

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 w-full max-w-sm px-4 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const s = STYLES[t.type];
        const Icon = s.icon;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto w-full flex items-start gap-3 px-4 py-3 rounded-2xl ${s.bg} animate-toast-in`}
          >
            <div
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${s.iconBg}`}
            >
              <Icon size={16} strokeWidth={2.5} />
            </div>
            <div className={`flex-1 text-sm font-medium leading-snug pt-1 ${s.text}`}>
              {t.message}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-gray-300 hover:text-gray-500 active:scale-90 transition"
              aria-label="ปิด"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
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
      `}</style>
    </div>
  );
}
