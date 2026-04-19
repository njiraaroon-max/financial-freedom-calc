"use client";

/**
 * FormulaInput — text input that accepts either a plain number or a math
 * expression like "15000+2500" or "50000*0.15". Shows a live preview of
 * the computed result below the field.
 *
 * Committing (Enter / blur via parent) hands the parsed numeric result
 * back through `onCommit(n)`. While the expression is invalid, `value`
 * is held at the last good number and the preview shows a red "ไม่ถูกต้อง"
 * hint instead of a result.
 *
 * The parser lives in `@/lib/formula` and never uses `eval`/`new Function`.
 */

import { useEffect, useRef, useState } from "react";
import { evalFormula, looksLikeFormula } from "@/lib/formula";
import { Calculator } from "lucide-react";

export interface FormulaInputProps {
  /** current committed numeric value */
  value: number;
  /** called with the parsed number on commit (Enter / blur) */
  onCommit: (n: number) => void;
  /** called on every keystroke with the current best-effort number
      (useful if the caller wants a live total preview elsewhere) */
  onChange?: (n: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  ringClass?: string;
  /** Enter / Escape handler for save-on-enter / close-on-escape patterns */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function FormulaInput({
  value,
  onCommit,
  onChange,
  placeholder = "0",
  autoFocus,
  className,
  ringClass = "focus:ring-indigo-400",
  onKeyDown,
}: FormulaInputProps) {
  // Local draft — the raw text the user is typing. Only the parsed number
  // goes back through onCommit, so formulas never leak into store state.
  const [draft, setDraft] = useState<string>(() =>
    value === 0 ? "" : String(value),
  );
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // When the canonical `value` prop changes from outside (e.g. the user
  // switched to a different cell), refresh the draft — but only while not
  // being actively edited, so typing isn't clobbered.
  useEffect(() => {
    if (!focused) {
      setDraft(value === 0 ? "" : String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const isFormula = focused && looksLikeFormula(draft);
  const parsed = evalFormula(draft);
  const isInvalid =
    focused && draft.trim() !== "" && parsed === null;

  const commit = () => {
    if (parsed !== null) onCommit(parsed);
    setDraft(parsed !== null && parsed !== 0 ? String(parsed) : "");
  };

  const baseClass =
    className ??
    "w-full text-center text-lg font-bold bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 transition";

  return (
    <div>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={draft}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            const p = evalFormula(next);
            if (p !== null) onChange?.(p);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
            }
            onKeyDown?.(e);
          }}
          className={`${baseClass} ${ringClass}`}
        />
        {isFormula && (
          <Calculator
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none"
          />
        )}
      </div>

      {/* Live preview / error line */}
      <div className="mt-1.5 h-4 text-[14px] flex items-center justify-center">
        {isInvalid ? (
          <span className="text-rose-500">สูตรไม่ถูกต้อง</span>
        ) : isFormula && parsed !== null ? (
          <span className="text-indigo-600">
            = {parsed.toLocaleString("th-TH", { maximumFractionDigits: 2 })}
          </span>
        ) : (
          <span className="text-gray-400">
            พิมพ์สูตรได้ เช่น 15000+2500 หรือ 50000*0.15
          </span>
        )}
      </div>
    </div>
  );
}
