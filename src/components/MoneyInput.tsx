"use client";

/**
 * MoneyInput — shared baht-amount input with live comma formatting.
 *
 * Uses a local draft string while focused so typing is not disrupted by
 * toLocaleString inserting commas mid-edit (which would jump the caret).
 * On blur, draft clears and the display shows the nicely formatted number
 * coming from the `value` prop.
 *
 * Supports:
 *   - decimal typing ("1.5", "0.25")
 *   - leading "0" during typing
 *   - paste of "฿1,000" or "1,000.50"
 */

import { useState } from "react";

function parseNum(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}

/** Strip all but digits + single decimal point */
function cleanNumericInput(raw: string): string {
  let cleaned = raw.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  return cleaned;
}

export interface MoneyInputProps {
  value: number;
  onChange: (n: number) => void;
  /** unit label shown next to the input (e.g. "บาท", "บาท/เดือน") */
  unit?: string;
  /** placeholder shown when value is 0 and input is empty */
  placeholder?: string;
  /** set to true for a compact (w-28) input used in rows */
  compact?: boolean;
  /** override classes for the input element */
  className?: string;
  /** ring colour tailwind class (default: primary) */
  ringClass?: string;
  /** disable input */
  disabled?: boolean;
  /** called when input gains focus */
  onFocus?: () => void;
  /** called when input loses focus */
  onBlur?: () => void;
  /** key down handler — Enter / Escape etc. Use for save-on-enter patterns. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** autofocus on mount — for modals / inline-edit popups */
  autoFocus?: boolean;
  /** optional id / name attributes for form labelling */
  id?: string;
  name?: string;
}

export default function MoneyInput({
  value,
  onChange,
  unit,
  placeholder = "0",
  compact = false,
  className,
  ringClass = "focus:ring-[var(--color-primary)]",
  disabled,
  onFocus,
  onBlur,
  onKeyDown,
  autoFocus,
  id,
  name,
}: MoneyInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const display =
    draft !== null
      ? draft
      : value === 0
        ? ""
        : value.toLocaleString("th-TH");

  const baseClass = compact
    ? "w-28 text-right text-sm font-semibold bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 outline-none focus:ring-2 border border-white/60"
    : "w-full text-sm font-semibold bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 text-right border border-white/60";

  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        onFocus={() => {
          setDraft(value === 0 ? "" : String(value));
          onFocus?.();
        }}
        onChange={(e) => {
          const cleaned = cleanNumericInput(e.target.value);
          setDraft(cleaned);
          onChange(parseNum(cleaned));
        }}
        onBlur={() => {
          setDraft(null);
          onBlur?.();
        }}
        onKeyDown={onKeyDown}
        className={`${className ?? baseClass} ${ringClass} transition`}
      />
      {unit && (
        <span className="text-[10px] text-gray-400 whitespace-nowrap">
          {unit}
        </span>
      )}
    </div>
  );
}
