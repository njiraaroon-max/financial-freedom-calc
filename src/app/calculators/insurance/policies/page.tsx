"use client";

import { useState } from "react";
import { Plus, Save, Pencil, Trash2, X, ChevronUp, ChevronDown } from "lucide-react";
import {
  useInsuranceStore,
  POLICY_GROUP_OPTIONS,
  InsurancePolicy,
  PolicyGroup,
} from "@/store/insurance-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import ThaiDatePicker from "@/components/ThaiDatePicker";

function fmt(n: number): string {
  if (n === 0) return "";
  return Math.round(n).toLocaleString("th-TH");
}

function parseNum(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}

function fmtComma(n: number): string {
  return n ? n.toLocaleString("th-TH") : "";
}

function MoneyInput({
  label,
  value,
  onChange,
  placeholder = "0",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [display, setDisplay] = useState(() => {
    const n = parseNum(value);
    return n ? fmtComma(n) : value;
  });

  return (
    <div>
      <label className="text-[11px] text-gray-500 mb-1 block font-semibold">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        value={focused ? display : (parseNum(display) ? fmtComma(parseNum(display)) : display)}
        onChange={(e) => {
          setDisplay(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => {
          setFocused(true);
          const n = parseNum(display);
          setDisplay(n ? String(n) : "");
        }}
        onBlur={() => {
          setFocused(false);
          const n = parseNum(display);
          setDisplay(n ? fmtComma(n) : "");
        }}
        className="w-full text-sm font-semibold bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-400 border border-gray-200"
        placeholder={placeholder}
      />
    </div>
  );
}

interface PolicyForm {
  policyNumber: string;
  company: string;
  planName: string;
  group: PolicyGroup;
  startDate: string;
  endDate: string;
  lastPayDate: string;
  sumInsured: string;
  cashValue: string;
  premium: string;
  details: string;
  notes: string;
}

const defaultForm = (): PolicyForm => ({
  policyNumber: "",
  company: "",
  planName: "",
  group: "health",
  startDate: "",
  endDate: "",
  lastPayDate: "",
  sumInsured: "",
  cashValue: "",
  premium: "",
  details: "",
  notes: "",
});

export default function PoliciesPage() {
  const { policies, addPolicy, updatePolicy, removePolicy, reorderPolicies, markStepCompleted } =
    useInsuranceStore();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<PolicyForm>(defaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);

  const sorted = [...policies].sort((a, b) => a.order - b.order);

  const totalPremium = policies.reduce((s, p) => s + p.premium, 0);
  const totalSumInsured = policies.reduce((s, p) => s + p.sumInsured, 0);
  const totalCashValue = policies.reduce((s, p) => s + p.cashValue, 0);

  function openAdd() {
    setForm(defaultForm());
    setEditingId(null);
    setShowModal(true);
  }

  function openEdit(p: InsurancePolicy) {
    setForm({
      policyNumber: p.policyNumber,
      company: p.company,
      planName: p.planName,
      group: p.group,
      startDate: p.startDate,
      endDate: p.endDate,
      lastPayDate: p.lastPayDate,
      sumInsured: p.sumInsured ? String(p.sumInsured) : "",
      cashValue: p.cashValue ? String(p.cashValue) : "",
      premium: p.premium ? String(p.premium) : "",
      details: p.details,
      notes: p.notes,
    });
    setEditingId(p.id);
    setShowModal(true);
  }

  const [formError, setFormError] = useState("");

  function handleSavePolicy() {
    // Validation
    if (!form.planName.trim() && !form.company.trim()) {
      setFormError("กรุณากรอกชื่อแบบประกันหรือบริษัท");
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setFormError("วันครบสัญญาต้องหลังวันเริ่มคุ้มครอง");
      return;
    }
    setFormError("");

    const payload = {
      policyNumber: form.policyNumber,
      company: form.company,
      planName: form.planName || "ไม่ระบุชื่อ",
      group: form.group,
      startDate: form.startDate,
      endDate: form.endDate,
      lastPayDate: form.lastPayDate,
      sumInsured: Math.max(0, parseNum(form.sumInsured)),
      cashValue: Math.max(0, parseNum(form.cashValue)),
      premium: Math.max(0, parseNum(form.premium)),
      details: form.details,
      notes: form.notes,
    };

    if (editingId) {
      updatePolicy(editingId, payload);
    } else {
      addPolicy(payload);
    }
    setShowModal(false);
  }

  function movePolicy(idx: number, direction: "up" | "down") {
    const arr = [...sorted];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= arr.length) return;
    [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
    reorderPolicies(arr.map((p) => p.id));
  }

  function handleFinalSave() {
    markStepCompleted("policies");
    setHasSaved(true);
    setTimeout(() => {
      window.location.href = "/calculators/insurance";
    }, 500);
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="สรุปกรมธรรม์ที่มีอยู่"
        subtitle="Insurance Policies"
        backHref="/calculators/insurance"
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-4">
        {/* Summary bar */}
        {policies.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[10px] text-gray-400">ทุนประกันรวม</div>
                <div className="text-sm font-extrabold text-emerald-600">฿{fmt(totalSumInsured)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">มูลค่าเวนคืนรวม</div>
                <div className="text-sm font-extrabold text-gray-700">฿{fmt(totalCashValue)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">เบี้ยรวม/ปี</div>
                <div className="text-sm font-extrabold text-orange-600">฿{fmt(totalPremium)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Policy list */}
        {sorted.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
            <div className="text-sm font-bold text-gray-500 mb-1">ยังไม่มีกรมธรรม์</div>
            <div className="text-xs text-gray-400">กดปุ่มด้านล่างเพื่อเพิ่มกรมธรรม์</div>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((p, idx) => {
              const groupLabel = POLICY_GROUP_OPTIONS.find((g) => g.value === p.group)?.label || p.group;
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-3">
                  <div className="flex items-start gap-2">
                    {/* Sort */}
                    <div className="flex flex-col items-center gap-0 pt-1">
                      <button onClick={() => movePolicy(idx, "up")} disabled={idx === 0} className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20"><ChevronUp size={12} className="text-gray-500" /></button>
                      <div className="text-[10px] font-bold text-gray-400">{idx + 1}</div>
                      <button onClick={() => movePolicy(idx, "down")} disabled={idx === sorted.length - 1} className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20"><ChevronDown size={12} className="text-gray-500" /></button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">{groupLabel}</span>
                        <span className="text-[10px] text-gray-400">{p.company}</span>
                      </div>
                      <div className="text-xs font-bold text-gray-800 truncate">{p.planName}</div>
                      {p.policyNumber && <div className="text-[10px] text-gray-400">เลขกรมธรรม์: {p.policyNumber}</div>}
                      <div className="flex gap-4 mt-1.5 text-[10px]">
                        <div><span className="text-gray-400">ทุน </span><span className="font-bold text-gray-700">฿{fmt(p.sumInsured)}</span></div>
                        <div><span className="text-gray-400">เบี้ย </span><span className="font-bold text-orange-600">฿{fmt(p.premium)}</span></div>
                        {p.cashValue > 0 && <div><span className="text-gray-400">เวนคืน </span><span className="font-bold text-gray-600">฿{fmt(p.cashValue)}</span></div>}
                      </div>
                      {p.notes && <div className="text-[10px] text-gray-400 mt-1 truncate">{p.notes}</div>}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(p)} className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                        <Pencil size={12} className="text-gray-500" />
                      </button>
                      <button
                        onClick={() => {
                          if (deleteConfirmId === p.id) {
                            removePolicy(p.id);
                            setDeleteConfirmId(null);
                          } else {
                            setDeleteConfirmId(p.id);
                          }
                        }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center ${deleteConfirmId === p.id ? "bg-red-500" : "bg-gray-100"}`}
                      >
                        <Trash2 size={12} className={deleteConfirmId === p.id ? "text-white" : "text-gray-400"} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add button */}
        <button
          onClick={openAdd}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-emerald-400 text-emerald-700 text-sm font-bold active:scale-[0.98] transition-all hover:bg-emerald-50"
        >
          <Plus size={18} />
          เพิ่มกรมธรรม์
        </button>

        {/* Save */}
        {policies.length > 0 && (
          <ActionButton
            label="บันทึกข้อมูลกรมธรรม์"
            successLabel="บันทึกแล้ว"
            onClick={handleFinalSave}
            hasCompleted={hasSaved}
            variant="primary"
            icon={<Save size={16} />}
          />
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-3xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h3 className="text-base font-extrabold text-gray-800">
                {editingId ? "แก้ไขกรมธรรม์" : "เพิ่มกรมธรรม์"}
              </h3>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {/* กลุ่มกรมธรรม์ */}
              <div>
                <label className="text-[11px] text-gray-500 mb-1.5 block font-semibold">กลุ่มกรมธรรม์</label>
                <div className="flex flex-wrap gap-1.5">
                  {POLICY_GROUP_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setForm({ ...form, group: opt.value })}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                        form.group === opt.value
                          ? "bg-emerald-600 text-white shadow"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* บริษัท + เลขกรมธรรม์ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block font-semibold">บริษัทประกัน</label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-400 border border-gray-200"
                    placeholder="เช่น AIA, FWD"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block font-semibold">เลขกรมธรรม์</label>
                  <input
                    type="text"
                    value={form.policyNumber}
                    onChange={(e) => setForm({ ...form, policyNumber: e.target.value })}
                    className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-400 border border-gray-200"
                    placeholder="ไม่บังคับ"
                  />
                </div>
              </div>

              {/* ชื่อแบบ */}
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block font-semibold">ชื่อแบบสัญญาประกันภัยหลัก</label>
                <input
                  type="text"
                  value={form.planName}
                  onChange={(e) => setForm({ ...form, planName: e.target.value })}
                  className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-400 border border-gray-200"
                  placeholder="เช่น AIA Health Happy 5 ล้าน"
                />
              </div>

              {/* วันที่ */}
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block font-semibold">วันเริ่มคุ้มครอง</label>
                  <ThaiDatePicker value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} label="วันเริ่มคุ้มครอง" minYear={2500} maxYear={2620} />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block font-semibold">วันครบสัญญา</label>
                  <ThaiDatePicker value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} label="วันครบสัญญา" minYear={2500} maxYear={2650} />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block font-semibold">ชำระเบี้ยถึง</label>
                  <ThaiDatePicker value={form.lastPayDate} onChange={(v) => setForm({ ...form, lastPayDate: v })} label="ชำระเบี้ยถึง" minYear={2500} maxYear={2650} />
                </div>
              </div>

              {/* ตัวเลข */}
              <div className="grid grid-cols-3 gap-2">
                <MoneyInput
                  label="ทุนประกัน"
                  value={form.sumInsured}
                  onChange={(v) => setForm({ ...form, sumInsured: v })}
                />
                <MoneyInput
                  label="มูลค่าเวนคืน"
                  value={form.cashValue}
                  onChange={(v) => setForm({ ...form, cashValue: v })}
                />
                <MoneyInput
                  label="เบี้ยประกัน/ปี"
                  value={form.premium}
                  onChange={(v) => setForm({ ...form, premium: v })}
                />
              </div>

              {/* รายละเอียด */}
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block font-semibold">รายละเอียดเพิ่มเติม</label>
                <textarea
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                  className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-400 border border-gray-200 h-16 resize-none"
                  placeholder="เช่น IPD เหมาจ่าย 5 ล้าน ค่าห้อง 3000"
                />
              </div>

              {/* หมายเหตุ */}
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block font-semibold">หมายเหตุ</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-400 border border-gray-200"
                  placeholder="ไม่บังคับ"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 space-y-2">
              {formError && (
                <div className="text-xs text-red-500 font-medium bg-red-50 rounded-xl px-3 py-2">{formError}</div>
              )}
              <button
                onClick={handleSavePolicy}
                className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm active:scale-[0.98] transition-all hover:bg-emerald-700"
              >
                {editingId ? "บันทึกการแก้ไข" : "เพิ่มกรมธรรม์"}
              </button>
              {editingId && (
                <button
                  onClick={() => {
                    if (deleteConfirmId === editingId) {
                      removePolicy(editingId);
                      setShowModal(false);
                      setDeleteConfirmId(null);
                    } else {
                      setDeleteConfirmId(editingId);
                    }
                  }}
                  className={`w-full py-2.5 rounded-2xl text-sm font-bold transition-all ${
                    deleteConfirmId === editingId
                      ? "bg-red-500 text-white"
                      : "bg-red-50 text-red-500"
                  }`}
                >
                  {deleteConfirmId === editingId ? "ยืนยันลบ" : "ลบกรมธรรม์นี้"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
