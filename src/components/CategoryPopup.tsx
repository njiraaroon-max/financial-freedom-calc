"use client";

import { X } from "lucide-react";

interface CategoryOption {
  value: string;
  label: string;
  description: string;
}

interface CategoryPopupProps {
  title: string;
  options: CategoryOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export default function CategoryPopup({
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: CategoryPopupProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Panel */}
      <div
        className="relative w-full max-w-[430px] md:max-w-lg bg-white rounded-t-2xl md:rounded-2xl p-5 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onSelect(opt.value);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                selectedValue === opt.value
                  ? "border-[var(--color-primary)] bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold ${
                    selectedValue === opt.value
                      ? "text-[var(--color-primary)]"
                      : "text-gray-700"
                  }`}
                >
                  {opt.label}
                </span>
                {selectedValue === opt.value && (
                  <span className="text-xs bg-[var(--color-primary)] text-white px-2 py-0.5 rounded-full">
                    เลือกอยู่
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {opt.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
