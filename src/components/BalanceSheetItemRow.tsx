"use client";

import { Trash2, Tag } from "lucide-react";
import MoneyInput from "@/components/MoneyInput";

interface BalanceSheetItemRowProps {
  name: string;
  value: number;
  categoryLabel?: string;
  colorType: "asset" | "liability";
  onValueChange: (value: number) => void;
  onNameChange: (name: string) => void;
  onRemove: () => void;
  onCategoryClick?: () => void;
}

export default function BalanceSheetItemRow({
  name,
  value,
  categoryLabel,
  colorType,
  onValueChange,
  onNameChange,
  onRemove,
  onCategoryClick,
}: BalanceSheetItemRowProps) {
  const isAsset = colorType === "asset";

  return (
    <div
      className={`rounded-xl border mb-2 ${
        isAsset
          ? "bg-emerald-50/50 border-emerald-200"
          : "bg-red-50/40 border-red-200"
      }`}
    >
      <div className="flex items-center gap-2 py-2.5 px-3">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full text-sm font-medium bg-transparent outline-none truncate"
            placeholder="ชื่อรายการ"
          />
          {onCategoryClick && (
            <button
              onClick={onCategoryClick}
              className={`flex items-center gap-1 mt-0.5 text-[12px] px-1.5 py-0.5 rounded transition ${
                isAsset
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : "bg-red-100 text-red-600 hover:bg-red-200"
              }`}
            >
              <Tag size={9} />
              {categoryLabel || "เลือกหมวด"}
            </button>
          )}
        </div>

        <MoneyInput
          value={value}
          onChange={onValueChange}
          className="w-32 text-right text-sm font-semibold bg-gray-50 rounded-lg px-3 py-1.5 outline-none focus:ring-2 transition"
        />

        <button
          onClick={onRemove}
          className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 active:text-red-600 transition"
          title="ลบรายการ"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
