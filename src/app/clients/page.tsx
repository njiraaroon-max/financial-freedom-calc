"use client";

/**
 * /clients — list + CRUD for the FA's clients.
 *
 * Phase C: Supabase-backed. Create/rename/archive/delete all hit the
 * DB via RLS-protected queries. Clicking "เปิด" sets the active
 * client (stored in a cookie + localStorage via useActiveClientStore)
 * but does NOT yet swap plan data per client — that's Phase D, where
 * each Zustand store scopes its read/write to the active client id.
 *
 * Until Phase D lands, a banner on this page reminds the FA that
 * plan data is still shared across clients.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  UserCircle,
  FolderOpen,
  Loader2,
  Archive,
  AlertTriangle,
} from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useActiveClientStore } from "@/store/active-client-store";
import { toast } from "@/store/toast-store";
import PageHeader from "@/components/PageHeader";
import type { Client } from "@/lib/supabase/database.types";

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

export default function ClientsPage() {
  const router = useRouter();
  const { clients, loading, error, create, update, remove } = useClients();
  const { activeClientId, setActive, clearActive } = useActiveClientStore();

  const [showNewPopup, setShowNewPopup] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Client | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      const row = await create({
        name: newName.trim(),
        nickname: newNickname.trim() || null,
      });
      toast.success(`เพิ่ม ${row.name} เรียบร้อย`);
      setActive(row.id, row.name);
      setNewName("");
      setNewNickname("");
      setShowNewPopup(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เพิ่ม client ไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpen = (c: Client) => {
    setActive(c.id, c.name);
    toast.success(`เปิดข้อมูล ${c.name}`);
    router.push("/");
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm.id;
    try {
      await remove(id);
      if (activeClientId === id) clearActive();
      toast.success(`ลบ ${deleteConfirm.name} แล้ว`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleArchive = async (c: Client) => {
    try {
      await update(c.id, { status: "archived" });
      if (activeClientId === c.id) clearActive();
      toast.success(`จัดเก็บ ${c.name} แล้ว`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "จัดเก็บไม่สำเร็จ");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="จัดการUser"
        subtitle="Client Manager"
      />

      {/* Phase D warning */}
      <div className="mx-4 md:mx-8 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-[11px] text-amber-800">
          <b>หมายเหตุ (Phase C):</b> การสร้าง/ลบ client ใช้ database จริงแล้ว
          แต่ข้อมูลแผน (รายรับ-รายจ่าย, เกษียณ, ประกัน) ยังใช้ browser storage
          — ยังไม่แยกตาม client จนกว่า Phase D จะเสร็จ
        </div>
      </div>

      {/* Active Client Banner */}
      {activeClientId && (
        <div className="mx-4 md:mx-8 mt-3 p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCircle size={18} className="text-indigo-500" />
            <span className="text-xs font-bold text-indigo-700">
              กำลังทำงาน:{" "}
              {clients.find((c) => c.id === activeClientId)?.name ||
                "(ไม่พบ client)"}
            </span>
          </div>
          <button
            onClick={clearActive}
            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium"
          >
            ยกเลิกเลือก
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-4 md:mx-8 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          ⚠️ {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="px-4 md:px-8 pt-6 flex items-center gap-2 text-xs text-gray-500">
          <Loader2 size={14} className="animate-spin" />
          กำลังโหลดรายชื่อ client...
        </div>
      )}

      {/* Client Grid */}
      {!loading && (
        <div className="px-4 md:px-8 pt-4 pb-8">
          {clients.length === 0 && (
            <div className="glass rounded-2xl p-8 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 rounded-full mb-3">
                <UserCircle size={28} className="text-indigo-400" />
              </div>
              <div className="text-sm font-bold text-gray-700 mb-1">
                ยังไม่มี client
              </div>
              <div className="text-[11px] text-gray-500 mb-4">
                เริ่มต้นด้วยการเพิ่ม client คนแรกของคุณ
              </div>
              <button
                onClick={() => setShowNewPopup(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-600 transition"
              >
                <Plus size={14} /> เพิ่ม client
              </button>
            </div>
          )}

          {clients.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {clients.map((c) => {
                const isActive = c.id === activeClientId;
                return (
                  <div
                    key={c.id}
                    className={`relative bg-white rounded-2xl border-2 p-4 transition-all ${
                      isActive
                        ? "border-indigo-400 shadow-md shadow-indigo-100"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute -top-2 -right-2 bg-indigo-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        กำลังใช้งาน
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isActive ? "bg-indigo-100" : "bg-gray-100"
                        }`}
                      >
                        <UserCircle
                          size={22}
                          className={
                            isActive ? "text-indigo-500" : "text-gray-400"
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">
                          {c.name}
                        </div>
                        {c.nickname && (
                          <div className="text-[10px] text-gray-500 truncate">
                            {c.nickname}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-400">
                          อัพเดท {formatDate(c.updated_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpen(c)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition"
                      >
                        <FolderOpen size={13} />
                        เปิด
                      </button>
                      <button
                        onClick={() => handleArchive(c)}
                        className="p-2 rounded-lg text-gray-300 hover:text-amber-600 hover:bg-amber-50 transition"
                        title="จัดเก็บ"
                      >
                        <Archive size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(c)}
                        className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                        title="ลบ"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Add New Client Card */}
              <button
                onClick={() => setShowNewPopup(true)}
                className="glass rounded-2xl border-2 border-dashed border-gray-300 p-4 flex flex-col items-center justify-center gap-2 hover:border-indigo-400 hover:bg-indigo-50/30 active:scale-95 transition-all min-h-[160px]"
              >
                <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
                  <Plus size={24} className="text-indigo-500" />
                </div>
                <span className="text-xs font-bold text-gray-500">
                  เพิ่ม client ใหม่
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* New Client Popup */}
      {showNewPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => !submitting && setShowNewPopup(false)}
        >
          <div
            className="glass rounded-2xl p-5 mx-6 w-full max-w-xs md:max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-bold text-gray-700 mb-1">
              เพิ่ม client ใหม่
            </div>
            <div className="text-[10px] text-gray-400 mb-3">
              กรอกชื่อเพื่อเริ่มต้น (แก้ไขรายละเอียดเพิ่มภายหลังได้)
            </div>
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 transition mb-2"
              placeholder="ชื่อ-นามสกุล"
              disabled={submitting}
            />
            <input
              type="text"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) handleCreate();
              }}
              className="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 transition mb-3"
              placeholder="ชื่อเล่น (ไม่บังคับ)"
              disabled={submitting}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewPopup(false)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || submitting}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5 ${
                  newName.trim() && !submitting
                    ? "bg-indigo-500 text-white hover:bg-indigo-600"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Popup */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="glass rounded-2xl p-5 mx-6 w-full max-w-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-bold text-gray-700 mb-2">ลบ client</div>
            <div className="text-xs text-gray-500 mb-4">
              ต้องการลบ &quot;{deleteConfirm.name}&quot; ใช่ไหม?
              <br />
              ข้อมูลทั้งหมดของ client คนนี้จะถูกลบอย่างถาวร
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition"
              >
                ลบถาวร
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
