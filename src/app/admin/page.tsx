"use client";

/**
 * /admin — super-admin dashboard. Middleware blocks non-admin users.
 *
 * Features (MVP):
 *  - Stats row: total FAs, pending, approved, rejected, total clients
 *  - FA table: email, name, role, status, #clients, join date
 *  - Actions per row: approve, reject, reset password, toggle admin
 *
 * Lives on RLS + role='admin' policies from migration 004; no
 * service-role key required.
 */

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  KeyRound,
  Users,
  Loader2,
  RefreshCw,
  UserCog,
} from "lucide-react";
import {
  listAllFas,
  getAdminStats,
  setFaStatus,
  setFaRole,
  sendResetEmail,
  type FaAdminRow,
  type AdminStats,
} from "@/lib/supabase/admin";
import { toast } from "@/store/toast-store";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return "-";
  }
}

function StatusBadge({ status }: { status: FaAdminRow["status"] }) {
  const styles: Record<FaAdminRow["status"], string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    rejected: "bg-rose-100 text-rose-700 border-rose-200",
  };
  const labels: Record<FaAdminRow["status"], string> = {
    pending: "รออนุมัติ",
    approved: "อนุมัติแล้ว",
    rejected: "ปฏิเสธ",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export default function AdminPage() {
  const [fas, setFas] = useState<FaAdminRow[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [rows, s] = await Promise.all([listAllFas(), getAdminStats()]);
      setFas(rows);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleApprove = async (row: FaAdminRow) => {
    setBusyId(row.user_id);
    try {
      await setFaStatus(row.user_id, "approved");
      toast.success(`อนุมัติ ${row.email}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อนุมัติไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (row: FaAdminRow) => {
    if (!confirm(`ปฏิเสธบัญชี ${row.email}?`)) return;
    setBusyId(row.user_id);
    try {
      await setFaStatus(row.user_id, "rejected");
      toast.success(`ปฏิเสธ ${row.email}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ปฏิเสธไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const handleResetPw = async (row: FaAdminRow) => {
    if (!confirm(`ส่งลิงก์รีเซ็ตรหัสผ่านไปที่ ${row.email}?`)) return;
    setBusyId(row.user_id);
    try {
      await sendResetEmail(row.email);
      toast.success(`ส่งลิงก์ไปที่ ${row.email} แล้ว`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ส่งไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleAdmin = async (row: FaAdminRow) => {
    const next = row.role === "admin" ? "fa" : "admin";
    if (
      !confirm(
        next === "admin"
          ? `เลื่อนสถานะ ${row.email} เป็น Admin?`
          : `ถอดสถานะ Admin ของ ${row.email}?`,
      )
    )
      return;
    setBusyId(row.user_id);
    try {
      await setFaRole(row.user_id, next);
      toast.success(`เปลี่ยนสิทธิ์ ${row.email} เป็น ${next}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เปลี่ยนสิทธิ์ไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      {/* Header */}
      <div className="px-4 md:px-8 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
            <p className="text-xs text-gray-500">
              จัดการ FA ทั้งหมด + อนุมัติการสมัคร
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition"
        >
          {refreshing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="px-4 md:px-8 mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          label="FA ทั้งหมด"
          value={stats?.totalFas ?? 0}
          icon={<Users size={16} />}
          color="bg-indigo-500"
        />
        <StatCard
          label="รออนุมัติ"
          value={stats?.pending ?? 0}
          icon={<Clock size={16} />}
          color="bg-amber-500"
        />
        <StatCard
          label="อนุมัติแล้ว"
          value={stats?.approved ?? 0}
          icon={<CheckCircle2 size={16} />}
          color="bg-emerald-500"
        />
        <StatCard
          label="ปฏิเสธ"
          value={stats?.rejected ?? 0}
          icon={<XCircle size={16} />}
          color="bg-rose-500"
        />
        <StatCard
          label="Client รวม"
          value={stats?.totalClients ?? 0}
          icon={<Users size={16} />}
          color="bg-sky-500"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 md:mx-8 mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      <div className="px-4 md:px-8 pb-8">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-gray-500 py-6">
            <Loader2 size={14} className="animate-spin" />
            กำลังโหลด...
          </div>
        ) : fas.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-gray-500">
            ยังไม่มี FA ในระบบ
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-medium">อีเมล</th>
                    <th className="text-left px-3 py-2.5 font-medium">ชื่อ</th>
                    <th className="text-left px-3 py-2.5 font-medium">บริษัท</th>
                    <th className="text-center px-3 py-2.5 font-medium">
                      สิทธิ์
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium">
                      สถานะ
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium">
                      Clients
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium">สมัคร</th>
                    <th className="text-right px-3 py-2.5 font-medium">
                      การจัดการ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fas.map((row) => {
                    const busy = busyId === row.user_id;
                    return (
                      <tr
                        key={row.user_id}
                        className={`${
                          row.status === "pending" ? "bg-amber-50/30" : ""
                        } hover:bg-gray-50`}
                      >
                        <td className="px-3 py-2.5 font-medium text-gray-800">
                          {row.email}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">
                          {row.display_name || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">
                          {row.company || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              row.role === "admin"
                                ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                                : "bg-gray-100 text-gray-600 border-gray-200"
                            }`}
                          >
                            {row.role}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-3 py-2.5 text-center font-medium text-gray-700">
                          {row.client_count}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {row.status !== "approved" && (
                              <button
                                onClick={() => handleApprove(row)}
                                disabled={busy}
                                title="อนุมัติ"
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 transition"
                              >
                                <CheckCircle2 size={14} />
                              </button>
                            )}
                            {row.status !== "rejected" && (
                              <button
                                onClick={() => handleReject(row)}
                                disabled={busy}
                                title="ปฏิเสธ"
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition"
                              >
                                <XCircle size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleResetPw(row)}
                              disabled={busy}
                              title="ส่งลิงก์รีเซ็ตรหัสผ่าน"
                              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition"
                            >
                              <KeyRound size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleAdmin(row)}
                              disabled={busy}
                              title={
                                row.role === "admin"
                                  ? "ถอดสิทธิ์ admin"
                                  : "เลื่อนเป็น admin"
                              }
                              className={`p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition ${
                                row.role === "admin"
                                  ? "text-indigo-600"
                                  : "text-gray-500"
                              }`}
                            >
                              <UserCog size={14} />
                            </button>
                            {busy && (
                              <Loader2
                                size={13}
                                className="animate-spin text-gray-400 ml-1"
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3">
      <div className="flex items-center gap-2 mb-1">
        <div
          className={`w-7 h-7 rounded-lg ${color} text-white flex items-center justify-center`}
        >
          {icon}
        </div>
        <span className="text-[11px] text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
    </div>
  );
}
