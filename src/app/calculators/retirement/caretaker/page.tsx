"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Info, X, HeartPulse, ArrowUpFromLine } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import MoneyInput from "@/components/MoneyInput";
import { useRetirementStore } from "@/store/retirement-store";
import { useProfileStore } from "@/store/profile-store";
import { useVariableStore } from "@/store/variable-store";
import { calcCaretakerNPV } from "@/types/retirement";
import { flushAllStores } from "@/lib/sync/flush-all";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

// Presets อ้างอิงตลาดไทย (2024-2025)
const CAREGIVER_PRESETS = [
  { label: "ผู้ช่วยดูแลที่บ้าน (ครึ่งวัน)", monthly: 15000 },
  { label: "Caregiver เต็มเวลา", monthly: 25000 },
  { label: "พยาบาล/Nurse Aid", monthly: 35000 },
  { label: "Nursing Home (ระดับกลาง)", monthly: 50000 },
  { label: "Nursing Home (พรีเมี่ยม)", monthly: 80000 },
];

const INFLATION_OPTIONS = [
  { label: "3% (ทั่วไป)", rate: 0.03 },
  { label: "5% (แนะนำ)", rate: 0.05 },
  { label: "7% (อนุรักษ์นิยม)", rate: 0.07 },
];

const PROBABILITY_OPTIONS = [0.5, 0.7, 0.85, 1.0];

export default function CaretakerPage() {
  const router = useRouter();
  const store = useRetirementStore();
  const profile = useProfileStore();
  const { setVariable } = useVariableStore();
  const p = store.caretakerParams;
  const a = store.assumptions;

  const [hasSaved, setHasSaved] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Source values (readonly — from profile & assumptions)
  const sourceCurrentAge = profile.getAge?.() || a.currentAge;
  const sourceRetireAge = a.retireAge;
  const sourceLifeExpectancy = a.lifeExpectancy;
  const sourcePostRetireReturn = a.postRetireReturn;

  // Auto-sync from source (profile + assumptions) whenever source changes.
  // User can still override locally, but the next time an assumption changes
  // upstream (e.g. updating lifeExpectancy in /retirement/assumptions), this
  // page mirrors it so Journey projection + caretaker NPV stay consistent.
  useEffect(() => {
    if (sourceCurrentAge > 0 && p.currentAge !== sourceCurrentAge) {
      store.updateCaretakerParam("currentAge", sourceCurrentAge);
    }
    if (p.retireAge !== sourceRetireAge) {
      store.updateCaretakerParam("retireAge", sourceRetireAge);
    }
    if (p.lifeExpectancy !== sourceLifeExpectancy) {
      store.updateCaretakerParam("lifeExpectancy", sourceLifeExpectancy);
    }
    if (Math.abs(p.postRetireReturn - sourcePostRetireReturn) > 0.0001) {
      store.updateCaretakerParam("postRetireReturn", sourcePostRetireReturn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceCurrentAge, sourceRetireAge, sourceLifeExpectancy, sourcePostRetireReturn]);

  const result = useMemo(() => calcCaretakerNPV(p), [p]);

  // Row-level "linked" flags — whether a field currently equals its source
  const isLinked = {
    currentAge: p.currentAge === sourceCurrentAge,
    retireAge: p.retireAge === sourceRetireAge,
    lifeExpectancy: p.lifeExpectancy === sourceLifeExpectancy,
    postRetireReturn: Math.abs(p.postRetireReturn - sourcePostRetireReturn) < 0.0001,
  };

  const handleResetToSource = () => {
    store.updateCaretakerParam("currentAge", sourceCurrentAge);
    store.updateCaretakerParam("retireAge", sourceRetireAge);
    store.updateCaretakerParam("lifeExpectancy", sourceLifeExpectancy);
    store.updateCaretakerParam("postRetireReturn", sourcePostRetireReturn);
  };

  const handleSave = async () => {
    setVariable({
      key: "caretaker_npv",
      label: "ค่าคนดูแลหลังเกษียณ (NPV ณ วันเกษียณ)",
      value: Math.round(result.npvAtRetire),
      source: "retirement-caretaker",
    });
    setHasSaved(true);
    // Flush pending writes to Supabase before we navigate away — otherwise an
    // in-flight autosave request can be cancelled by the route change.
    await flushAllStores();
    // Short delay so the "บันทึกแล้ว" success label briefly shows before
    // the route change — matches the UX of the special-expenses save button.
    setTimeout(() => {
      router.push("/calculators/retirement/special-expenses");
    }, 600);
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)]">
      <PageHeader
        title="ค่าคนดูแลหลังเกษียณ"
        subtitle="Caretaker Cost NPV"
        backHref="/calculators/retirement/special-expenses"
        rightElement={
          <button
            onClick={() => setShowInfo(true)}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-[#1e3a5f] text-gray-500 hover:text-white flex items-center justify-center transition"
            aria-label="วิธีคำนวณ"
          >
            <Info size={16} />
          </button>
        }
      />

      <div className="px-4 md:px-8 py-5 pb-16 max-w-2xl mx-auto space-y-4">
        {/* Intro card */}
        <div className="rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 text-white p-4 shadow-lg shadow-rose-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <HeartPulse size={20} />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-sm">วางแผนค่าคนดูแลหลังเกษียณ</h2>
              <p className="text-[14px] text-white/90 mt-1 leading-relaxed">
                ประมาณการค่าใช้จ่ายรายปีของคนดูแล ตั้งแต่อายุที่เริ่มต้องใช้จนถึงสิ้นอายุขัย —
                คิด <b>เงินเฟ้อค่าจ้าง</b> และ <b>discount</b> กลับมาที่วันเกษียณ
              </p>
            </div>
          </div>
        </div>

        {/* Auto-sync banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center justify-between gap-3">
          <div className="text-[14px] text-blue-900 leading-relaxed">
            🔗 หน้านี้<b>ซิงก์อัตโนมัติ</b>กับ <b>Profile</b> + <b>สมมติฐานการเกษียณ</b> —
            แก้อายุ/ผลตอบแทนที่ต้นทาง แล้วหน้านี้จะอัพเดตตามให้ทันที
          </div>
          <button
            onClick={handleResetToSource}
            className="glass shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-300 text-blue-700 text-[13px] font-bold hover:bg-blue-100 transition"
            title="กดเพื่อซิงก์กลับทันที (ถ้าเผลอแก้ในหน้านี้)"
          >
            <RotateCcw size={11} />
            ซิงก์เดี๋ยวนี้
          </button>
        </div>

        {/* Ages section */}
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="text-xs font-bold text-gray-500">ช่วงอายุ</div>

          <AgeRow
            label="อายุปัจจุบัน"
            value={p.currentAge}
            sourceLabel="Profile"
            isLinked={isLinked.currentAge}
            sourceValue={sourceCurrentAge}
            onChange={(v) => store.updateCaretakerParam("currentAge", v)}
            min={18}
            max={100}
            suffix="ปี"
          />
          <AgeRow
            label="อายุเกษียณ"
            value={p.retireAge}
            sourceLabel="สมมติฐาน"
            isLinked={isLinked.retireAge}
            sourceValue={sourceRetireAge}
            onChange={(v) => store.updateCaretakerParam("retireAge", v)}
            min={40}
            max={90}
            suffix="ปี"
          />
          <AgeRow
            label="อายุขัย"
            value={p.lifeExpectancy}
            sourceLabel="สมมติฐาน"
            isLinked={isLinked.lifeExpectancy}
            sourceValue={sourceLifeExpectancy}
            onChange={(v) => store.updateCaretakerParam("lifeExpectancy", v)}
            min={60}
            max={120}
            suffix="ปี"
          />
          <AgeRow
            label="ปีเผื่อเกินอายุขัย"
            value={p.extraYearsBeyondLife}
            onChange={(v) => store.updateCaretakerParam("extraYearsBeyondLife", v)}
            min={0}
            max={20}
            suffix="ปี"
            hint="เผื่อกรณีอายุยืนเกินคาด (แนะนำ 5 ปี)"
          />
          <AgeRow
            label="อายุที่เริ่มใช้คนดูแล"
            value={p.caretakerStartAge}
            onChange={(v) => store.updateCaretakerParam("caretakerStartAge", v)}
            min={40}
            max={120}
            suffix="ปี"
            hint="อายุที่คาดว่าต้องเริ่มพึ่งคนดูแล (แนะนำ 75-80)"
          />
        </div>

        {/* Cost section */}
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="text-xs font-bold text-gray-500">ค่าคนดูแล ณ ปัจจุบัน</div>

          <div className="flex items-center gap-2">
            <div className="flex-1 text-xs text-gray-700">ค่าจ้างต่อเดือน</div>
            <MoneyInput
              value={p.monthlyRate}
              onChange={(v) => store.updateCaretakerParam("monthlyRate", v)}
              unit="บาท/เดือน"
              placeholder="25,000"
              className="w-32 text-sm font-bold bg-gray-50 rounded-lg px-2 py-1.5 outline-none focus:ring-2 text-right"
              ringClass="focus:ring-pink-400"
            />
          </div>

          {/* Presets */}
          <div className="space-y-1.5">
            <div className="text-[13px] text-gray-400">เลือกจาก preset:</div>
            <div className="flex flex-wrap gap-1.5">
              {CAREGIVER_PRESETS.map((preset) => (
                <button
                  key={preset.monthly}
                  onClick={() => store.updateCaretakerParam("monthlyRate", preset.monthly)}
                  className={`px-2.5 py-1 rounded-full text-[13px] font-medium transition ${
                    p.monthlyRate === preset.monthly
                      ? "bg-pink-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {preset.label} <span className="opacity-70">฿{fmt(preset.monthly)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Inflation + probability */}
        <div className="glass rounded-2xl p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-gray-500">เงินเฟ้อค่าจ้าง (ต่อปี)</span>
              <span className="text-xs font-bold text-pink-600">{(p.inflationRate * 100).toFixed(1)}%</span>
            </div>
            <div className="flex gap-1.5">
              {INFLATION_OPTIONS.map((opt) => (
                <button
                  key={opt.rate}
                  onClick={() => store.updateCaretakerParam("inflationRate", opt.rate)}
                  className={`flex-1 py-1.5 rounded-lg text-[13px] font-bold transition ${
                    Math.abs(p.inflationRate - opt.rate) < 0.0001
                      ? "bg-pink-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-gray-500">โอกาสที่ต้องใช้คนดูแลจริง</span>
              <span className="text-xs font-bold text-pink-600">{(p.probability * 100).toFixed(0)}%</span>
            </div>
            <div className="flex gap-1.5">
              {PROBABILITY_OPTIONS.map((prob) => (
                <button
                  key={prob}
                  onClick={() => store.updateCaretakerParam("probability", prob)}
                  className={`flex-1 py-1.5 rounded-lg text-[13px] font-bold transition ${
                    Math.abs(p.probability - prob) < 0.0001
                      ? "bg-pink-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {(prob * 100).toFixed(0)}%
                </button>
              ))}
            </div>
            <div className="text-[13px] text-gray-400 mt-1">
              ปรับลดหากมั่นใจว่าสุขภาพดี / มีครอบครัวช่วยดูแลบางส่วน
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-500">ผลตอบแทนหลังเกษียณ (discount)</span>
                {isLinked.postRetireReturn && (
                  <span className="text-[13px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">จากสมมติฐาน</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step={0.1}
                  value={(p.postRetireReturn * 100).toFixed(1)}
                  onChange={(e) => store.updateCaretakerParam("postRetireReturn", Number(e.target.value) / 100)}
                  className="w-16 text-sm font-bold bg-gray-50 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-pink-400 text-right"
                />
                <span className="text-[13px] text-gray-400">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl border-2 border-pink-200 p-4 space-y-3">
          <div className="text-xs font-bold text-pink-700">📊 ผลลัพธ์</div>

          <div className="grid grid-cols-2 gap-2 text-[13px]">
            <Stat label="จำนวนปีที่ต้องใช้" value={`${result.yearsNeeded} ปี`} />
            <Stat label="ค่าจ้าง/เดือน ณ เริ่มใช้" value={`฿${fmt(result.monthlyAtStart)}`} />
            <Stat label="รวมค่าใช้จ่ายทั้งหมด" value={`฿${fmt(result.totalCostFV)}`} sub={`(ไม่ discount)`} />
            <Stat label="คูณโอกาสใช้จริง" value={`×${(p.probability * 100).toFixed(0)}%`} />
          </div>

          <div className="glass rounded-xl p-4 border border-pink-200 text-center">
            <div className="text-[13px] text-gray-500 font-medium">NPV ณ วันเกษียณ</div>
            <div className="text-2xl font-extrabold text-pink-700 mt-1">
              ฿{fmt(result.npvAtRetire)}
            </div>
            <div className="text-[13px] text-gray-400 mt-1">
              ใช้เป็นทุนสำรองในค่าใช้จ่ายพิเศษหลังเกษียณ
            </div>
          </div>
        </div>

        {/* Year-by-year table (collapsible) */}
        {result.rows.length > 0 && (
          <details className="glass rounded-2xl overflow-hidden">
            <summary className="px-4 py-3 cursor-pointer text-xs font-bold text-gray-600 hover:bg-gray-50 select-none">
              📋 รายละเอียดแต่ละปี ({result.rows.length} ปี)
            </summary>
            <div className="overflow-x-auto border-t border-gray-200">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="text-center py-2 px-2 font-bold text-gray-600">อายุ</th>
                    <th className="text-right py-2 px-2 font-bold text-gray-600">ค่าจ้าง/เดือน</th>
                    <th className="text-right py-2 px-2 font-bold text-gray-600">ค่าใช้จ่าย/ปี</th>
                    <th className="text-right py-2 px-2 font-bold text-gray-600">PV ณ วันเกษียณ</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.age} className="border-b border-gray-100">
                      <td className="text-center py-1.5 px-2 font-bold text-gray-700">{row.age}</td>
                      <td className="text-right py-1.5 px-2 text-gray-600">{fmt(row.monthlyAtAge)}</td>
                      <td className="text-right py-1.5 px-2 text-gray-600">{fmt(row.annualAtAge)}</td>
                      <td className="text-right py-1.5 px-2 font-bold text-pink-700">{fmt(row.pvAtRetire)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-pink-50">
                  <tr>
                    <td colSpan={3} className="text-right py-2 px-2 font-bold text-gray-700">รวม NPV (× โอกาสใช้จริง)</td>
                    <td className="text-right py-2 px-2 font-extrabold text-pink-700">{fmt(result.npvAtRetire)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </details>
        )}

        {/* Save */}
        <ActionButton
          label="บันทึกเพื่อใช้ในแผน"
          successLabel="บันทึกแล้ว ← กลับไปดึงในหน้าค่าใช้จ่ายพิเศษ"
          onClick={handleSave}
          hasCompleted={hasSaved}
          variant="primary"
          icon={<ArrowUpFromLine size={16} />}
        />
      </div>

      {/* Info Modal */}
      {showInfo && (
        <div
          className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="glass w-full max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gradient-to-br from-pink-500 to-rose-500 text-white px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h3 className="text-sm font-bold">วิธีคำนวณ NPV ค่าคนดูแล</h3>
              </div>
              <button onClick={() => setShowInfo(false)} className="text-white/70 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 text-gray-700 text-[14px] leading-relaxed">
              <div className="bg-pink-50 border border-pink-200 rounded-xl p-3">
                <div className="font-bold text-pink-700 text-xs mb-1">🎯 หลักคิด</div>
                <div>สะสมค่าคนดูแลรายปีตั้งแต่ <b>อายุที่เริ่มใช้</b> ถึง <b>อายุขัย + ปีเผื่อ</b> แล้ว discount กลับมาที่ <b>วันเกษียณ</b></div>
              </div>

              <div className="space-y-2">
                <Step n={1} title="จำนวนปีที่จ้าง">
                  <code className="text-pink-600">(อายุขัย + ปีเผื่อ) − อายุเริ่มจ้าง + 1</code>
                </Step>
                <Step n={2} title="ค่าจ้าง/เดือน ณ แต่ละปี">
                  <code className="text-pink-600">current × (1 + inflation)^(อายุ − อายุปัจจุบัน)</code>
                </Step>
                <Step n={3} title="Present Value ณ วันเกษียณ">
                  <code className="text-pink-600">ค่าจ้าง/ปี ÷ (1 + return)^(อายุ − อายุเกษียณ)</code>
                </Step>
                <Step n={4} title="รวม PV × โอกาสใช้จริง">
                  <code className="text-pink-600">Σ PV × probability</code>
                </Step>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="font-bold text-blue-700 text-xs mb-1">💡 ข้อแนะนำ</div>
                <ul className="space-y-1 list-disc pl-4">
                  <li>ใช้เงินเฟ้อ <b>5-7%</b> สำหรับค่าจ้างแรงงาน (สูงกว่าเงินเฟ้อทั่วไป)</li>
                  <li>อายุเริ่มใช้ <b>75-80</b> เป็นค่าที่พบบ่อย</li>
                  <li><b>ปีเผื่อเกินอายุขัย</b> แนะนำ 5 ปี (เผื่อกรณีอายุยืนเกินคาด)</li>
                  <li>ลดโอกาสใช้จริงได้ถ้ามีครอบครัวช่วย / สุขภาพดี</li>
                </ul>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3">
              <button
                onClick={() => setShowInfo(false)}
                className="w-full py-2.5 rounded-xl bg-pink-500 text-white text-sm font-bold hover:bg-pink-600 transition"
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

// ─── Sub-components ───────────────────────

function AgeRow({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
  sourceLabel,
  sourceValue,
  isLinked,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix: string;
  sourceLabel?: string;
  sourceValue?: number;
  isLinked?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-700">{label}</span>
          {sourceLabel && (
            <span
              className={`text-[13px] px-1.5 py-0.5 rounded-full font-medium ${
                isLinked ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {isLinked ? `จาก ${sourceLabel}` : `ปรับเอง (ต้นฉบับ ${sourceValue})`}
            </span>
          )}
        </div>
        {hint && <div className="text-[13px] text-gray-400 mt-0.5">{hint}</div>}
      </div>
      <input
        type="number"
        min={min}
        max={max}
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-20 text-sm font-bold bg-gray-50 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-pink-400 text-center"
      />
      <span className="text-[13px] text-gray-400 w-6">{suffix}</span>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white/80 rounded-lg px-2.5 py-2">
      <div className="text-gray-500 text-[13px]">{label}</div>
      <div className="font-bold text-pink-700 text-xs mt-0.5">{value}</div>
      {sub && <div className="text-[12px] text-gray-400">{sub}</div>}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <div className="w-5 h-5 rounded-full bg-pink-500 text-white text-[13px] font-bold flex items-center justify-center shrink-0">
        {n}
      </div>
      <div className="flex-1">
        <div className="font-bold text-gray-800 text-[14px]">{title}</div>
        <div className="bg-gray-50 rounded px-2 py-1 mt-0.5 text-[13px]">{children}</div>
      </div>
    </div>
  );
}
