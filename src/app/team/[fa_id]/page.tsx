"use client";

/**
 * /team/[fa_id] — drill-down view of a single subordinate.
 *
 * Replaces the old "everything in /clients" approach where Pro/Ultra
 * had every visible client crammed into one list. The flow is now:
 *
 *   /team        → list of subordinates
 *   /team/[id]   → THIS page: that subordinate's profile + their
 *                  clients (read-only)
 *   /clients/[id] → opens an individual client in read-only mode
 *
 * Visibility uses the existing list_visible_clients RPC from
 * migration 021 — filtering client-side by fa_user_id is fine at
 * Phase 1 scale (<= a few thousand visible clients per Ultra).
 */

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  AlertCircle,
  Loader2,
  UserCircle,
  ChevronRight,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/clients/StatusBadge";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { useFaSessionStore } from "@/store/fa-session-store";
import type { ClientStatus } from "@/lib/supabase/database.types";

interface VisibleClient {
  id: string;
  fa_user_id: string;
  name: string;
  nickname: string | null;
  current_status: ClientStatus;
  status_note: string | null;
  status_updated_at: string;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  can_edit: boolean;
  owner_display_name: string | null;
  owner_fa_code: string | null;
}

interface FaPublic {
  user_id: string;
  display_name: string | null;
  email: string;
  fa_code: string;
  tier: "basic" | "pro" | "ultra";
}

export default function TeamFaDetailPage({
  params,
}: {
  params: Promise<{ fa_id: string }>;
}) {
  const { fa_id: faId } = use(params);
  const session = useFaSessionStore((s) => s.session);
  const sessionLoading = useFaSessionStore((s) => s.loading);

  const [fa, setFa] = useState<FaPublic | null>(null);
  const [clients, setClients] = useState<VisibleClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Look up FA identity + their clients in parallel
  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseClient();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, clientsRes] = await Promise.all([
          (
            supabase.rpc as unknown as (
              fn: string,
              args: Record<string, unknown>,
            ) => Promise<{
              data: FaPublic[] | null;
              error: { message: string } | null;
            }>
          )("fa_lookup_public", { target_id: faId }),
          (
            supabase.rpc as unknown as (
              fn: string,
            ) => Promise<{
              data: VisibleClient[] | null;
              error: { message: string } | null;
            }>
          )("list_visible_clients"),
        ]);
        if (cancelled) return;
        if (profileRes.error) throw profileRes.error;
        if (clientsRes.error) throw clientsRes.error;
        const profile = profileRes.data?.[0];
        if (!profile) {
          setError("ไม่พบ FA หรือคุณไม่มีสิทธิ์เข้าถึง");
          return;
        }
        setFa(profile);
        // Filter all visible clients down to just this FA's
        setClients(
          (clientsRes.data ?? []).filter((c) => c.fa_user_id === faId),
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "ไม่สามารถโหลดข้อมูลได้");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [faId]);

  // Tier gate — only logged-in FAs (the underlying RPCs gate further
  // by visibility). Basic FAs hitting this URL won't have anyone visible
  // to them anyway.
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }
  if (!session) return null;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of clients) {
      counts[c.current_status] = (counts[c.current_status] ?? 0) + 1;
    }
    return counts;
  }, [clients]);

  return (
    <div className="min-h-screen" style={{ background: "#fafaf7" }}>
      <PageHeader
        title="ลูกค้าของสมาชิกในทีม"
        subtitle="อ่านอย่างเดียว — Monitor view"
      />

      <main className="max-w-5xl mx-auto px-5 md:px-8 py-6 space-y-5">
        <Link
          href="/team"
          className="inline-flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-700 transition"
        >
          <ArrowLeft size={14} /> กลับไป /team
        </Link>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {loading ? (
          <div className="text-[13px] text-gray-400">กำลังโหลด...</div>
        ) : fa ? (
          <>
            {/* FA profile card */}
            <section className="rounded-2xl bg-white border border-gray-100 p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-base font-bold text-gray-500 flex-shrink-0">
                  {(fa.display_name ?? fa.email).slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-gray-800">
                    {fa.display_name ?? fa.email}
                  </div>
                  <div className="text-[12px] text-gray-500 flex items-center gap-2 mt-0.5">
                    <span>{tierLabel(fa.tier)}</span>
                    <span className="text-gray-300">·</span>
                    <span className="font-mono text-gray-400">{fa.fa_code}</span>
                    <span className="text-gray-300">·</span>
                    <span>{fa.email}</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                  <Eye size={11} /> Read-only
                </span>
              </div>
            </section>

            {/* Status summary */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="ลูกค้าทั้งหมด"
                value={clients.length}
                accent="var(--brand-primary)"
              />
              <StatCard
                label="นัดทำแผน"
                value={statusCounts.appointment ?? 0}
                accent="#f59e0b"
              />
              <StatCard
                label="Follow"
                value={statusCounts.follow ?? 0}
                accent="#8b5cf6"
              />
              <StatCard
                label="Done"
                value={statusCounts.done ?? 0}
                accent="#10b981"
              />
            </section>

            {/* Client list */}
            <section className="rounded-2xl bg-white border border-gray-100 p-5">
              <header className="mb-4">
                <h2 className="text-sm font-bold text-gray-700">
                  ลูกค้าของ {fa.display_name ?? fa.email}
                </h2>
                <div className="text-[11px] text-gray-400 mt-1">
                  คลิกเพื่อเปิด — อ่านอย่างเดียว
                </div>
              </header>

              {clients.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-[13px] text-gray-500">
                  FA คนนี้ยังไม่มีลูกค้า
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {clients.map((c) => (
                    <Link
                      key={c.id}
                      href={`/clients/${c.id}`}
                      className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-gray-50/50 -mx-2 px-2 rounded-lg transition"
                    >
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <UserCircle
                          size={18}
                          className="text-gray-400"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800 truncate">
                          {c.name}
                          {c.nickname && (
                            <span className="text-gray-500 font-normal ml-1">
                              ({c.nickname})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          อัพเดท {formatDate(c.updated_at)}
                        </div>
                      </div>
                      <StatusBadge
                        status={(c.current_status ?? "appointment") as ClientStatus}
                        size="sm"
                      />
                      <ChevronRight
                        size={14}
                        className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-4">
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function tierLabel(t: "basic" | "pro" | "ultra"): string {
  if (t === "ultra") return "FA Ultra";
  if (t === "pro") return "FA Pro";
  return "FA";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return "—";
  }
}
