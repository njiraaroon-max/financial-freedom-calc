"use client";

import { useState, useMemo } from "react";
import { HeartPulse, Building2, ShieldCheck, AlertTriangle, CheckCircle2, TrendingUp, Info } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useInsuranceStore, HospitalTier } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}
function commaInput(n: number): string {
  if (n === 0) return "";
  return n.toLocaleString("th-TH");
}
function parseNum(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}

// ─── Hospital Benchmark Data ─────────────────────────────────────────────────
const HOSPITAL_BENCHMARKS: Record<HospitalTier, {
  label: string;
  labelEn: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  roomRate: [number, number];
  ipdPerYear: [number, number];
  opdPerVisit: [number, number];
  examples: string;
}> = {
  government: {
    label: "โรงพยาบาลรัฐ",
    labelEn: "Government Hospital",
    icon: "🏥",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    roomRate: [500, 1500],
    ipdPerYear: [50000, 200000],
    opdPerVisit: [500, 1500],
    examples: "ศิริราช, รามาฯ, จุฬาฯ, ราชวิถี",
  },
  private_basic: {
    label: "เอกชนทั่วไป",
    labelEn: "Private — Basic",
    icon: "🏨",
    color: "text-teal-700",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    roomRate: [2000, 4000],
    ipdPerYear: [200000, 500000],
    opdPerVisit: [1500, 3000],
    examples: "เปาโล, วิภาวดี, เกษมราษฎร์",
  },
  private_mid: {
    label: "เอกชนระดับกลาง",
    labelEn: "Private — Mid-range",
    icon: "🏩",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    roomRate: [4000, 8000],
    ipdPerYear: [500000, 1500000],
    opdPerVisit: [2000, 5000],
    examples: "พญาไท, กรุงเทพ, ศิครินทร์",
  },
  private_premium: {
    label: "เอกชนระดับพรีเมียม",
    labelEn: "Private — Premium",
    icon: "✨",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    roomRate: [8000, 25000],
    ipdPerYear: [2000000, 10000000],
    opdPerVisit: [3000, 10000],
    examples: "บำรุงราษฎร์, สมิติเวช, BNH",
  },
};

const TIER_ORDER: HospitalTier[] = ["government", "private_basic", "private_mid", "private_premium"];

// ─── Input Components ────────────────────────────────────────────────────────
function MoneyInput({ label, value, onChange, hint, suffix = "บาท", disabled = false }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; suffix?: string; disabled?: boolean;
}) {
  const [display, setDisplay] = useState(value > 0 ? commaInput(value) : "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseNum(e.target.value);
    setDisplay(raw > 0 ? commaInput(raw) : e.target.value.replace(/[^0-9]/g, ""));
    onChange(raw);
  };

  return (
    <div>
      <label className="text-[11px] text-gray-500 font-semibold block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="text" inputMode="numeric" value={display}
          onChange={handleChange}
          disabled={disabled}
          className={`flex-1 text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-400 border border-gray-200 text-right font-bold ${disabled ? "opacity-50" : ""}`}
          placeholder="0"
        />
        <span className="text-xs text-gray-400 shrink-0 w-8">{suffix}</span>
      </div>
      {hint && <div className="text-[9px] text-gray-400 mt-0.5 pl-1">{hint}</div>}
    </div>
  );
}

function NumberInput({ label, value, onChange, suffix = "ปี", min, max }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string; min?: number; max?: number;
}) {
  return (
    <div>
      <label className="text-[11px] text-gray-500 font-semibold block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="text" inputMode="numeric" value={value || ""}
          onChange={(e) => {
            let v = parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0;
            if (min !== undefined && v < min) v = min;
            if (max !== undefined && v > max) v = max;
            onChange(v);
          }}
          className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-400 border border-gray-200 text-center font-bold"
          placeholder="0"
        />
        <span className="text-xs text-gray-400 shrink-0 w-8">{suffix}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — Pillar 2: Health & Accident
// ═══════════════════════════════════════════════════════════════════════════════
export default function Pillar2Page() {
  const store = useInsuranceStore();
  const profile = useProfileStore();

  const p2 = store.riskManagement.pillar2;
  const update = store.updatePillar2;

  const currentAge = profile.getAge?.() || 35;
  const retireAge = profile.retireAge || 60;

  // ─── Health & CI policies from store ───────────────────────────────────
  const healthPolicies = store.policies.filter((p) =>
    ["health", "critical_illness", "accident"].includes(p.policyType)
  );
  const personalIPD = healthPolicies
    .filter((p) => p.policyType === "health")
    .reduce((s, p) => s + p.sumInsured, 0);
  const personalCI = healthPolicies
    .filter((p) => p.policyType === "critical_illness")
    .reduce((s, p) => s + p.sumInsured, 0);
  const personalAccident = healthPolicies
    .filter((p) => p.policyType === "accident")
    .reduce((s, p) => s + p.sumInsured, 0);

  // ─── Current benchmark ────────────────────────────────────────────────
  const benchmark = HOSPITAL_BENCHMARKS[p2.hospitalTier];

  // ─── Gap Analysis ─────────────────────────────────────────────────────
  const analysis = useMemo(() => {
    // Total coverage: group + personal policies
    const totalIPD = p2.groupIPDPerYear + personalIPD;
    const totalRoomRate = p2.groupRoomRate; // room rate isn't cumulative from policies
    const totalCI = p2.groupCI + personalCI;
    const totalAccident = p2.groupAccident + personalAccident;
    const totalOPD = p2.groupOPDPerVisit; // OPD per visit from group

    // Gap = Need - Have
    const ipdGap = p2.desiredIPDPerYear - totalIPD;
    const roomGap = p2.desiredRoomRate - totalRoomRate;
    const ciGap = p2.desiredCICoverage - totalCI;
    const accidentGap = p2.desiredAccidentCoverage - totalAccident;
    const opdGap = p2.desiredOPDPerVisit - totalOPD;

    // Medical inflation projection
    const inflationRate = p2.medicalInflationRate / 100;
    const years = p2.projectionYears || (retireAge - currentAge);
    const futureIPD = p2.desiredIPDPerYear * Math.pow(1 + inflationRate, years);
    const futureRoomRate = p2.desiredRoomRate * Math.pow(1 + inflationRate, years);

    // Coverage adequacy (simplified score)
    const items = [
      { label: "IPD (ผู้ป่วยใน)", need: p2.desiredIPDPerYear, have: totalIPD, gap: ipdGap },
      { label: "ค่าห้อง/วัน", need: p2.desiredRoomRate, have: totalRoomRate, gap: roomGap },
      { label: "OPD (ผู้ป่วยนอก)", need: p2.desiredOPDPerVisit, have: totalOPD, gap: opdGap },
      { label: "โรคร้ายแรง (CI)", need: p2.desiredCICoverage, have: totalCI, gap: ciGap },
      { label: "อุบัติเหตุ (PA)", need: p2.desiredAccidentCoverage, have: totalAccident, gap: accidentGap },
    ];

    const adequateCount = items.filter((i) => i.gap <= 0).length;

    return {
      totalIPD, totalRoomRate, totalCI, totalAccident, totalOPD,
      ipdGap, roomGap, ciGap, accidentGap, opdGap,
      futureIPD, futureRoomRate, years,
      items, adequateCount,
    };
  }, [p2, personalIPD, personalCI, personalAccident, retireAge, currentAge]);

  // ─── Medical inflation table ──────────────────────────────────────────
  const inflationTable = useMemo(() => {
    const rate = p2.medicalInflationRate / 100;
    const milestones = [5, 10, 15, 20, 25, 30].filter(
      (y) => currentAge + y <= 90
    );
    return milestones.map((y) => ({
      years: y,
      age: currentAge + y,
      roomRate: Math.round(p2.desiredRoomRate * Math.pow(1 + rate, y)),
      ipd: Math.round(p2.desiredIPDPerYear * Math.pow(1 + rate, y)),
    }));
  }, [p2.desiredRoomRate, p2.desiredIPDPerYear, p2.medicalInflationRate, currentAge]);

  // ─── Save ──────────────────────────────────────────────────────────────
  const handleSave = () => {
    store.markPillarCompleted("pillar2");
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="สุขภาพ & อุบัติเหตุ"
        subtitle="Pillar 2 — Health & Accident"
        characterImg="/circle-icons/risk-management.png"
        backHref="/calculators/insurance"
      />

      <div className="px-2 md:px-4 pt-3 pb-8 space-y-3">
        {/* Intro Card */}
        <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-4 text-white mx-1">
          <div className="flex items-center gap-2 mb-2">
            <HeartPulse size={20} />
            <span className="text-sm font-bold">ถ้าวันนี้เจ็บป่วยเข้า รพ...ใครจ่าย?</span>
          </div>
          <p className="text-[11px] opacity-80 leading-relaxed">
            ประเมินความคุ้มครองสุขภาพ อุบัติเหตุ และโรคร้ายแรง เทียบกับ
            benchmark โรงพยาบาลเป้าหมาย พร้อมคำนวณ Medical Inflation
          </p>
        </div>

        {/* ─── SECTION 1: เลือกระดับ รพ. ──────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-[10px] font-bold flex items-center justify-center">1</span>
            ระดับโรงพยาบาลเป้าหมาย
          </h3>

          <div className="grid grid-cols-2 gap-2">
            {TIER_ORDER.map((tier) => {
              const b = HOSPITAL_BENCHMARKS[tier];
              const selected = p2.hospitalTier === tier;
              return (
                <button
                  key={tier}
                  onClick={() => {
                    update({
                      hospitalTier: tier,
                      desiredRoomRate: b.roomRate[1],
                      desiredIPDPerYear: b.ipdPerYear[1],
                      desiredOPDPerVisit: b.opdPerVisit[1],
                    });
                  }}
                  className={`rounded-xl border-2 p-3 text-left transition-all active:scale-[0.97] ${
                    selected
                      ? `${b.borderColor} ${b.bgColor} ring-2 ring-offset-1 ring-teal-400`
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="text-lg mb-1">{b.icon}</div>
                  <div className={`text-xs font-bold ${selected ? b.color : "text-gray-700"}`}>{b.label}</div>
                  <div className="text-[9px] text-gray-400 mt-0.5">{b.examples}</div>
                  <div className="text-[9px] text-gray-500 mt-1">
                    ค่าห้อง {fmt(b.roomRate[0])}-{fmt(b.roomRate[1])}/วัน
                  </div>
                </button>
              );
            })}
          </div>

          {/* Benchmark details */}
          <div className={`${benchmark.bgColor} rounded-xl p-3 border ${benchmark.borderColor}`}>
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={14} className={benchmark.color} />
              <span className={`text-xs font-bold ${benchmark.color}`}>
                Benchmark: {benchmark.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-[9px] text-gray-500">ค่าห้อง/วัน</div>
                <div className={`text-xs font-bold ${benchmark.color}`}>
                  {fmt(benchmark.roomRate[0])}-{fmt(benchmark.roomRate[1])}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-gray-500">IPD/ปี</div>
                <div className={`text-xs font-bold ${benchmark.color}`}>
                  {fmtShort(benchmark.ipdPerYear[0])}-{fmtShort(benchmark.ipdPerYear[1])}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-gray-500">OPD/ครั้ง</div>
                <div className={`text-xs font-bold ${benchmark.color}`}>
                  {fmt(benchmark.opdPerVisit[0])}-{fmt(benchmark.opdPerVisit[1])}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── SECTION 2: ความต้องการความคุ้มครอง ─────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-[10px] font-bold flex items-center justify-center">2</span>
            ความต้องการความคุ้มครอง (Need Analysis)
          </h3>

          <MoneyInput
            label="ค่าห้อง/วัน ที่ต้องการ"
            value={p2.desiredRoomRate}
            onChange={(v) => update({ desiredRoomRate: v })}
            hint={`Benchmark: ${fmt(benchmark.roomRate[0])}-${fmt(benchmark.roomRate[1])} บาท/วัน`}
            suffix="บาท/วัน"
          />

          <MoneyInput
            label="วงเงิน IPD (ผู้ป่วยใน) ต่อปี"
            value={p2.desiredIPDPerYear}
            onChange={(v) => update({ desiredIPDPerYear: v })}
            hint={`Benchmark: ${fmtShort(benchmark.ipdPerYear[0])}-${fmtShort(benchmark.ipdPerYear[1])} บาท/ปี`}
          />

          <MoneyInput
            label="วงเงิน OPD (ผู้ป่วยนอก) ต่อครั้ง"
            value={p2.desiredOPDPerVisit}
            onChange={(v) => update({ desiredOPDPerVisit: v })}
            hint={`Benchmark: ${fmt(benchmark.opdPerVisit[0])}-${fmt(benchmark.opdPerVisit[1])} บาท/ครั้ง`}
          />

          <MoneyInput
            label="ทุนคุ้มครองโรคร้ายแรง (CI)"
            value={p2.desiredCICoverage}
            onChange={(v) => update({ desiredCICoverage: v })}
            hint="แนะนำ 1-3 ล้านบาท หรือ 3-5 เท่าของรายได้ต่อปี"
          />

          <MoneyInput
            label="ทุนคุ้มครองอุบัติเหตุ (PA)"
            value={p2.desiredAccidentCoverage}
            onChange={(v) => update({ desiredAccidentCoverage: v })}
            hint="แนะนำ 10-20 เท่าของรายได้ต่อเดือน"
          />
        </div>

        {/* ─── SECTION 3: สวัสดิการ & ความคุ้มครองที่มี ──────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-[10px] font-bold flex items-center justify-center">3</span>
            สวัสดิการ & ความคุ้มครองที่มี (What You Have)
          </h3>

          {/* Government scheme */}
          <div>
            <label className="text-[11px] text-gray-500 font-semibold block mb-2">สิทธิสวัสดิการรัฐ</label>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "none", label: "ไม่มี", icon: "—" },
                { value: "gold_card", label: "บัตรทอง (30 บาท)", icon: "💳" },
                { value: "government_officer", label: "ข้าราชการ", icon: "🏛️" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update({ governmentScheme: opt.value })}
                  className={`text-xs px-3 py-2 rounded-xl border transition-all ${
                    p2.governmentScheme === opt.value
                      ? "border-teal-400 bg-teal-50 text-teal-700 font-bold"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Social Security */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={p2.hasSocialSecurity}
              onChange={(e) => update({ hasSocialSecurity: e.target.checked })}
              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-xs text-gray-700 font-medium">มีประกันสังคม (มาตรา 33/39)</span>
          </label>

          {p2.hasSocialSecurity && (
            <div className="bg-teal-50 rounded-xl p-3 text-[10px] text-teal-700 leading-relaxed">
              <div className="font-bold mb-1">สิทธิประกันสังคม (สถานพยาบาลที่เลือก):</div>
              <div>• ค่ารักษาผู้ป่วยนอก: ไม่จำกัดจำนวนครั้ง (ตาม DRG)</div>
              <div>• ค่ารักษาผู้ป่วยใน: ค่าห้อง 700 บาท/วัน (ไม่เกิน 7 วัน)</div>
              <div>• ค่าผ่าตัดใหญ่: ตามอัตรากำหนด</div>
            </div>
          )}

          {/* Group Insurance */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-teal-600" />
              <span className="text-[11px] text-gray-500 font-semibold">ประกันกลุ่มจากนายจ้าง (Group Insurance)</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MoneyInput label="ค่าห้อง/วัน" value={p2.groupRoomRate} onChange={(v) => update({ groupRoomRate: v })} suffix="บาท/วัน" />
              <MoneyInput label="วงเงิน IPD/ปี" value={p2.groupIPDPerYear} onChange={(v) => update({ groupIPDPerYear: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MoneyInput label="วงเงิน OPD/ครั้ง" value={p2.groupOPDPerVisit} onChange={(v) => update({ groupOPDPerVisit: v })} />
              <MoneyInput label="ทุน CI" value={p2.groupCI} onChange={(v) => update({ groupCI: v })} />
            </div>
            <MoneyInput label="ทุนอุบัติเหตุ (PA)" value={p2.groupAccident} onChange={(v) => update({ groupAccident: v })} />
          </div>

          {/* Personal policies from store */}
          <div className="bg-cyan-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-cyan-800">กรมธรรม์สุขภาพส่วนตัว (จาก Portfolio)</span>
            </div>
            {healthPolicies.length > 0 ? (
              <div className="space-y-1">
                {healthPolicies.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[10px]">
                    <span className="text-cyan-700">
                      {p.planName}
                      <span className="text-cyan-400 ml-1">
                        ({p.policyType === "health" ? "สุขภาพ" : p.policyType === "critical_illness" ? "CI" : "PA"})
                      </span>
                    </span>
                    <span className="font-bold text-cyan-600">{fmt(p.sumInsured)}</span>
                  </div>
                ))}
                <div className="border-t border-cyan-200 mt-2 pt-2 grid grid-cols-3 gap-2 text-[9px]">
                  <div className="text-center">
                    <div className="text-cyan-500">IPD รวม</div>
                    <div className="font-bold text-cyan-700">{fmt(personalIPD)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-cyan-500">CI รวม</div>
                    <div className="font-bold text-cyan-700">{fmt(personalCI)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-cyan-500">PA รวม</div>
                    <div className="font-bold text-cyan-700">{fmt(personalAccident)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-cyan-400">ยังไม่มีกรมธรรม์สุขภาพ — เพิ่มได้ที่หน้าสรุปกรมธรรม์</div>
            )}
          </div>
        </div>

        {/* ─── SECTION 4: Gap Analysis ────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-[10px] font-bold flex items-center justify-center">4</span>
            วิเคราะห์ช่องว่าง (Gap Analysis)
          </h3>

          {/* Gap items */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-4 gap-1 px-3 py-2 bg-gray-50 text-[9px] font-bold text-gray-500 uppercase">
              <div>ประเภท</div>
              <div className="text-right">ต้องการ</div>
              <div className="text-right">มีอยู่</div>
              <div className="text-right">Gap</div>
            </div>

            {analysis.items.map((item) => {
              const isOk = item.gap <= 0;
              return (
                <div key={item.label} className="grid grid-cols-4 gap-1 px-3 py-2.5 border-t border-gray-50 items-center">
                  <div className="text-[10px] text-gray-700 font-medium">{item.label}</div>
                  <div className="text-[10px] text-right font-bold text-gray-600">{fmtShort(item.need)}</div>
                  <div className="text-[10px] text-right font-bold text-teal-600">{fmtShort(item.have)}</div>
                  <div className={`text-[10px] text-right font-bold ${isOk ? "text-emerald-600" : "text-red-600"}`}>
                    {isOk ? "✓ OK" : `-${fmtShort(item.gap)}`}
                  </div>
                </div>
              );
            })}

            {/* Summary row */}
            <div className={`px-3 py-3 border-t-2 ${analysis.adequateCount >= 4 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">ผลประเมิน</span>
                <span className={`text-xs font-bold ${analysis.adequateCount >= 4 ? "text-emerald-600" : "text-red-600"}`}>
                  ผ่าน {analysis.adequateCount}/5 รายการ
                </span>
              </div>
            </div>
          </div>

          {/* Visual bars */}
          <div className="space-y-3">
            {analysis.items.map((item) => {
              const pct = item.need > 0 ? Math.min((item.have / item.need) * 100, 100) : 0;
              const isOk = item.gap <= 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-gray-600 font-medium">{item.label}</span>
                    <span className={`font-bold ${isOk ? "text-emerald-600" : "text-red-600"}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isOk ? "bg-emerald-400" : pct > 50 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall result */}
          <div className={`rounded-xl p-4 text-center ${analysis.adequateCount >= 4 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
            {analysis.adequateCount >= 4 ? (
              <>
                <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                <div className="text-sm font-bold text-emerald-700">ความคุ้มครองสุขภาพเพียงพอ!</div>
                <div className="text-xs text-emerald-600 mt-1">ผ่านเกณฑ์ {analysis.adequateCount}/5 รายการ</div>
              </>
            ) : (
              <>
                <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
                <div className="text-sm font-bold text-red-700">ช่องว่างความคุ้มครองสุขภาพ</div>
                <div className="text-xs text-red-600 mt-1">
                  ยังไม่ผ่าน {5 - analysis.adequateCount} รายการ — ควรเพิ่มความคุ้มครอง
                </div>
              </>
            )}
          </div>
        </div>

        {/* ─── SECTION 5: Medical Inflation ───────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-[10px] font-bold flex items-center justify-center">5</span>
            <TrendingUp size={14} className="text-teal-600" />
            Medical Inflation Projection
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-gray-500 font-semibold block mb-2">อัตราเงินเฟ้อค่ารักษา (%/ปี)</label>
              <div className="flex gap-1.5">
                {[3, 5, 7, 10].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => update({ medicalInflationRate: rate })}
                    className={`flex-1 text-xs py-2 rounded-lg border transition-all ${
                      p2.medicalInflationRate === rate
                        ? "border-teal-400 bg-teal-50 text-teal-700 font-bold"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
            </div>
            <NumberInput
              label="คำนวณไปกี่ปี"
              value={p2.projectionYears}
              onChange={(v) => update({ projectionYears: v })}
              min={5}
              max={50}
            />
          </div>

          {/* Inflation table */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="grid grid-cols-4 gap-1 px-3 py-2 bg-gray-50 text-[9px] font-bold text-gray-500 uppercase">
              <div>อีก (ปี)</div>
              <div className="text-center">อายุ</div>
              <div className="text-right">ค่าห้อง/วัน</div>
              <div className="text-right">IPD/ปี</div>
            </div>
            {/* Current row */}
            <div className="grid grid-cols-4 gap-1 px-3 py-2 border-t border-gray-50 bg-teal-50">
              <div className="text-[10px] text-teal-700 font-bold">ปัจจุบัน</div>
              <div className="text-[10px] text-center text-teal-600 font-bold">{currentAge}</div>
              <div className="text-[10px] text-right font-bold text-teal-700">{fmt(p2.desiredRoomRate)}</div>
              <div className="text-[10px] text-right font-bold text-teal-700">{fmt(p2.desiredIPDPerYear)}</div>
            </div>
            {inflationTable.map((row) => (
              <div key={row.years} className="grid grid-cols-4 gap-1 px-3 py-2 border-t border-gray-50">
                <div className="text-[10px] text-gray-600">+{row.years} ปี</div>
                <div className="text-[10px] text-center text-gray-500">{row.age}</div>
                <div className="text-[10px] text-right font-bold text-gray-700">{fmt(row.roomRate)}</div>
                <div className="text-[10px] text-right font-bold text-gray-700">{fmtShort(row.ipd)}</div>
              </div>
            ))}
          </div>

          {/* Inflation warning */}
          <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
            <div className="flex items-start gap-2">
              <Info size={14} className="text-orange-600 mt-0.5 shrink-0" />
              <div className="text-[10px] text-orange-700 leading-relaxed">
                <div className="font-bold mb-1">ผลกระทบ Medical Inflation ({p2.medicalInflationRate}%/ปี)</div>
                <p>อีก {analysis.years} ปี (อายุ {currentAge + analysis.years})</p>
                <p>• ค่าห้อง/วัน จะเพิ่มจาก {fmt(p2.desiredRoomRate)} → <strong>{fmt(analysis.futureRoomRate)}</strong> บาท</p>
                <p>• วงเงิน IPD จะต้องเพิ่มจาก {fmtShort(p2.desiredIPDPerYear)} → <strong>{fmtShort(analysis.futureIPD)}</strong> บาท</p>
                <p className="mt-1 font-semibold">ควรเลือกแผนที่วงเงินปรับตัวตาม inflation หรือทบทวนทุก 3-5 ปี</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── CFP Tip ────────────────────────────────────────────────── */}
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 mx-1">
          <div className="text-[10px] font-bold text-amber-800 mb-1">💡 คำแนะนำจาก CFP</div>
          <div className="text-[10px] text-amber-700 leading-relaxed space-y-1">
            <p>• ค่าห้องเดี่ยวมาตรฐาน รพ.เอกชนระดับกลาง ปัจจุบัน 4,000-8,000 บาท/วัน</p>
            <p>• ทุน CI แนะนำ <strong>3-5 เท่า</strong> ของรายได้ต่อปี (ชดเชยรายได้ระหว่างรักษา)</p>
            <p>• Medical Inflation ไทยเฉลี่ย <strong>5-8% ต่อปี</strong> (สูงกว่าเงินเฟ้อทั่วไป 2-3 เท่า)</p>
            <p>• ประกันกลุ่มจากนายจ้าง <strong>สิ้นสุดเมื่อออกจากงาน</strong> — ควรมีประกันส่วนตัวรองรับ</p>
            <p>• OPD ส่วนใหญ่เป็น rider เพิ่มเบี้ย — พิจารณาว่าคุ้มค่าหรือจ่ายเองดีกว่า</p>
          </div>
        </div>

        {/* Save button */}
        <div className="mx-1">
          <button
            onClick={handleSave}
            className="w-full py-3 rounded-2xl bg-teal-500 text-white text-sm font-bold hover:bg-teal-600 active:scale-[0.98] transition shadow-lg"
          >
            บันทึกการประเมิน Pillar 2
          </button>
        </div>
      </div>
    </div>
  );
}
