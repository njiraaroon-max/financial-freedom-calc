"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Save, Calculator, Download, Info, X, Plus, Pencil, Trash2, Building2, ChevronDown, ChevronUp } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import PageHeader from "@/components/PageHeader";
import MoneyInput from "@/components/MoneyInput";
import { useVariableStore } from "@/store/variable-store";
import { useProfileStore } from "@/store/profile-store";
import {
  useInsuranceStore,
  InsurancePolicy,
  AnnuityDetails,
  DEFAULT_ANNUITY_DETAILS,
} from "@/store/insurance-store";
import { toast } from "@/store/toast-store";

const BE_OFFSET = 543;

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}

function parseNum(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}

function commaInput(n: number): string {
  if (n === 0) return "";
  return n.toLocaleString("th-TH");
}

// PV function: fv / (1+rate)^nper
function pvCalc(rate: number, nper: number, pmt: number): number {
  if (nper <= 0) return pmt;
  return pmt / Math.pow(1 + rate, nper);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM STATE
// ═══════════════════════════════════════════════════════════════════════════════
interface AnnuityFormState {
  company: string;
  planName: string;
  policyNumber: string;
  startDate: string;
  premium: string;
  annuityDetails: AnnuityDetails;
  notes: string;
}

const defaultAnnuityForm = (): AnnuityFormState => ({
  company: "",
  planName: "",
  policyNumber: "",
  startDate: "",
  premium: "",
  annuityDetails: { ...DEFAULT_ANNUITY_DETAILS, payoutStartAge: 60, payoutEndAge: 85 },
  notes: "",
});

// ═══════════════════════════════════════════════════════════════════════════════
// POLICY CARD — compact pension card
// ═══════════════════════════════════════════════════════════════════════════════
function PensionPolicyCard({
  policy,
  onEdit,
  onDelete,
}: {
  policy: InsurancePolicy;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ad = policy.annuityDetails || DEFAULT_ANNUITY_DETAILS;
  const years = ad.payoutEndAge > ad.payoutStartAge ? ad.payoutEndAge - ad.payoutStartAge + 1 : 0;
  const lifetimeTotal = ad.payoutPerYear * years;

  return (
    <div className="glass rounded-xl border border-purple-100 overflow-hidden">
      <div className="p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center text-white shrink-0">
          <Building2 size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-800 truncate">{policy.planName || "ประกันบำนาญ"}</div>
          <div className="text-[12px] text-gray-400">{policy.company || "ไม่ระบุบริษัท"}</div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="w-7 h-7 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 flex items-center justify-center transition"
            aria-label="แก้ไข"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition"
            aria-label="ลบ"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div className="px-3 pb-3 pt-0 border-t border-gray-50">
        <div className="grid grid-cols-2 gap-2 text-[12px] mt-2">
          <div className="bg-purple-50/50 rounded-lg p-2">
            <div className="text-gray-400">เริ่มรับบำนาญอายุ</div>
            <div className="font-bold text-purple-700">{ad.payoutStartAge || "-"} ปี</div>
          </div>
          <div className="bg-purple-50/50 rounded-lg p-2">
            <div className="text-gray-400">รับถึงอายุ</div>
            <div className="font-bold text-purple-700">
              {ad.payoutEndAge ? `${ad.payoutEndAge} ปี` : "ตลอดชีพ"}
            </div>
          </div>
          <div className="bg-purple-50/50 rounded-lg p-2">
            <div className="text-gray-400">บำนาญ/ปี</div>
            <div className="font-bold text-gray-800">฿{fmtShort(ad.payoutPerYear)}</div>
          </div>
          <div className="bg-purple-50/50 rounded-lg p-2">
            <div className="text-gray-400">เบี้ย/ปี</div>
            <div className="font-bold text-gray-800">฿{fmtShort(policy.premium)}</div>
          </div>
        </div>
        {lifetimeTotal > 0 && (
          <div className="text-[12px] text-gray-400 mt-2 text-center">
            คาดรับทั้งหมด ฿{fmt(lifetimeTotal)} ({years} ปี)
          </div>
        )}
        {policy.notes && (
          <div className="text-[12px] text-gray-400 mt-1 text-center italic">{policy.notes}</div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD/EDIT ANNUITY MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function AnnuityModal({
  open,
  editingId,
  initialForm,
  onClose,
  onSave,
}: {
  open: boolean;
  editingId: string | null;
  initialForm: AnnuityFormState;
  onClose: () => void;
  onSave: (form: AnnuityFormState) => void;
}) {
  const [form, setForm] = useState<AnnuityFormState>(initialForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(initialForm);
      setError("");
    }
  }, [open, initialForm]);

  if (!open) return null;

  const handleSave = () => {
    if (!form.planName.trim() && !form.company.trim()) {
      setError("กรุณาใส่ชื่อแผนประกันหรือบริษัท");
      return;
    }
    if (form.annuityDetails.payoutPerYear <= 0) {
      setError("กรุณาใส่จำนวนเงินบำนาญต่อปี");
      return;
    }
    onSave(form);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-md md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white px-5 py-3 flex items-center justify-between z-10 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Building2 size={18} />
            <h3 className="text-sm font-bold">
              {editingId ? "แก้ไขกรมธรรม์บำนาญ" : "เพิ่มกรมธรรม์บำนาญ"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white"
            aria-label="ปิด"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Locked type hint */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 text-[12px] text-purple-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            ประเภท: <strong>บำนาญ (Annuity)</strong> · หมวด: <strong>ประกันชีวิต</strong>
          </div>

          {/* Plan Name */}
          <div>
            <label className="text-[12px] font-bold text-gray-500 uppercase mb-1 block">
              ชื่อแผนประกัน
            </label>
            <input
              type="text"
              value={form.planName}
              onChange={(e) => setForm({ ...form, planName: e.target.value })}
              placeholder="เช่น บำนาญสุขใจ 60/85"
              className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-400 border border-gray-200"
              autoFocus
            />
          </div>

          {/* Company */}
          <div>
            <label className="text-[12px] font-bold text-gray-500 uppercase mb-1 block">
              บริษัทประกัน
            </label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="เช่น AIA, FWD, Allianz Ayudhya"
              className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-400 border border-gray-200"
            />
          </div>

          {/* Policy Number */}
          <div>
            <label className="text-[12px] font-bold text-gray-500 uppercase mb-1 block">
              เลขที่กรมธรรม์ (ถ้ามี)
            </label>
            <input
              type="text"
              value={form.policyNumber}
              onChange={(e) => setForm({ ...form, policyNumber: e.target.value })}
              placeholder="เลขที่กรมธรรม์"
              className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-400 border border-gray-200"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="text-[12px] font-bold text-gray-500 uppercase mb-1 block">
              วันเริ่มต้นสัญญา
            </label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-400 border border-gray-200"
            />
          </div>

          {/* Premium */}
          <div>
            <label className="text-[12px] font-bold text-gray-500 uppercase mb-1 block">
              เบี้ยที่จ่าย/ปี
            </label>
            <MoneyInput
              value={parseNum(form.premium)}
              onChange={(v) => setForm({ ...form, premium: v > 0 ? commaInput(v) : "" })}
              unit="บาท"
              placeholder="เช่น 100,000"
              className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 border border-gray-200 text-center font-bold"
              ringClass="focus:ring-purple-400"
            />
          </div>

          {/* ── Annuity Details ── */}
          <div className="border border-purple-200 bg-purple-50/30 rounded-xl p-3 space-y-3">
            <div className="text-[12px] font-bold text-purple-700 uppercase">ข้อมูลบำนาญ</div>

            {/* Payout per year */}
            <div>
              <label className="text-[13px] text-gray-500 mb-1 block">บำนาญที่รับ/ปี *</label>
              <MoneyInput
                value={form.annuityDetails.payoutPerYear || 0}
                onChange={(v) =>
                  setForm({
                    ...form,
                    annuityDetails: {
                      ...form.annuityDetails,
                      payoutPerYear: v,
                    },
                  })
                }
                unit="บาท"
                placeholder="เช่น 120,000"
                className="glass flex-1 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 text-center font-bold"
                ringClass="focus:ring-purple-400"
              />
            </div>

            {/* Start age */}
            <div>
              <label className="text-[13px] text-gray-500 mb-1 block">อายุเริ่มรับบำนาญ *</label>
              <div className="flex items-center gap-2">
                {[55, 60, 65].map((age) => (
                  <button
                    key={age}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        annuityDetails: { ...form.annuityDetails, payoutStartAge: age },
                      })
                    }
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      form.annuityDetails.payoutStartAge === age
                        ? "bg-purple-500 text-white shadow"
                        : "bg-white border border-gray-200 text-gray-500 hover:border-purple-300"
                    }`}
                  >
                    {age} ปี
                  </button>
                ))}
                <input
                  type="text"
                  inputMode="numeric"
                  value={
                    ![55, 60, 65].includes(form.annuityDetails.payoutStartAge)
                      ? form.annuityDetails.payoutStartAge
                      : ""
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      annuityDetails: {
                        ...form.annuityDetails,
                        payoutStartAge: parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0,
                      },
                    })
                  }
                  className="glass w-14 text-sm font-bold rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-purple-400 text-center"
                  placeholder="อื่นๆ"
                />
              </div>
            </div>

            {/* End age */}
            <div>
              <label className="text-[13px] text-gray-500 mb-1 block">จ่ายถึงอายุ *</label>
              <div className="flex items-center gap-2 flex-wrap">
                {[85, 90, 99].map((age) => (
                  <button
                    key={age}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        annuityDetails: { ...form.annuityDetails, payoutEndAge: age },
                      })
                    }
                    className={`flex-1 min-w-[70px] py-2 rounded-xl text-xs font-bold transition-all ${
                      form.annuityDetails.payoutEndAge === age
                        ? "bg-purple-500 text-white shadow"
                        : "bg-white border border-gray-200 text-gray-500 hover:border-purple-300"
                    }`}
                  >
                    {age === 99 ? "99 (ตลอดชีพ)" : `${age} ปี`}
                  </button>
                ))}
                <input
                  type="text"
                  inputMode="numeric"
                  value={
                    ![85, 90, 99].includes(form.annuityDetails.payoutEndAge)
                      ? form.annuityDetails.payoutEndAge || ""
                      : ""
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      annuityDetails: {
                        ...form.annuityDetails,
                        payoutEndAge: parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0,
                      },
                    })
                  }
                  className="glass w-14 text-sm font-bold rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-purple-400 text-center"
                  placeholder="อื่นๆ"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[12px] font-bold text-gray-500 uppercase mb-1 block">
              หมายเหตุ
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="เช่น ชำระเบี้ยหมดแล้ว"
              className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-400 border border-gray-200"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 space-y-2">
          {error && <div className="text-xs text-red-500 text-center">{error}</div>}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-bold hover:bg-purple-600 transition active:scale-95"
            >
              {editingId ? "บันทึก" : "เพิ่มกรมธรรม์"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function PensionInsurancePageInner() {
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const backHref =
    fromParam === "saving-funds"
      ? "/calculators/retirement/saving-funds"
      : fromParam === "insurance"
      ? "/calculators/insurance/policies"
      : "/calculators/retirement";
  const fromLabel =
    fromParam === "saving-funds"
      ? "แหล่งเงินทุนหลังเกษียณ"
      : fromParam === "insurance"
      ? "กรมธรรม์ประกัน"
      : null;

  const store = useRetirementStore();
  const { markStepCompleted } = useRetirementStore();
  const { setVariable } = useVariableStore();
  const profile = useProfileStore();
  const insStore = useInsuranceStore();
  const hasAutoFilled = useRef(false);

  const a = store.assumptions;
  const policies = insStore.policies;
  const annuityPolicies = useMemo(
    () => policies.filter((p) => p.policyType === "annuity"),
    [policies]
  );
  const hasPolicies = annuityPolicies.length > 0;

  // ── Assumptions (local state, seeded from stores) ──
  const [currentAge, setCurrentAge] = useState(a.currentAge);
  const [retireAge, setRetireAge] = useState(a.retireAge);
  const [lifeExpectancy, setLifeExpectancy] = useState(a.lifeExpectancy);
  const [bufferYears, setBufferYears] = useState(5);
  const [discountRate, setDiscountRate] = useState(a.postRetireReturn || 0.035);

  const [hasCalculated, setHasCalculated] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalInitialForm, setModalInitialForm] = useState<AnnuityFormState>(defaultAnnuityForm());
  const [deleteTarget, setDeleteTarget] = useState<InsurancePolicy | null>(null);

  // Auto-fill from Profile + Retirement assumptions
  useEffect(() => {
    if (hasAutoFilled.current) return;
    const timer = setTimeout(() => {
      const p = useProfileStore.getState();
      const r = useRetirementStore.getState();
      const profileAge = p.getAge();
      if (profileAge > 0) setCurrentAge(profileAge);
      if (p.retireAge) setRetireAge(p.retireAge);
      if (r.assumptions.lifeExpectancy) setLifeExpectancy(r.assumptions.lifeExpectancy);
      if (r.assumptions.postRetireReturn) setDiscountRate(r.assumptions.postRetireReturn);
      if (r.assumptions.retireAge) setRetireAge(r.assumptions.retireAge);
      hasAutoFilled.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Reactive sync when profile birthDate changes
  useEffect(() => {
    const profileAge = profile.getAge();
    if (profileAge > 0) {
      setCurrentAge(profileAge);
    }
  }, [profile.birthDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const pullFromPlan = () => {
    const p = useProfileStore.getState();
    const r = useRetirementStore.getState();
    const profileAge = p.getAge();
    if (profileAge > 0) setCurrentAge(profileAge);
    if (p.retireAge) setRetireAge(p.retireAge);
    if (r.assumptions.lifeExpectancy) setLifeExpectancy(r.assumptions.lifeExpectancy);
    if (r.assumptions.postRetireReturn) setDiscountRate(r.assumptions.postRetireReturn);
    if (r.assumptions.retireAge) setRetireAge(r.assumptions.retireAge);
    setHasCalculated(false);
    toast.success("ดึงค่าจากแผนเกษียณแล้ว");
  };

  // ═══ Summary across all annuity policies ═══
  const summary = useMemo(() => {
    const totalPremium = annuityPolicies.reduce((s, p) => s + (p.premium || 0), 0);
    const totalPayoutPerYear = annuityPolicies.reduce(
      (s, p) => s + (p.annuityDetails?.payoutPerYear || 0),
      0
    );
    const minStart = annuityPolicies.reduce(
      (m, p) => Math.min(m, p.annuityDetails?.payoutStartAge || 999),
      999
    );
    const maxEnd = annuityPolicies.reduce(
      (m, p) => Math.max(m, p.annuityDetails?.payoutEndAge || 0),
      0
    );
    const lifetimeTotal = annuityPolicies.reduce((s, p) => {
      const ad = p.annuityDetails;
      if (!ad) return s;
      const years = ad.payoutEndAge > ad.payoutStartAge ? ad.payoutEndAge - ad.payoutStartAge + 1 : 0;
      return s + (ad.payoutPerYear || 0) * years;
    }, 0);
    return {
      count: annuityPolicies.length,
      totalPremium,
      totalPayoutPerYear,
      minStart: minStart === 999 ? 0 : minStart,
      maxEnd,
      lifetimeTotal,
    };
  }, [annuityPolicies]);

  // ═══ NPV Calculation (aggregated across all annuity policies) ═══
  const horizonEndAge = lifeExpectancy + bufferYears;
  const tableRows = useMemo(() => {
    if (annuityPolicies.length === 0) return [];
    const rows: { year: number; age: number; pmt: number; pv: number }[] = [];
    const startAge = retireAge;
    const endAge = horizonEndAge;
    for (let i = 0; i <= Math.max(endAge - startAge, 0); i++) {
      const age = startAge + i;
      let pmt = 0;
      for (const p of annuityPolicies) {
        const ad = p.annuityDetails;
        if (!ad) continue;
        const polEnd = ad.payoutEndAge > 0 ? Math.min(ad.payoutEndAge, endAge) : endAge;
        if (age >= ad.payoutStartAge && age <= polEnd) {
          pmt += ad.payoutPerYear || 0;
        }
      }
      const pv = pvCalc(discountRate, i, pmt);
      rows.push({ year: i + 1, age, pmt, pv });
    }
    return rows;
  }, [annuityPolicies, retireAge, horizonEndAge, discountRate]);

  const totalNPV = tableRows.reduce((s, r) => s + r.pv, 0);
  const totalPension = tableRows.reduce((s, r) => s + r.pmt, 0);

  // ═══ Modal helpers ═══
  const openAdd = () => {
    const form = defaultAnnuityForm();
    form.annuityDetails.payoutStartAge = retireAge || 60;
    setModalInitialForm(form);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (p: InsurancePolicy) => {
    const ad = p.annuityDetails || DEFAULT_ANNUITY_DETAILS;
    setModalInitialForm({
      company: p.company || "",
      planName: p.planName || "",
      policyNumber: p.policyNumber || "",
      startDate: p.startDate || "",
      premium: p.premium ? commaInput(p.premium) : "",
      annuityDetails: { ...ad },
      notes: p.notes || "",
    });
    setEditingId(p.id);
    setModalOpen(true);
  };

  const handleSaveForm = (form: AnnuityFormState) => {
    const policyData = {
      planName: form.planName.trim() || "ประกันบำนาญ",
      company: form.company.trim(),
      policyNumber: form.policyNumber.trim(),
      category: "life" as const,
      group: "pension" as const,
      policyType: "annuity" as const,
      startDate: form.startDate,
      paymentMode: "years" as const,
      paymentYears: 0,
      paymentEndAge: 0,
      lastPayDate: "",
      coverageMode: "age" as const,
      coverageEndAge: form.annuityDetails.payoutEndAge || 0,
      coverageYears: 0,
      endDate: "",
      sumInsured: 0,
      premium: parseNum(form.premium),
      cashValue: 0,
      details: "",
      notes: form.notes.trim(),
      annuityDetails: { ...form.annuityDetails },
    };
    if (editingId) {
      insStore.updatePolicy(editingId, policyData);
      toast.success("อัปเดตข้อมูลกรมธรรม์บำนาญแล้ว");
    } else {
      insStore.addPolicy(policyData);
      toast.success("เพิ่มกรมธรรม์บำนาญแล้ว");
    }
    setModalOpen(false);
    setHasCalculated(false);
  };

  const handleCalculate = () => {
    if (annuityPolicies.length === 0) {
      toast.warning("กรุณาเพิ่มกรมธรรม์บำนาญก่อนคำนวณ");
      return;
    }
    setHasCalculated(true);
    setShowTable(true);
    setVariable({
      key: "pension_insurance_npv",
      label: "NPV ประกันบำนาญ ณ วันเกษียณ",
      value: totalNPV,
      source: "pension-insurance",
    });
    markStepCompleted("pension_insurance");
    toast.success("คำนวณและบันทึก NPV แล้ว");
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="ประกันบำนาญ"
        subtitle="Pension Insurance Calculator"
        backHref={backHref}
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-4">
        {/* ─── Contextual return banner ─── */}
        {fromLabel && (
          <a
            href={backHref}
            className="glass flex items-center justify-between rounded-xl border border-purple-200 px-3 py-2 mx-1 hover:bg-purple-50 transition"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                ←
              </div>
              <div>
                <div className="text-[11px] text-gray-500 uppercase tracking-wide font-bold">มาจาก</div>
                <div className="text-xs font-bold text-gray-800">{fromLabel}</div>
              </div>
            </div>
            <div className="text-[12px] text-purple-600 font-bold">กดกลับ ›</div>
          </a>
        )}

        {/* ─── Intro Banner ─── */}
        <div className="bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-2xl p-4 text-white mx-1 relative">
          <button
            onClick={() => setShowInfo(true)}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
            aria-label="วิธีคำนวณ"
          >
            <Info size={16} />
          </button>
          <div className="pr-10">
            <div className="text-[12px] font-bold text-white/70 mb-1">
              Step 2 · Pension Insurance
            </div>
            <h3 className="text-sm font-bold leading-snug mb-1.5">
              คำนวณมูลค่าประกันบำนาญเอกชน
            </h3>
            <p className="text-[13px] text-white/80 leading-relaxed">
              จัดการกรมธรรม์บำนาญทุกเล่ม พร้อมคำนวณ NPV ณ วันเกษียณ ตามหลัก CFP Module 4 (Private Annuity Valuation)
            </p>
          </div>
        </div>

        {/* ─── Summary (only when has policies) ─── */}
        {hasPolicies && (
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 text-white mx-1">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[12px] opacity-80 font-bold uppercase tracking-wide">
                สรุปกรมธรรม์บำนาญ
              </div>
              <div className="text-[12px] bg-white/20 rounded-full px-2.5 py-1 font-bold">
                {summary.count} เล่ม
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-white/20 rounded-xl p-2.5">
                <div className="text-[12px] opacity-80">เบี้ยรวม/ปี</div>
                <div className="text-sm font-bold">฿{fmt(summary.totalPremium)}</div>
              </div>
              <div className="bg-white/20 rounded-xl p-2.5">
                <div className="text-[12px] opacity-80">บำนาญรวม/ปี</div>
                <div className="text-sm font-bold">฿{fmt(summary.totalPayoutPerYear)}</div>
              </div>
              <div className="bg-white/20 rounded-xl p-2.5">
                <div className="text-[12px] opacity-80">รับตั้งแต่อายุ</div>
                <div className="text-sm font-bold">
                  {summary.minStart > 0 ? `${summary.minStart} ปี` : "-"}
                  {summary.maxEnd > 0 ? ` → ${summary.maxEnd}` : ""}
                </div>
              </div>
              <div className="bg-white/20 rounded-xl p-2.5">
                <div className="text-[12px] opacity-80">รวมบำนาญทั้งหมด</div>
                <div className="text-sm font-bold">฿{fmt(summary.lifetimeTotal)}</div>
              </div>
            </div>
            {hasCalculated && (
              <div className="bg-white/25 rounded-xl p-3 border border-white/30">
                <div className="text-[12px] opacity-80 mb-0.5">NPV ณ วันเกษียณ</div>
                <div className="text-xl font-extrabold">฿{fmt(totalNPV)}</div>
              </div>
            )}
          </div>
        )}

        {/* ─── Assumptions ─── */}
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Info size={16} className="text-blue-500" />
              สมมติฐาน
            </div>
            <button
              onClick={pullFromPlan}
              className="flex items-center gap-1 text-[12px] text-blue-600 font-medium bg-blue-50 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition"
            >
              ↻ ดึงค่าจากแผนเกษียณ
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-gray-500 mb-1 block">อายุปัจจุบัน</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={currentAge || ""}
                  onChange={(e) => {
                    setCurrentAge(Number(e.target.value) || 0);
                    setHasCalculated(false);
                  }}
                  className="w-full text-sm font-semibold bg-gray-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
                />
                <span className="text-xs text-gray-400">ปี</span>
              </div>
            </div>
            <div>
              <label className="text-[12px] text-gray-500 mb-1 block">อายุเกษียณ</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={retireAge || ""}
                  onChange={(e) => {
                    setRetireAge(Number(e.target.value) || 0);
                    setHasCalculated(false);
                  }}
                  className="w-full text-sm font-semibold bg-gray-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
                />
                <span className="text-xs text-gray-400">ปี</span>
              </div>
            </div>
            <div>
              <label className="text-[12px] text-gray-500 mb-1 block">อายุขัย</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={lifeExpectancy || ""}
                  onChange={(e) => {
                    setLifeExpectancy(Number(e.target.value) || 0);
                    setHasCalculated(false);
                  }}
                  className="w-full text-sm font-semibold bg-gray-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
                />
                <span className="text-xs text-gray-400">ปี</span>
              </div>
            </div>
            <div>
              <label className="text-[12px] text-gray-500 mb-1 block">อัตราคิดลด</label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={(discountRate * 100).toFixed(1)}
                  onChange={(e) => {
                    setDiscountRate(Number(e.target.value) / 100 || 0);
                    setHasCalculated(false);
                  }}
                  className="w-full text-sm font-semibold bg-gray-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>
          </div>

          {/* Buffer years as chip selector */}
          <div>
            <label className="text-[12px] text-gray-500 mb-1 block">จำนวนปีที่เผื่อเกินอายุขัย</label>
            <div className="flex items-center gap-2">
              {[0, 3, 5, 10].map((y) => (
                <button
                  key={y}
                  onClick={() => {
                    setBufferYears(y);
                    setHasCalculated(false);
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    bufferYears === y
                      ? "bg-purple-500 text-white shadow"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {y} ปี
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Scenario 1: EMPTY STATE ─── */}
        {!hasPolicies && (
          <div className="glass rounded-2xl border-2 border-dashed border-purple-200 p-8 text-center">
            <div className="text-5xl mb-3">💰</div>
            <div className="text-sm font-bold text-gray-700 mb-2">
              ยังไม่มีกรมธรรม์บำนาญ
            </div>
            <div className="text-xs text-gray-500 mb-5 leading-relaxed">
              เริ่มด้วยการเพิ่มกรมธรรม์บำนาญเล่มแรก <br />
              ข้อมูลจะถูกเชื่อมกับแผนประกันและแผนเกษียณทันที
            </div>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white text-sm font-bold shadow-lg shadow-purple-200 hover:shadow-xl active:scale-95 transition"
            >
              <Plus size={18} /> เพิ่มกรมธรรม์บำนาญ
            </button>
          </div>
        )}

        {/* ─── Scenario 2: HAS POLICIES ─── */}
        {hasPolicies && (
          <>
            {/* Policy List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-sm font-bold text-gray-700">
                  รายการกรมธรรม์บำนาญ {summary.count} เล่ม
                </div>
              </div>
              {annuityPolicies.map((p) => (
                <PensionPolicyCard
                  key={p.id}
                  policy={p}
                  onEdit={() => openEdit(p)}
                  onDelete={() => setDeleteTarget(p)}
                />
              ))}
            </div>

            {/* Add another */}
            <button
              onClick={openAdd}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-purple-300 text-purple-600 text-sm font-bold hover:bg-purple-50 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
            >
              <Plus size={16} /> เพิ่มกรมธรรม์บำนาญ
            </button>

            {/* Calculate */}
            <button
              onClick={handleCalculate}
              className={`w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] ${
                hasCalculated
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : "bg-purple-500 text-white hover:bg-purple-600 shadow-lg shadow-purple-200"
              }`}
            >
              {hasCalculated ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Save size={16} /> คำนวณและบันทึกแล้ว
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <Calculator size={16} /> คำนวณ NPV
                </span>
              )}
            </button>

            {/* NPV Table */}
            {hasCalculated && tableRows.length > 0 && (
              <>
                <button
                  onClick={() => setShowTable(!showTable)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition"
                >
                  {showTable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showTable ? "ซ่อนตารางคำนวณ" : "แสดงตารางคำนวณ"}
                </button>

                {showTable && (
                  <div className="rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#1e3a5f] text-white">
                            <th className="px-2 py-2 text-left sticky left-0 bg-[#1e3a5f] z-10">
                              ต้นปีที่
                            </th>
                            <th className="px-2 py-2 text-center">อายุ</th>
                            <th className="px-2 py-2 text-center">พ.ศ.</th>
                            <th className="px-2 py-2 text-right">PMT</th>
                            <th className="px-2 py-2 text-right">PV</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.map((row) => {
                            const currentYear = new Date().getFullYear();
                            const year = currentYear + (row.age - currentAge);
                            return (
                              <tr
                                key={row.year}
                                className={`border-b border-gray-100 ${
                                  row.pmt > 0 ? "bg-purple-50" : "bg-white"
                                }`}
                              >
                                <td className="px-2 py-1.5 text-center sticky left-0 bg-inherit z-10 font-medium">
                                  {row.year}
                                </td>
                                <td className="px-2 py-1.5 text-center">{row.age}</td>
                                <td className="px-2 py-1.5 text-center text-gray-500">
                                  {year + BE_OFFSET}
                                </td>
                                <td className="px-2 py-1.5 text-right font-medium">
                                  {row.pmt > 0 ? fmt(row.pmt) : "-"}
                                </td>
                                <td className="px-2 py-1.5 text-right text-purple-700 font-medium">
                                  {row.pv > 0 ? fmt(row.pv) : "-"}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-[#1e3a5f] text-white font-bold">
                            <td
                              colSpan={3}
                              className="px-2 py-2 sticky left-0 bg-[#1e3a5f] z-10"
                            >
                              NPV
                            </td>
                            <td className="px-2 py-2 text-right">{fmt(totalPension)}</td>
                            <td className="px-2 py-2 text-right">{fmt(totalNPV)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="h-8" />
          </>
        )}
      </div>

      {/* ─── Add/Edit Modal ─── */}
      <AnnuityModal
        open={modalOpen}
        editingId={editingId}
        initialForm={modalInitialForm}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveForm}
      />

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="glass w-[90%] max-w-xs rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center pt-6 pb-2 px-5">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-3">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-800 text-center">ยืนยันการลบ</h3>
              <p className="text-xs text-gray-500 text-center mt-1.5 leading-relaxed">
                คุณต้องการลบกรมธรรม์บำนาญ
                <br />
                <span className="font-bold text-gray-700">
                  &ldquo;{deleteTarget.planName || "ประกันบำนาญ"}&rdquo;
                </span>
                <br />
                ใช่หรือไม่?
              </p>
            </div>
            <div className="flex gap-2 px-5 py-4">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  insStore.removePolicy(deleteTarget.id);
                  setDeleteTarget(null);
                  setHasCalculated(false);
                  toast.success("ลบกรมธรรม์บำนาญแล้ว");
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition active:scale-95"
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Info Modal ─── */}
      {showInfo && (
        <div
          className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="glass w-full max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-purple-600 text-white px-5 py-4 flex items-center justify-between z-10 md:rounded-t-2xl rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h3 className="text-sm font-bold">หลักการคำนวณประกันบำนาญ</h3>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="text-white/70 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5 text-gray-700">
              <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-xl p-4 border border-purple-100">
                <p className="text-xs font-bold text-gray-800 leading-relaxed">
                  &ldquo;ซื้อประกันบำนาญไว้... จะคุ้มค่าเบี้ยแค่ไหน?&rdquo;
                </p>
                <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">
                  ประกันบำนาญ (Annuity) จ่ายเงินคงที่ตั้งแต่อายุเกษียณจนถึงสิ้นสัญญา —
                  ช่วยลดความเสี่ยงอายุยืน (Longevity Risk)
                </p>
              </div>

              <p className="text-xs leading-relaxed">
                ตามหลัก <strong>CFP Module 4</strong> การประเมินมูลค่าประกันบำนาญ ณ วันเกษียณ ใช้หลัก NPV <strong>3 ขั้นตอน</strong>:
              </p>

              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-[12px] font-bold flex items-center justify-center shrink-0">1</span>
                  <h4 className="text-xs font-bold text-gray-800">ระบุอัตราบำนาญ/ปี</h4>
                </div>
                <p className="text-[13px] leading-relaxed">
                  กรอกแต่ละกรมธรรม์: จ่าย/ปี, เริ่มจ่ายตอนอายุกี่ปี, และจ่ายถึงอายุกี่ปี
                </p>
                <div className="bg-purple-50 rounded-lg px-3 py-2 text-[12px]">
                  <div><strong>ตัวแปร:</strong> PMT (ต่อปี), อายุเริ่มรับ, อายุสิ้นสัญญา</div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-[12px] font-bold flex items-center justify-center shrink-0">2</span>
                  <h4 className="text-xs font-bold text-gray-800">คิดลดกลับมาที่วันเกษียณ</h4>
                </div>
                <p className="text-[13px] leading-relaxed">
                  แต่ละปีที่ได้รับเงิน คิดลดเป็น Present Value ณ วันเกษียณ ด้วยอัตราผลตอบแทนหลังเกษียณ
                </p>
                <div className="bg-purple-50 rounded-lg px-3 py-2 text-[12px]">
                  <div><strong>สูตร:</strong> PV<sub>year i</sub> = PMT ÷ (1 + rate)<sup>i</sup></div>
                </div>
              </div>

              <div className="border-2 border-purple-500 rounded-xl p-4 space-y-2 bg-purple-50/30">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-[12px] font-bold flex items-center justify-center shrink-0">3</span>
                  <h4 className="text-xs font-bold text-purple-800">รวม NPV ทั้งหมด ⭐</h4>
                </div>
                <div className="text-[12px] text-purple-700 font-bold bg-purple-100 rounded-lg px-2 py-1 inline-block">ใช้ในหน้านี้</div>
                <p className="text-[13px] leading-relaxed">
                  รวมผลของทุกกรมธรรม์ในทุกปี ตั้งแต่เกษียณจนสิ้นอายุขัย (+ บัฟเฟอร์) = มูลค่าประกันบำนาญรวม ณ วันเกษียณ
                </p>
                <div className="bg-purple-100 rounded-lg px-3 py-2 text-[12px] space-y-1">
                  <div><strong>สูตร:</strong> NPV = Σ<sub>policies</sub> Σ<sub>i</sub> PMT ÷ (1 + rate)<sup>i</sup></div>
                  <div className="text-green-700">✓ สะท้อนทั้งกระแสรายรับและความเสี่ยงอายุยืน</div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="text-[12px] text-amber-700 leading-relaxed">
                  💡 ประกันบำนาญได้สิทธิลดหย่อนสูงสุด 15% ของรายได้ (ไม่เกิน 200,000 บาท)
                  เมื่อรวมกับ PVD/RMF/SSF แล้วต้องไม่เกิน 500,000 บาท
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 md:rounded-b-2xl">
              <button
                onClick={() => setShowInfo(false)}
                className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PensionInsurancePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--color-bg)]" />}>
      <PensionInsurancePageInner />
    </Suspense>
  );
}
