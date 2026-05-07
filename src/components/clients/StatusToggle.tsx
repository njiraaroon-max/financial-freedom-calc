"use client";

/**
 * StatusToggle — clickable badge that opens a dropdown for changing
 * the client's manual status (migration 016).
 *
 * Lives next to the client name in /clients cards and (later) on
 * the Client Detail page. Optimistic write: badge flips
 * instantly, parent's onChange is called, network failure rolls
 * back via the parent's revert handler.
 */

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import StatusBadge, { statusDotColor, statusLabel } from "./StatusBadge";
import type { ClientStatus } from "@/lib/supabase/database.types";
import { CLIENT_STATUSES } from "@/lib/supabase/database.types";

interface StatusToggleProps {
  status: ClientStatus;
  onChange: (next: ClientStatus) => void | Promise<void>;
  disabled?: boolean;
}

export default function StatusToggle({
  status,
  onChange,
  disabled = false,
}: StatusToggleProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<ClientStatus | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleSelect = async (next: ClientStatus) => {
    if (next === status) {
      setOpen(false);
      return;
    }
    setPending(next);
    setOpen(false);
    try {
      await onChange(next);
    } finally {
      setPending(null);
    }
  };

  const visualStatus = pending ?? status;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled || pending !== null}
        className="group inline-flex items-center gap-1 transition active:scale-95 disabled:opacity-60"
        title="คลิกเพื่อเปลี่ยนสถานะ"
      >
        <StatusBadge status={visualStatus} />
        {!disabled && (
          <ChevronDown
            size={11}
            className="text-gray-400 group-hover:text-gray-600 transition"
          />
        )}
      </button>

      {open && (
        <div
          className="absolute z-50 left-0 mt-1 min-w-[180px] rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden"
          role="menu"
        >
          {CLIENT_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSelect(s)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] transition ${
                s === status
                  ? "bg-gray-50 font-bold"
                  : "hover:bg-gray-50"
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: statusDotColor(s) }}
              />
              <span className="flex-1">{statusLabel(s)}</span>
              {s === status && (
                <Check size={13} className="text-emerald-600 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
