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
  Upload,
  Pencil,
} from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useActiveClientStore } from "@/store/active-client-store";
import { toast } from "@/store/toast-store";
import PageHeader from "@/components/PageHeader";
import StatusToggle from "@/components/clients/StatusToggle";
import type { Client, ClientStatus } from "@/lib/supabase/database.types";
import { migrateLocalStorageToClient } from "@/lib/sync/migrate-local";

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
  const [migrating, setMigrating] = useState(false);

  // Rename popup state — opens when the user clicks the pencil icon on a
  // client card. `editName` / `editNickname` are drafts; saving goes through
  // the standard `update()` mutator so activeClient name label refreshes too.
  const [renameTarget, setRenameTarget] = useState<Client | null>(null);
  const [editName, setEditName] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [renaming, setRenaming] = useState(false);

  const openRename = (c: Client) => {
    setRenameTarget(c);
    setEditName(c.name);
    setEditNickname(c.nickname || "");
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("กรุณาใส่ชื่อ");
      return;
    }
    setRenaming(true);
    try {
      const updated = await update(renameTarget.id, {
        name: trimmed,
        nickname: editNickname.trim() || null,
      });
      // Keep the active-client label in sync so the top-right chip refreshes.
      if (activeClientId === renameTarget.id) {
        setActive(updated.id, updated.name);
      }
      toast.success(`เปลี่ยนชื่อเป็น ${trimmed}`);
      setRenameTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เปลี่ยนชื่อไม่สำเร็จ");
    } finally {
      setRenaming(false);
    }
  };

  /**
   * Pick a default name for a new client — "ลูกค้า N" where N is
   * the smallest positive integer not already in use by an existing
   * "ลูกค้า N" client. Keeps the counter dense even after deletions.
   */
  const pickDefaultName = (): string => {
    const used = new Set<number>();
    for (const c of clients) {
      const m = c.name.trim().match(/^ลูกค้า\s+(\d+)$/);
      if (m) used.add(Number(m[1]));
    }
    let n = 1;
    while (used.has(n)) n++;
    return `ลูกค้า ${n}`;
  };

  const openNewPopup = () => {
    setNewName(pickDefaultName());
    setNewNickname("");
    setShowNewPopup(true);
  };

  const handleCreate = async () => {
    // Fall back to default name if user cleared the field.
    const nameToUse = newName.trim() || pickDefaultName();
    setSubmitting(true);
    try {
      const row = await create({
        name: nameToUse,
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
    router.push(`/clients/${c.id}`);
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

  const handleMigrate = async () => {
    if (!activeClientId) {
      toast.error("กรุณาเลือก client ก่อน");
      return;
    }
    if (
      !confirm(
        "คัดลอกข้อมูลจาก browser เข้าสู่ client ที่กำลังใช้งาน?\n(ข้อมูลเดิมใน client จะถูกทับ)",
      )
    )
      return;
    setMigrating(true);
    try {
      const res = await migrateLocalStorageToClient(activeClientId);
      if (res.migrated.length > 0) {
        toast.success(`นำเข้าข้อมูล: ${res.migrated.join(", ")}`);
      } else {
        toast.info("ไม่มีข้อมูลใน browser ให้นำเข้า");
      }
      if (res.errors.length > 0) {
        toast.error(
          `ผิดพลาด: ${res.errors.map((e) => e.domain).join(", ")}`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "นำเข้าไม่สำเร็จ");
    } finally {
      setMigrating(false);
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

  const handleStatusChange = async (c: Client, next: ClientStatus) => {
    try {
      await update(c.id, { current_status: next });
      // No toast — the badge flip is feedback enough; keeps it lightweight
      // since FAs may flip statuses several times in a row.
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "เปลี่ยนสถานะไม่สำเร็จ",
      );
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="จัดการUser"
        subtitle="Client Manager"
      />

      {/* Active Client Banner */}
      {activeClientId && (
        <div className="mx-4 md:mx-8 mt-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <UserCircle size={18} className="text-indigo-500 shrink-0" />
            <span className="text-xs font-bold text-indigo-700 truncate">
              กำลังทำงาน:{" "}
              {clients.find((c) => c.id === activeClientId)?.name ||
                "(ไม่พบ client)"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleMigrate}
              disabled={migrating}
              title="คัดลอกข้อมูลจาก browser เข้าสู่ client นี้ (ใช้สำหรับย้ายข้อมูลเก่าครั้งเดียว)"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-indigo-700 bg-white border border-indigo-200 rounded-lg px-2 py-1 hover:bg-indigo-100 disabled:opacity-50 transition"
            >
              {migrating ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Upload size={12} />
              )}
              นำเข้าจาก browser
            </button>
            <button
              onClick={clearActive}
              className="text-[13px] text-indigo-600 hover:text-indigo-800 font-medium"
            >
              ยกเลิกเลือก
            </button>
          </div>
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
              <div className="text-[14px] text-gray-500 mb-4">
                เริ่มต้นด้วยการเพิ่ม client คนแรกของคุณ
              </div>
              <button
                onClick={openNewPopup}
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
                      <div className="absolute -top-2 -right-2 bg-indigo-500 text-white text-[13px] font-bold px-2 py-0.5 rounded-full">
                        กำลังใช้งาน
                      </div>
                    )}

                    {!c.can_edit && (
                      <div className="absolute -top-2 -left-2 bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                        👁 อ่านอย่างเดียว
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
                          <div className="text-[13px] text-gray-500 truncate">
                            {c.nickname}
                          </div>
                        )}
                        <div className="text-[13px] text-gray-400">
                          อัพเดท {formatDate(c.updated_at)}
                        </div>
                        {!c.can_edit && c.owner_display_name && (
                          <div className="text-[11px] text-amber-700 mt-0.5 truncate">
                            ของ {c.owner_display_name}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status toggle (Phase 2 manual status — migration 016).
                        Only the owner can mutate; subordinate viewers see a
                        read-only badge instead. */}
                    <div className="mb-3">
                      {c.can_edit ? (
                        <StatusToggle
                          status={c.current_status ?? "appointment"}
                          onChange={(next) => handleStatusChange(c, next)}
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap px-2.5 py-1 text-[11px] bg-gray-100 text-gray-600">
                          {c.current_status ?? "appointment"}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpen(c)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition"
                      >
                        <FolderOpen size={13} />
                        {c.can_edit ? "เปิด" : "ดู"}
                      </button>
                      <button
                        onClick={() => c.can_edit && openRename(c)}
                        disabled={!c.can_edit}
                        className="p-2 rounded-lg text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-300 disabled:hover:bg-transparent"
                        title="เปลี่ยนชื่อ"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => c.can_edit && handleArchive(c)}
                        disabled={!c.can_edit}
                        className="p-2 rounded-lg text-gray-300 hover:text-amber-600 hover:bg-amber-50 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-300 disabled:hover:bg-transparent"
                        title="จัดเก็บ"
                      >
                        <Archive size={14} />
                      </button>
                      <button
                        onClick={() => c.can_edit && setDeleteConfirm(c)}
                        disabled={!c.can_edit}
                        className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-300 disabled:hover:bg-transparent"
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
                onClick={openNewPopup}
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
            <div className="text-[13px] text-gray-400 mb-3">
              กดบันทึกได้เลย หรือแก้ชื่อก่อนก็ได้ (แก้ภายหลังได้)
            </div>
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              className="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 transition mb-2"
              placeholder="ชื่อ-นามสกุล"
              disabled={submitting}
            />
            <input
              type="text"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
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
                disabled={submitting}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5 ${
                  submitting
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-indigo-500 text-white hover:bg-indigo-600"
                }`}
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Client Popup */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => !renaming && setRenameTarget(null)}
        >
          <div
            className="glass rounded-2xl p-5 mx-6 w-full max-w-xs md:max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-bold text-gray-700 mb-1">
              เปลี่ยนชื่อ client
            </div>
            <div className="text-[13px] text-gray-400 mb-3">
              แก้ชื่อหรือชื่อเล่นได้ตามต้องการ
            </div>
            <input
              type="text"
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setRenameTarget(null);
              }}
              className="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 transition mb-2"
              placeholder="ชื่อ-นามสกุล"
              disabled={renaming}
            />
            <input
              type="text"
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setRenameTarget(null);
              }}
              className="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 transition mb-3"
              placeholder="ชื่อเล่น (ไม่บังคับ)"
              disabled={renaming}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRenameTarget(null)}
                disabled={renaming}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleRename}
                disabled={renaming}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5 ${
                  renaming
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-indigo-500 text-white hover:bg-indigo-600"
                }`}
              >
                {renaming && <Loader2 size={14} className="animate-spin" />}
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
