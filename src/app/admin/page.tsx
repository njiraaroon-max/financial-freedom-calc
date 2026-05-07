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
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  KeyRound,
  Users,
  Loader2,
  RefreshCw,
  Building2,
  Palette,
  Sliders,
  X,
} from "lucide-react";
import {
  listAllFas,
  listOrganizations,
  getAdminStats,
  setFaStatus,
  setFaRole,
  setFaExpiresAt,
  setFaSkin,
  setFaOrganization,
  setFaFeatures,
  sendResetEmail,
  type FaAdminRow,
  type AdminStats,
  type OrganizationRow,
} from "@/lib/supabase/admin";
import type { FeatureFlags, Skin } from "@/lib/supabase/database.types";
import { toast } from "@/store/toast-store";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
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

/** Convert ISO timestamp to yyyy-MM-dd for <input type="date"> */
function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

/** Days remaining until ISO date (negative if past). null if no date. */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function ExpiryBadge({ iso }: { iso: string | null }) {
  const days = daysUntil(iso);
  if (days === null)
    return (
      <span className="text-[13px] text-gray-400">ไม่หมดอายุ</span>
    );
  if (days < 0)
    return (
      <span className="text-[13px] font-medium text-rose-700 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded-full">
        หมดอายุแล้ว
      </span>
    );
  const cls =
    days <= 7
      ? "text-rose-700 bg-rose-100 border-rose-200"
      : days <= 30
        ? "text-amber-700 bg-amber-100 border-amber-200"
        : "text-emerald-700 bg-emerald-100 border-emerald-200";
  return (
    <span
      className={`text-[13px] font-medium border px-1.5 py-0.5 rounded-full ${cls}`}
    >
      เหลือ {days} วัน
    </span>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "ยังไม่มีข้อมูล";
  const diffMs = Date.now() - new Date(iso).getTime();
  const day = Math.floor(diffMs / 86400000);
  if (day < 1) return "วันนี้";
  if (day < 7) return `${day} วันที่แล้ว`;
  if (day < 30) return `${Math.floor(day / 7)} สัปดาห์ที่แล้ว`;
  if (day < 365) return `${Math.floor(day / 30)} เดือนที่แล้ว`;
  return `${Math.floor(day / 365)} ปีที่แล้ว`;
}

function ActivityBar({ pct }: { pct: number }) {
  const color =
    pct >= 70
      ? "bg-emerald-500"
      : pct >= 30
        ? "bg-amber-500"
        : "bg-rose-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className="text-[13px] text-gray-600 tabular-nums">{pct}%</span>
    </div>
  );
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
      className={`inline-block px-2 py-0.5 rounded-full text-[13px] font-medium border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export default function AdminPage() {
  const [fas, setFas] = useState<FaAdminRow[]>([]);
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [featuresModal, setFeaturesModal] = useState<FaAdminRow | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [rows, orgRows, s] = await Promise.all([
        listAllFas(),
        listOrganizations(),
        getAdminStats(),
      ]);
      setFas(rows);
      setOrgs(orgRows);
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

  const handleExpiryChange = async (row: FaAdminRow, value: string) => {
    // value = "" → clear (never expires); else yyyy-MM-dd → end of day UTC
    const nextIso = value ? new Date(value + "T23:59:59").toISOString() : null;
    setBusyId(row.user_id);
    try {
      await setFaExpiresAt(row.user_id, nextIso);
      toast.success(
        nextIso
          ? `ตั้งวันหมดอายุ ${row.email}`
          : `ยกเลิกวันหมดอายุ ${row.email}`,
      );
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ตั้งวันหมดอายุไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const handleSkinChange = async (row: FaAdminRow, next: Skin) => {
    if (next === row.skin) return;
    setBusyId(row.user_id);
    try {
      await setFaSkin(row.user_id, next);
      toast.success(
        `เปลี่ยน skin ของ ${row.email} เป็น ${next === "professional" ? "Professional" : "Legacy"}`,
      );
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เปลี่ยน skin ไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const handleOrgChange = async (row: FaAdminRow, nextOrgId: string) => {
    if (nextOrgId === row.organization_id) return;
    const nextOrg = orgs.find((o) => o.id === nextOrgId);
    // Skin follows org by default (DB trigger sync_skin_with_org). Tell
    // the admin up-front so the auto-flip isn't a surprise.
    const skinNote =
      nextOrg && nextOrg.default_skin !== row.skin
        ? `\n\nSkin จะเปลี่ยนเป็น "${nextOrg.default_skin === "professional" ? "Professional" : "Legacy"}" อัตโนมัติตาม default ของ org นี้`
        : "";
    if (
      !confirm(
        `ย้าย ${row.email} ไปยังองค์กร "${nextOrg?.name ?? nextOrgId}"?${skinNote}`,
      )
    )
      return;
    setBusyId(row.user_id);
    try {
      await setFaOrganization(row.user_id, nextOrgId);
      toast.success(`ย้าย ${row.email} เรียบร้อย`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ย้ายองค์กรไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const handleFeaturesSave = async (
    row: FaAdminRow,
    features: FeatureFlags,
  ) => {
    setBusyId(row.user_id);
    try {
      await setFaFeatures(row.user_id, features);
      toast.success(`อัปเดต features ของ ${row.email}`);
      setFeaturesModal(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึก features ไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const handleRoleChange = async (row: FaAdminRow, next: "fa" | "admin") => {
    if (next === row.role) return;
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
        <div className="flex items-center gap-2">
          <Link
            href="/admin/org-chart"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            <Users size={13} />
            ผังองค์กร
          </Link>
          <Link
            href="/admin/organizations"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            <Building2 size={13} />
            จัดการองค์กร
          </Link>
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

      {/* Features modal */}
      {featuresModal && (
        <FeaturesModal
          row={featuresModal}
          busy={busyId === featuresModal.user_id}
          onClose={() => setFeaturesModal(null)}
          onSave={(features) => handleFeaturesSave(featuresModal, features)}
        />
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
                    <th className="text-left px-3 py-2.5 font-medium">
                      องค์กร
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium">
                      สิทธิ์
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium">Skin</th>
                    <th className="text-center px-3 py-2.5 font-medium">
                      Features
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium">
                      สถานะ
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium">
                      Clients
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium">
                      Active 30 วัน
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium">
                      กิจกรรมล่าสุด
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium">สมัคร</th>
                    <th className="text-left px-3 py-2.5 font-medium">
                      วันหมดอายุ
                    </th>
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
                        <td className="px-3 py-2.5">
                          <select
                            value={row.organization_id}
                            disabled={busy || orgs.length === 0}
                            onChange={(e) =>
                              handleOrgChange(row, e.target.value)
                            }
                            className="text-[13px] rounded-lg px-2 py-1 border border-gray-200 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 cursor-pointer max-w-[180px]"
                            title={row.organization_name ?? ""}
                          >
                            {orgs.length === 0 && (
                              <option value={row.organization_id}>
                                {row.organization_name ?? "-"}
                              </option>
                            )}
                            {orgs.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <select
                            value={row.role}
                            disabled={busy}
                            onChange={(e) =>
                              handleRoleChange(
                                row,
                                e.target.value as "fa" | "admin",
                              )
                            }
                            className={`text-[13px] font-medium rounded-full px-2 py-1 border outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 cursor-pointer ${
                              row.role === "admin"
                                ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                                : "bg-gray-100 text-gray-600 border-gray-200"
                            }`}
                          >
                            <option value="fa">fa</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <select
                            value={row.skin}
                            disabled={busy}
                            onChange={(e) =>
                              handleSkinChange(row, e.target.value as Skin)
                            }
                            className={`text-[13px] font-medium rounded-full px-2 py-1 border outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 cursor-pointer ${
                              row.skin === "professional"
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-gray-100 text-gray-600 border-gray-200"
                            }`}
                          >
                            <option value="legacy">Legacy</option>
                            <option value="professional">Professional</option>
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <FeaturesSummaryButton
                            features={row.features}
                            disabled={busy}
                            onClick={() => setFeaturesModal(row)}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-3 py-2.5 text-center font-medium text-gray-700">
                          {row.client_count}
                        </td>
                        <td className="px-3 py-2.5">
                          {row.client_count > 0 ? (
                            <ActivityBar pct={row.active_pct} />
                          ) : (
                            <span className="text-[13px] text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[14px] text-gray-500">
                          {formatRelative(row.last_activity)}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-1">
                            <input
                              type="date"
                              value={toDateInputValue(row.expires_at)}
                              disabled={busy || row.role === "admin"}
                              onChange={(e) =>
                                handleExpiryChange(row, e.target.value)
                              }
                              className="text-[13px] px-1.5 py-0.5 rounded border border-gray-200 bg-white text-gray-700 disabled:opacity-50 focus:ring-2 focus:ring-indigo-300 outline-none"
                              title={
                                row.role === "admin"
                                  ? "Admin ไม่ใช้วันหมดอายุ"
                                  : "เลือกวันหมดอายุ"
                              }
                            />
                            {row.role === "admin" ? (
                              <span className="text-[13px] text-indigo-500">
                                Admin (ไม่หมดอายุ)
                              </span>
                            ) : (
                              <ExpiryBadge iso={row.expires_at} />
                            )}
                          </div>
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

// ─── Features ──────────────────────────────────────────────────────────
// Known flags rendered as toggles; unknown/extra keys are preserved
// on save (so flags added later via DB aren't nuked by the UI).
//
// `defaultTrue` flags treat `undefined` / missing as ENABLED — used for
// access gates we don't want to silently lock out on existing FAs
// (e.g. planning modes). Explicit `false` turns them off.

type FeatureFlagDef = {
  key: keyof FeatureFlags;
  label: string;
  hint?: string;
  defaultTrue?: boolean;
};

const FEATURE_GROUPS: { title: string; flags: FeatureFlagDef[] }[] = [
  {
    title: "Planning modes",
    flags: [
      {
        key: "mode_modular_enabled",
        label: "Modular mode",
        hint: "วางแผนเฉพาะเรื่อง — 5 เครื่องมือ",
        defaultTrue: true,
      },
      {
        key: "mode_comprehensive_enabled",
        label: "Comprehensive mode",
        hint: "วางแผนครบวงจร — 12 เครื่องมือ",
        defaultTrue: true,
      },
    ],
  },
  {
    title: "Exports",
    flags: [
      {
        key: "report_pdf",
        label: "Export PDF report",
        hint: "ปุ่ม PRINT/PDF ในหน้า /report — ปิดเพื่อไม่ให้ FA print แผน",
        defaultTrue: true,
      },
      {
        key: "export_excel",
        label: "Export Excel",
        hint: "ยังไม่มี feature นี้ในระบบ — placeholder สำหรับอนาคต",
      },
    ],
  },
  {
    title: "Advanced tools",
    flags: [
      {
        key: "ci_shock_simulator",
        label: "CI Shock simulator",
        hint: "หน้า /calculators/insurance/ci-shock — เทียบเงินสะสม CI48 vs Multi-Care",
        defaultTrue: true,
      },
      {
        key: "allianz_deep_data",
        label: "Allianz deep data",
        hint: "CI / OPD compare tabs ใน /policies?tab=compare + หน้า ci-needs",
        defaultTrue: true,
      },
      {
        key: "multi_insurer_compare",
        label: "Multi-insurer compare",
        hint: "เปรียบเทียบ bundle ข้าม insurer (เพิ่ม/ลบ bundle ใน compare workspace)",
        defaultTrue: true,
      },
    ],
  },
  {
    title: "Sales tools",
    flags: [
      {
        key: "victory_insurance_tools",
        label: "Victory Insurance Tools (Pyramid)",
        hint: "เปลี่ยน Modular mode เป็น Pyramid 5 ชั้น (Emergency / Life / Health / Saving / Legacy) — Victory เปิดเป็น default",
      },
      {
        key: "health_savings_combo",
        label: "Health + Savings Combo",
        hint: "HSMHPDC × MDP 25/20 — เครื่องมือปิดการขาย (Victory เปิดเป็น default)",
      },
    ],
  },
  {
    title: "Branding",
    flags: [
      {
        key: "custom_branding",
        label: "Custom branding",
        hint: "ยังไม่มี UI — placeholder สำหรับ FA upload โลโก้เอง",
      },
    ],
  },
];

/** Resolve a flag value honoring its defaultTrue policy. */
function flagValue(
  features: FeatureFlags | null | undefined,
  def: FeatureFlagDef,
): boolean {
  const v = features?.[def.key];
  if (typeof v === "boolean") return v;
  return def.defaultTrue === true; // undefined/null/non-bool → default
}

function countEnabledFeatures(features: FeatureFlags | null | undefined): number {
  let n = 0;
  for (const group of FEATURE_GROUPS) {
    for (const f of group.flags) {
      if (flagValue(features, f)) n++;
    }
  }
  return n;
}

/** Summarise non-mode features as "on/total" so the table cell can show "5/6". */
function countNonModeFeatures(features: FeatureFlags | null | undefined) {
  let on = 0;
  let total = 0;
  for (const group of FEATURE_GROUPS) {
    if (group.title === "Planning modes") continue;
    for (const f of group.flags) {
      total++;
      if (flagValue(features, f)) on++;
    }
  }
  return { on, total };
}

/**
 * Features cell — shows Modular / Comprehensive mode state with pills
 * (green=on, gray=off) plus a compact count of other features. The whole
 * block is the click target that opens the full FeaturesModal.
 */
function FeaturesSummaryButton({
  features,
  disabled,
  onClick,
}: {
  features: FeatureFlags | null | undefined;
  disabled: boolean;
  onClick: () => void;
}) {
  const modularOn = flagValue(features, {
    key: "mode_modular_enabled",
    label: "",
    defaultTrue: true,
  });
  const compOn = flagValue(features, {
    key: "mode_comprehensive_enabled",
    label: "",
    defaultTrue: true,
  });
  const { on, total } = countNonModeFeatures(features);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title="คลิกเพื่อแก้ไข features"
      className="group inline-flex flex-col items-start gap-1 px-2 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 transition text-left"
    >
      {/* Mode pills */}
      <div className="flex items-center gap-1">
        <ModePill label="Modular" short="M" on={modularOn} />
        <ModePill label="Comprehensive" short="C" on={compOn} />
      </div>
      {/* Other features count */}
      <div className="flex items-center gap-1 text-[11px] text-gray-500 pl-0.5">
        <Sliders size={10} />
        <span className="tabular-nums">
          <span className="font-semibold text-gray-700">{on}</span>
          <span className="text-gray-400">/{total}</span> features
        </span>
      </div>
    </button>
  );
}

function ModePill({
  label,
  short,
  on,
}: {
  label: string;
  short: string;
  on: boolean;
}) {
  return (
    <span
      title={`${label}: ${on ? "เปิดใช้งาน" : "ปิด"}`}
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border ${
        on
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-gray-100 text-gray-400 border-gray-200 line-through"
      }`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          on ? "bg-emerald-500" : "bg-gray-300"
        }`}
      />
      <span className="leading-none">{short}</span>
    </span>
  );
}

function FeaturesModal({
  row,
  busy,
  onClose,
  onSave,
}: {
  row: FaAdminRow;
  busy: boolean;
  onClose: () => void;
  onSave: (features: FeatureFlags) => void;
}) {
  // Start from the row's current flags so unknown keys are preserved.
  const [draft, setDraft] = useState<FeatureFlags>({ ...row.features });
  const clientLimit = typeof draft.client_limit === "number"
    ? draft.client_limit
    : 999;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <Sliders size={14} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">
                Features
              </div>
              <div className="text-[11px] text-gray-500">{row.email}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {FEATURE_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.flags.map((f) => {
                  const on = flagValue(draft, f);
                  return (
                    <label
                      key={String(f.key)}
                      className="flex items-center justify-between gap-3 py-1.5 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-gray-700">{f.label}</div>
                        {f.hint && (
                          <div className="text-[11px] text-gray-400">
                            {f.hint}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({ ...d, [f.key]: !on }))
                        }
                        className={`relative shrink-0 w-10 h-6 rounded-full transition ${
                          on ? "bg-indigo-500" : "bg-gray-200"
                        }`}
                        aria-pressed={on}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            on ? "translate-x-4" : ""
                          }`}
                        />
                      </button>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="pt-2 border-t border-gray-100">
            <label className="block">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700">Client limit</span>
                <span className="text-[11px] text-gray-400">
                  999 = ไม่จำกัด
                </span>
              </div>
              <input
                type="number"
                min={0}
                value={clientLimit}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    client_limit: Number(e.target.value) || 0,
                  }))
                }
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </label>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => onSave(draft)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 transition"
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            บันทึก
          </button>
        </div>
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
        <span className="text-[14px] text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
    </div>
  );
}
