"use client";

/**
 * StatusBadge — small pill rendering one of the 7 client statuses
 * (migration 016). Display-only. For an interactive picker use
 * <StatusToggle /> in the same folder.
 */

import type { ClientStatus } from "@/lib/supabase/database.types";

interface StatusMeta {
  label: string;
  fg: string;
  bg: string;
  dot: string;
}

const STATUS_META: Record<ClientStatus, StatusMeta> = {
  appointment:  { label: "นัดทำแผน",         fg: "#92400e", bg: "#fef3c7", dot: "#fbbf24" },
  fact_finding: { label: "เก็บข้อมูล",        fg: "#9a3412", bg: "#ffedd5", dot: "#f59e0b" },
  proposed:     { label: "นำเสนอแผน",        fg: "#1e3a8a", bg: "#dbeafe", dot: "#3b82f6" },
  done:         { label: "Done",              fg: "#065f46", bg: "#d1fae5", dot: "#10b981" },
  follow:       { label: "Follow",            fg: "#5b21b6", bg: "#ede9fe", dot: "#8b5cf6" },
  deny:         { label: "Deny",              fg: "#475569", bg: "#f1f5f9", dot: "#94a3b8" },
  other:        { label: "Other",             fg: "#475569", bg: "#f1f5f9", dot: "#cbd5e1" },
};

export function statusLabel(s: ClientStatus): string {
  return STATUS_META[s].label;
}

export function statusDotColor(s: ClientStatus): string {
  return STATUS_META[s].dot;
}

export default function StatusBadge({
  status,
  size = "md",
}: {
  status: ClientStatus;
  size?: "sm" | "md";
}) {
  const meta = STATUS_META[status];
  const isSmall = size === "sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap ${
        isSmall ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      }`}
      style={{ background: meta.bg, color: meta.fg }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: meta.dot }}
      />
      {meta.label}
    </span>
  );
}
