"use client";

import { useState, useEffect } from "react";
import { Save, User, Briefcase, Heart, Calendar, Banknote, Clock, ShieldCheck, Trash2 } from "lucide-react";
import { useProfileStore, OCCUPATION_OPTIONS, MARITAL_OPTIONS } from "@/store/profile-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import type { OccupationType, MaritalStatus } from "@/store/profile-store";

function fmt(n: number): string {
  if (n === 0) return "";
  return n.toLocaleString("th-TH");
}

function parseNum(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}

interface DraftProfile {
  name: string;
  birthDate: string;
  occupation: OccupationType;
  maritalStatus: MaritalStatus;
  numberOfChildren: number;
  salary: number;
  salaryCap: number;
  retireAge: number;
  yearsWorked: number;
  socialSecurityMonths: number;
}

export default function PersonalInfoPage() {
  const profile = useProfileStore();

  const [draft, setDraft] = useState<DraftProfile>({
    name: profile.name,
    birthDate: profile.birthDate,
    occupation: profile.occupation,
    maritalStatus: profile.maritalStatus,
    numberOfChildren: profile.numberOfChildren,
    salary: profile.salary,
    salaryCap: profile.salaryCap,
    retireAge: profile.retireAge,
    yearsWorked: profile.yearsWorked,
    socialSecurityMonths: profile.socialSecurityMonths,
  });

  const [hasSaved, setHasSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const s = useProfileStore.getState();
      setDraft({
        name: s.name,
        birthDate: s.birthDate,
        occupation: s.occupation,
        maritalStatus: s.maritalStatus,
        numberOfChildren: s.numberOfChildren,
        salary: s.salary,
        salaryCap: s.salaryCap,
        retireAge: s.retireAge,
        yearsWorked: s.yearsWorked,
        socialSecurityMonths: s.socialSecurityMonths,
      });
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const updateDraft = <K extends keyof DraftProfile>(key: K, value: DraftProfile[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setHasSaved(false);
  };

  const draftAge = draft.birthDate
    ? Math.floor((Date.now() - new Date(draft.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 0;

  const handleSave = () => {
    profile.updateProfile("name", draft.name);
    profile.updateProfile("birthDate", draft.birthDate);
    profile.updateProfile("occupation", draft.occupation);
    profile.updateProfile("maritalStatus", draft.maritalStatus);
    profile.updateProfile("numberOfChildren", draft.numberOfChildren);
    profile.updateProfile("salary", draft.salary);
    profile.updateProfile("salaryCap", draft.salaryCap);
    profile.updateProfile("retireAge", draft.retireAge);
    profile.updateProfile("yearsWorked", draft.yearsWorked);
    profile.updateProfile("socialSecurityMonths", draft.socialSecurityMonths);
    setHasSaved(true);
    setHasChanges(false);
    setTimeout(() => {
      window.location.href = "/";
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="ข้อมูลส่วนตัว"
        subtitle="Personal Info"
        characterImg="/circle-icons/profile.png"
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-4">

        {hasChanges && !hasSaved && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 font-medium text-center">
            มีการแก้ไขที่ยังไม่ได้บันทึก — กดปุ่ม &quot;บันทึก&quot; ด้านล่างเพื่อยืนยัน
          </div>
        )}

        {/* === ข้อมูลทั่วไป === */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <User size={16} className="text-[var(--color-primary)]" />
            ข้อมูลทั่วไป
          </div>

          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">ชื่อ-นามสกุล</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => updateDraft("name", e.target.value)}
              className="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="เช่น สมชาย ใจดี"
            />
          </div>

          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">
              <Calendar size={11} className="inline mr-1" />
              วันเกิด
            </label>
            <input
              type="date"
              value={draft.birthDate}
              onChange={(e) => updateDraft("birthDate", e.target.value)}
              className="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            {draftAge > 0 && (
              <div className="text-[10px] text-[var(--color-primary)] font-medium mt-1">
                อายุปัจจุบัน: {draftAge} ปี
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] text-gray-500 mb-2 block">
              <Heart size={11} className="inline mr-1" />
              สถานภาพ
            </label>
            <div className="flex gap-2 flex-wrap">
              {MARITAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateDraft("maritalStatus", opt.value as MaritalStatus)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    draft.maritalStatus === opt.value
                      ? "bg-[var(--color-primary)] text-white shadow"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {draft.maritalStatus === "married_with_children" && (
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">จำนวนบุตร</label>
              <div className="flex items-center gap-3">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => updateDraft("numberOfChildren", n)}
                    className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                      draft.numberOfChildren === n
                        ? "bg-[var(--color-primary)] text-white shadow"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* === ข้อมูลอาชีพ === */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <Briefcase size={16} className="text-amber-500" />
            ข้อมูลอาชีพ
          </div>

          <div>
            <label className="text-[11px] text-gray-500 mb-2 block">ประเภทอาชีพ</label>
            <div className="space-y-2">
              {OCCUPATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateDraft("occupation", opt.value as OccupationType)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                    draft.occupation === opt.value
                      ? "border-[var(--color-primary)] bg-indigo-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    draft.occupation === opt.value
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                      : "border-gray-300"
                  }`}>
                    {draft.occupation === opt.value && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-700">{opt.label}</div>
                    <div className="text-[10px] text-gray-400">{opt.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">
              <Banknote size={11} className="inline mr-1" />
              เงินเดือน (บาท/เดือน)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={fmt(draft.salary)}
              onChange={(e) => updateDraft("salary", parseNum(e.target.value))}
              className="w-full text-sm font-semibold bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="เช่น 50,000"
            />
          </div>

          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">
              เพดานเงินเดือนสูงสุด (บาท/เดือน)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={fmt(draft.salaryCap)}
              onChange={(e) => updateDraft("salaryCap", parseNum(e.target.value))}
              className="w-full text-sm font-semibold bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="ไม่มีเพดาน (ว่างไว้)"
            />
            <div className="text-[9px] text-gray-400 mt-1">ถ้าไม่มีเพดาน ไม่ต้องกรอก</div>
          </div>

          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">อายุที่ต้องการเกษียณ</label>
            <div className="flex items-center gap-2">
              {[55, 60, 65].map((a) => (
                <button
                  key={a}
                  onClick={() => updateDraft("retireAge", a)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    draft.retireAge === a
                      ? "bg-[var(--color-primary)] text-white shadow"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {a} ปี
                </button>
              ))}
              <input
                type="number"
                value={![55, 60, 65].includes(draft.retireAge) ? draft.retireAge : ""}
                onChange={(e) => updateDraft("retireAge", Number(e.target.value) || 60)}
                className="w-16 text-sm font-semibold bg-gray-50 rounded-xl px-2 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-center"
                placeholder="อื่นๆ"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">
              <Clock size={11} className="inline mr-1" />
              ทำงานมาแล้ว (ปี)
            </label>
            <input
              type="number"
              value={draft.yearsWorked || ""}
              onChange={(e) => updateDraft("yearsWorked", Number(e.target.value) || 0)}
              className="w-full text-sm font-semibold bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="เช่น 5"
            />
          </div>

          {draft.occupation === "private" && (
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">
                <ShieldCheck size={11} className="inline mr-1" />
                ส่งประกันสังคมมาแล้ว (เดือน)
              </label>
              <input
                type="number"
                value={draft.socialSecurityMonths || ""}
                onChange={(e) => updateDraft("socialSecurityMonths", Number(e.target.value) || 0)}
                className="w-full text-sm font-semibold bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="เช่น 60"
              />
              {draft.yearsWorked > 0 && draft.socialSecurityMonths === 0 && (
                <button
                  onClick={() => updateDraft("socialSecurityMonths", draft.yearsWorked * 12)}
                  className="mt-1 text-[10px] text-indigo-500 hover:text-indigo-700"
                >
                  ≈ ประมาณ {draft.yearsWorked * 12} เดือน (กดเพื่อใช้ค่านี้)
                </button>
              )}
            </div>
          )}
        </div>

        {/* สรุป */}
        {draftAge > 0 && (
          <div className="bg-gradient-to-br from-indigo-500 to-purple-700 rounded-2xl p-4 text-white">
            <div className="text-xs opacity-70 mb-2">สรุปข้อมูล {hasChanges && !hasSaved ? "(ยังไม่ได้บันทึก)" : ""}</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/15 rounded-lg p-2">
                <div className="opacity-70 text-[10px]">อายุ</div>
                <div className="font-bold">{draftAge} ปี</div>
              </div>
              <div className="bg-white/15 rounded-lg p-2">
                <div className="opacity-70 text-[10px]">เกษียณ</div>
                <div className="font-bold">{draft.retireAge} ปี (อีก {draft.retireAge - draftAge} ปี)</div>
              </div>
              <div className="bg-white/15 rounded-lg p-2">
                <div className="opacity-70 text-[10px]">อาชีพ</div>
                <div className="font-bold">{OCCUPATION_OPTIONS.find((o) => o.value === draft.occupation)?.label}</div>
              </div>
              <div className="bg-white/15 rounded-lg p-2">
                <div className="opacity-70 text-[10px]">เงินเดือน</div>
                <div className="font-bold">฿{fmt(draft.salary)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm active:scale-[0.98] transition-all ${
            hasSaved
              ? "bg-green-100 text-green-700 border border-green-300 shadow-none"
              : hasChanges
                ? "bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-200 animate-pulse"
                : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] shadow-lg shadow-indigo-200"
          }`}
        >
          {hasSaved ? "บันทึกแล้ว" : hasChanges ? <><Save size={18} /> บันทึกการเปลี่ยนแปลง</> : <><Save size={18} /> บันทึก</>}
        </button>

        <ActionButton
          label="ล้างข้อมูลทั้งหมด (Reset)"
          onClick={() => {
            if (confirm("ต้องการล้างข้อมูลทั้งหมดของลูกค้านี้ใช่ไหม?\n\nข้อมูลที่จะถูกล้าง:\n• ข้อมูลส่วนตัว\n• งบกระแสเงินสด\n• งบดุล\n• แผนเกษียณ\n• ตัวแปรที่บันทึกไว้\n\nข้อมูลจะกลับเป็นค่าเริ่มต้นทั้งหมด")) {
              const storeKeys = ["ffc-profile", "ffc-cashflow", "ffc-balance-sheet", "ffc-retirement", "ffc-variables", "ffc-goals"];
              storeKeys.forEach((key) => localStorage.removeItem(key));
              window.location.reload();
            }
          }}
          variant="danger"
          icon={<Trash2 size={16} />}
        />
      </div>
    </div>
  );
}
