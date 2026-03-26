"use client";

import { useState } from "react";
import { Plus, Trash2, UserCircle, FolderOpen, Save } from "lucide-react";
import { useClientManagerStore } from "@/store/client-manager-store";
import PageHeader from "@/components/PageHeader";

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  } catch {
    return "-";
  }
}

export default function ClientsPage() {
  const {
    clients,
    activeClientId,
    saveCurrentAsClient,
    updateClient,
    loadClient,
    deleteClient,
    createNewClient,
    getClientProgress,
  } = useClientManagerStore();

  const [showNewPopup, setShowNewPopup] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleSaveNew = () => {
    if (!newName.trim()) return;
    saveCurrentAsClient(newName.trim());
    setNewName("");
    setShowNewPopup(false);
  };

  const handleSaveCurrent = () => {
    if (activeClientId) {
      updateClient(activeClientId);
      alert("บันทึกข้อมูลUserเรียบร้อย!");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="จัดการUser"
        subtitle="Client Manager"
        rightElement={
          activeClientId ? (
            <button
              onClick={handleSaveCurrent}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition"
            >
              <Save size={14} />
              บันทึกUserปัจจุบัน
            </button>
          ) : undefined
        }
      />

      {/* Active Client Banner */}
      {activeClientId && (
        <div className="mx-4 md:mx-8 mt-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200">
          <div className="flex items-center gap-2">
            <UserCircle size={18} className="text-indigo-500" />
            <span className="text-xs font-bold text-indigo-700">
              กำลังทำงาน: {clients.find((c) => c.id === activeClientId)?.name || "ไม่ระบุ"}
            </span>
          </div>
        </div>
      )}

      {/* Client Grid */}
      <div className="px-4 md:px-8 pt-4 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Existing Clients */}
          {clients.map((client) => {
            const progress = getClientProgress(client.id);
            const isActive = client.id === activeClientId;

            return (
              <div
                key={client.id}
                className={`relative bg-white rounded-2xl border-2 p-4 transition-all ${
                  isActive
                    ? "border-indigo-400 shadow-md shadow-indigo-100"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {/* Active badge */}
                {isActive && (
                  <div className="absolute -top-2 -right-2 bg-indigo-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                    กำลังใช้งาน
                  </div>
                )}

                {/* Avatar */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isActive ? "bg-indigo-100" : "bg-gray-100"
                  }`}>
                    <UserCircle size={22} className={isActive ? "text-indigo-500" : "text-gray-400"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{client.name || "ไม่ระบุชื่อ"}</div>
                    <div className="text-[10px] text-gray-400">อัพเดท {formatDate(client.updatedAt)}</div>
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-500">ความคืบหน้า</span>
                    <span className={`text-[10px] font-bold ${
                      progress >= 80 ? "text-emerald-600" : progress >= 40 ? "text-amber-600" : "text-gray-400"
                    }`}>{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progress >= 80 ? "bg-emerald-500" : progress >= 40 ? "bg-amber-500" : "bg-gray-300"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {!isActive ? (
                    <button
                      onClick={() => loadClient(client.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition"
                    >
                      <FolderOpen size={13} />
                      เปิด
                    </button>
                  ) : (
                    <>
                    <button
                      onClick={() => { window.location.href = "/"; }}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition"
                    >
                      <FolderOpen size={13} />
                      เปิด
                    </button>
                    <button
                      onClick={handleSaveCurrent}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold hover:bg-emerald-100 transition"
                    >
                      <Save size={13} />
                      บันทึก
                    </button>
                    </>
                  )}
                  <button
                    onClick={() => setDeleteConfirm(client.id)}
                    className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
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
            className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-4 flex flex-col items-center justify-center gap-2 hover:border-indigo-400 hover:bg-indigo-50/30 active:scale-95 transition-all min-h-[180px]"
          >
            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
              <Plus size={24} className="text-indigo-500" />
            </div>
            <span className="text-xs font-bold text-gray-500">เพิ่มUserใหม่</span>
          </button>
        </div>
      </div>

      {/* New Client Popup */}
      {showNewPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowNewPopup(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-5 mx-6 w-full max-w-xs md:max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-bold text-gray-700 mb-1">เพิ่มUserใหม่</div>
            <div className="text-[10px] text-gray-400 mb-3">ข้อมูลปัจจุบันจะถูกบันทึกเป็นUserคนนี้</div>
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveNew(); }}
              className="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition mb-3"
              placeholder="ชื่อUser"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowNewPopup(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition">
                ยกเลิก
              </button>
              <button
                onClick={handleSaveNew}
                disabled={!newName.trim()}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                  newName.trim() ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Popup */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-5 mx-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-bold text-gray-700 mb-2">ลบUser</div>
            <div className="text-xs text-gray-500 mb-4">
              ต้องการลบ &quot;{clients.find((c) => c.id === deleteConfirm)?.name}&quot; ใช่ไหม?
              <br />ข้อมูลทั้งหมดจะถูกลบและไม่สามารถกู้คืนได้
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition">
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  deleteClient(deleteConfirm);
                  setDeleteConfirm(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition"
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
