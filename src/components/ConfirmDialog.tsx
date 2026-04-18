"use client";

import { AlertTriangle, X } from "lucide-react";
import { create } from "zustand";

type Variant = "danger" | "primary";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: Variant;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions;
  resolve: ((value: boolean) => void) | null;
  show: (opts: ConfirmOptions) => Promise<boolean>;
  close: (result: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: { title: "" },
  resolve: null,
  show: (opts) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, options: opts, resolve });
    }),
  close: (result) => {
    const { resolve } = get();
    if (resolve) resolve(result);
    set({ open: false, resolve: null });
  },
}));

/** Promise-based themed confirm dialog. Resolves true on confirm, false on cancel. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().show(opts);
}

export default function ConfirmDialog() {
  const { open, options, close } = useConfirmStore();

  if (!open) return null;

  const { title, message, confirmText = "ยืนยัน", cancelText = "ยกเลิก", variant = "danger" } =
    options;

  const confirmClass =
    variant === "danger"
      ? "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-200"
      : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] shadow-lg shadow-indigo-200";

  const iconCls =
    variant === "danger" ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600";

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={() => close(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="glass rounded-3xl w-full max-w-sm p-6 animate-dialog-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconCls}`}
          >
            <AlertTriangle size={20} strokeWidth={2.5} />
          </div>
          <div className="flex-1 pt-1">
            <h3 className="text-base font-bold text-gray-900 leading-snug">{title}</h3>
            {message && (
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed whitespace-pre-line">
                {message}
              </p>
            )}
          </div>
          <button
            onClick={() => close(false)}
            className="shrink-0 text-gray-300 hover:text-gray-500 active:scale-90 transition -mt-1 -mr-1"
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-5">
          <button
            onClick={() => close(false)}
            className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 active:scale-[0.98] transition"
          >
            {cancelText}
          </button>
          <button
            onClick={() => close(true)}
            className={`flex-1 py-3 rounded-2xl text-sm font-bold active:scale-[0.98] transition ${confirmClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dialog-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 150ms ease-out;
        }
        .animate-dialog-in {
          animation: dialog-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
    </div>
  );
}
