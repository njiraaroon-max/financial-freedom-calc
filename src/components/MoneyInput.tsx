"use client";

/**
 * MoneyInput — shared baht-amount input with live comma formatting.
 *
 * Shows commas ALWAYS — including while the user is typing.  We use a
 * ref-based caret-preservation trick so commas inserted mid-edit don't
 * jump the caret off the digit the user was editing.
 *
 * Supports:
 *   - decimal typing ("1.5", "0.25")
 *   - leading "0" during typing
 *   - paste of "฿1,000" or "1,000.50"
 */

import { useRef, useState, useLayoutEffect } from "react";

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

/** Add thousand separators to a cleaned numeric string ("1234.5" → "1,234.5").
 *  Preserves a trailing "." and trailing zeros after the decimal so the user
 *  can keep typing "100." → "100.0" → "100.05" without the formatter
 *  clipping characters. */
function formatWithCommas(cleaned: string): string {
  if (!cleaned) return "";
  const dotIdx = cleaned.indexOf(".");
  const intPart = dotIdx === -1 ? cleaned : cleaned.slice(0, dotIdx);
  const fracPart = dotIdx === -1 ? "" : cleaned.slice(dotIdx); // includes the "."
  // Inject "," every 3 digits from the right.  Keep the "" case so editing
  // "0" → "" doesn't produce a stray "0".
  const intFormatted = intPart.length > 0
    ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    : "";
  return intFormatted + fracPart;
}

/** Count content chars (digits + dot) in a slice — used to preserve caret
 *  position across re-formats, which may add/remove commas. */
function contentLen(s: string): number {
  return s.replace(/[^\d.]/g, "").length;
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
  // `draft` holds the string the user is editing (with commas baked in).
  // When draft is null we render the value prop formatted on the fly — same
  // visual result, just lives in `value` instead of local state.
  const [draft, setDraft] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Pending caret position to restore after a reformat.  We stash it during
   *  onChange, then apply it in useLayoutEffect so it lands AFTER React has
   *  synced the value prop back to the DOM. */
  const pendingCaretRef = useRef<number | null>(null);

  const display =
    draft !== null
      ? draft
      : value === 0
        ? ""
        : value.toLocaleString("th-TH");

  useLayoutEffect(() => {
    const el = inputRef.current;
    const caret = pendingCaretRef.current;
    if (el && caret != null) {
      el.setSelectionRange(caret, caret);
      pendingCaretRef.current = null;
    }
  });

  const baseClass = compact
    ? "w-28 text-right text-sm font-semibold bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 outline-none focus:ring-2 border border-white/60"
    : "w-full text-sm font-semibold bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 text-right border border-white/60";

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        onFocus={() => {
          // Seed draft from the current value so commas are present from the
          // first keystroke.
          setDraft(value === 0 ? "" : formatWithCommas(String(value)));
          onFocus?.();
        }}
        onChange={(e) => {
          const raw = e.target.value;
          const caretBefore = e.target.selectionStart ?? raw.length;

          // Count content chars (digits + dot) to the LEFT of the caret in
          // the raw input — that's the anchor we want to preserve.
          const contentLeft = contentLen(raw.slice(0, caretBefore));

          const cleaned = cleanNumericInput(raw);
          const formatted = formatWithCommas(cleaned);

          // Walk the formatted string until the same number of content chars
          // have gone by; that's the new caret position.
          let newCaret = 0;
          let seen = 0;
          while (newCaret < formatted.length && seen < contentLeft) {
            if (/[\d.]/.test(formatted[newCaret])) seen++;
            newCaret++;
          }
          pendingCaretRef.current = newCaret;

          setDraft(formatted);
          onChange(parseNum(cleaned));
        }}
        onBlur={() => {
          setDraft(null);
          pendingCaretRef.current = null;
          onBlur?.();
        }}
        onKeyDown={onKeyDown}
        className={`${className ?? baseClass} ${ringClass} transition`}
      />
      {unit && (
        <span className="text-[13px] text-gray-400 whitespace-nowrap">
          {unit}
        </span>
      )}
    </div>
  );
}
