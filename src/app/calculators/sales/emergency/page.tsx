"use client";

/**
 * /calculators/sales/emergency — Emergency Fund (Pyramid base layer).
 *
 * Sales pitch: "ตกงาน เจ็บป่วย หรือเหตุไม่คาดฝัน — มีเงินใช้ได้กี่เดือน?"
 * Customer ranks essential expenses with a checklist + add-custom,
 * then the calculator shows the buffer they need (3-6 months) and
 * compares 3 ways to park the cash (Savings / MMF / Emergency MF).
 *
 * No external rate engine — just monthly-expense math.
 */

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Wallet,
  Home,
  Car,
  Utensils,
  Baby,
  CreditCard,
  Plus,
  Trash2,
  TrendingUp,
  ArrowDown,
  ArrowUp,
  Target,
  Printer,
  Share2,
  Sparkles,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import FlagGate from "@/components/FlagGate";
import {
  ProgressNav,
  ActHeader,
  VerdictCard,
  SummaryBullet,
  Disclaimer,
  NextActButton,
  useActiveAct,
  PAL,
  fmtBaht,
  fmtBahtShort,
} from "@/components/sales/SalesShell";

// ─── Default expense categories ────────────────────────────────────

interface ExpenseItem {
  id: string;
  label: string;
  iconKey: "home" | "utensils" | "car" | "baby" | "credit" | "wallet";
  amount: number;
  /** Default suggestion for the chip-row (acts as "starter" amount). */
  defaultAmt: number;
  enabled: boolean;
}

const ICON_MAP = {
  home: Home,
  utensils: Utensils,
  car: Car,
  baby: Baby,
  credit: CreditCard,
  wallet: Wallet,
} as const;

const DEFAULT_EXPENSES: ExpenseItem[] = [
  { id: "rent", label: "ค่าที่อยู่ / ผ่อนบ้าน", iconKey: "home", amount: 15000, defaultAmt: 15000, enabled: true },
  { id: "food", label: "อาหาร", iconKey: "utensils", amount: 10000, defaultAmt: 10000, enabled: true },
  { id: "transport", label: "ค่าเดินทาง / รถ", iconKey: "car", amount: 5000, defaultAmt: 5000, enabled: true },
  { id: "kids", label: "ลูก / การศึกษา", iconKey: "baby", amount: 8000, defaultAmt: 8000, enabled: false },
  { id: "debt", label: "ผ่อนหนี้", iconKey: "credit", amount: 6000, defaultAmt: 6000, enabled: false },
  { id: "misc", label: "ค่าใช้จ่ายเบ็ดเตล็ด", iconKey: "wallet", amount: 5000, defaultAmt: 5000, enabled: true },
];

// ═══════════════════════════════════════════════════════════════════
// Page entry
// ═══════════════════════════════════════════════════════════════════

export default function EmergencyPage() {
  return (
    <FlagGate
      flag="victory_insurance_tools"
      fallbackEnabled={false}
      deniedTitle="ฟีเจอร์นี้สำหรับ Victory เท่านั้น"
      backHref="/"
      backLabel="กลับหน้าหลัก"
    >
      <EmergencyInner />
    </FlagGate>
  );
}

function EmergencyInner() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>(DEFAULT_EXPENSES);
  const [currentSavings, setCurrentSavings] = useState<number>(50_000);
  const [bufferMonths, setBufferMonths] = useState<3 | 6 | 12>(6);

  const totalMonthly = useMemo(
    () => expenses.filter((e) => e.enabled).reduce((s, e) => s + e.amount, 0),
    [expenses],
  );
  const requiredBuffer = totalMonthly * bufferMonths;
  const gap = requiredBuffer - currentSavings;
  const monthsCovered = totalMonthly > 0 ? currentSavings / totalMonthly : 0;

  // Sticky-nav refs
  const refs = {
    1: useRef<HTMLElement | null>(null),
    2: useRef<HTMLElement | null>(null),
    3: useRef<HTMLElement | null>(null),
    4: useRef<HTMLElement | null>(null),
    5: useRef<HTMLElement | null>(null),
  };
  const activeAct = useActiveAct(refs);
  const jump = (a: 1 | 2 | 3 | 4 | 5) =>
    refs[a].current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-screen" style={{ background: "#fafaf7" }}>
      <PageHeader
        title="เงินสำรองฉุกเฉิน"
        subtitle="Emergency Fund"
        backHref="/"
        icon={<ShieldAlert size={18} className="text-slate-600" />}
      />

      <ProgressNav
        active={activeAct}
        onJump={jump}
        labels={["รายจ่าย", "สรุป", "Survival", "เก็บที่ไหน", "Action Plan"]}
      />

      <div className="px-4 md:px-8 max-w-3xl mx-auto pb-24 space-y-12">
        <Act1
          ref={refs[1]}
          expenses={expenses}
          setExpenses={setExpenses}
          totalMonthly={totalMonthly}
          onNext={() => jump(2)}
        />
        <Act2
          ref={refs[2]}
          totalMonthly={totalMonthly}
          requiredBuffer={requiredBuffer}
          currentSavings={currentSavings}
          setCurrentSavings={setCurrentSavings}
          gap={gap}
          monthsCovered={monthsCovered}
          bufferMonths={bufferMonths}
          setBufferMonths={setBufferMonths}
          onNext={() => jump(3)}
        />
        <Act3
          ref={refs[3]}
          totalMonthly={totalMonthly}
          currentSavings={currentSavings}
          requiredBuffer={requiredBuffer}
          monthsCovered={monthsCovered}
          onNext={() => jump(4)}
        />
        <Act4 ref={refs[4]} requiredBuffer={requiredBuffer} onNext={() => jump(5)} />
        <Act5
          ref={refs[5]}
          totalMonthly={totalMonthly}
          requiredBuffer={requiredBuffer}
          currentSavings={currentSavings}
          gap={gap}
          monthsCovered={monthsCovered}
          bufferMonths={bufferMonths}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACT 1 — Hello / expense list
// ═══════════════════════════════════════════════════════════════════

const Act1 = forwardRef<
  HTMLElement,
  {
    expenses: ExpenseItem[];
    setExpenses: (e: ExpenseItem[]) => void;
    totalMonthly: number;
    onNext: () => void;
  }
>(function Act1({ expenses, setExpenses, totalMonthly, onNext }, ref) {
  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customAmt, setCustomAmt] = useState<number>(0);

  const update = (id: string, patch: Partial<ExpenseItem>) =>
    setExpenses(expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const remove = (id: string) =>
    setExpenses(expenses.filter((e) => e.id !== id));

  const addCustom = () => {
    if (!customLabel.trim()) return;
    setExpenses([
      ...expenses,
      {
        id: `c${Date.now()}`,
        label: customLabel,
        iconKey: "wallet",
        amount: customAmt,
        defaultAmt: customAmt,
        enabled: true,
      },
    ]);
    setCustomLabel("");
    setCustomAmt(0);
    setShowCustom(false);
  };

  return (
    <section ref={ref} data-act={1} className="pt-6 scroll-mt-16">
      <ActHeader actNumber={1} title="รายจ่ายจำเป็นของคุณ" subtitle="ใส่เฉพาะค่าใช้จ่ายที่ขาดไม่ได้" />

      <div
        className="rounded-2xl p-5 md:p-6"
        style={{ background: `linear-gradient(135deg, #475569 0%, #334155 100%)`, color: "white" }}
      >
        <div className="text-[11px] font-bold tracking-[0.2em] mb-1 text-slate-300">
          THE FOUNDATION
        </div>
        <h2 className="text-lg font-bold leading-snug mb-1">
          เงินสำรองฉุกเฉิน — ฐานของการเงินที่มั่นคง
        </h2>
        <p className="text-[13px] opacity-80 leading-relaxed">
          ตกงาน เจ็บป่วย เหตุไม่คาดฝัน — ก่อนคิดเรื่องลงทุน ต้องมีเงินสำรองพอใช้ 3-6 เดือนก่อน
        </p>
      </div>

      <div className="bg-white rounded-2xl mt-4 shadow-sm border border-gray-100 overflow-hidden">
        {expenses.map((e, i) => {
          const Icon = ICON_MAP[e.iconKey];
          return (
            <div
              key={e.id}
              className={`flex items-center gap-3 p-3 border-b border-gray-100 last:border-b-0 ${
                e.enabled ? "" : "opacity-60"
              }`}
            >
              <button
                onClick={() => update(e.id, { enabled: !e.enabled })}
                className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition ${
                  e.enabled ? "bg-slate-700 border-slate-700" : "border-gray-300"
                }`}
              >
                {e.enabled && <span className="text-white text-[12px] leading-none">✓</span>}
              </button>
              <div className="w-8 h-8 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center">
                <Icon size={16} className="text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-gray-800 truncate">{e.label}</div>
              </div>
              <input
                type="number"
                value={e.amount || ""}
                onChange={(ev) => update(e.id, { amount: Number(ev.target.value) || 0 })}
                placeholder={String(e.defaultAmt)}
                disabled={!e.enabled}
                className="w-24 text-right text-sm font-bold bg-gray-50 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
              />
              <span className="text-[11px] text-gray-400 w-8">฿/ด.</span>
              {i >= DEFAULT_EXPENSES.length && (
                <button
                  onClick={() => remove(e.id)}
                  className="p-1 text-gray-300 hover:text-red-500"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}

        {showCustom ? (
          <div className="p-3 bg-slate-50 border-t border-gray-200 space-y-2">
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="เช่น ค่าน้ำ ค่าไฟ ค่าเน็ต"
              className="w-full text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
              autoFocus
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={customAmt || ""}
                onChange={(e) => setCustomAmt(Number(e.target.value) || 0)}
                placeholder="0"
                className="flex-1 text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
              />
              <button
                onClick={addCustom}
                className="px-3 py-2 rounded-lg bg-slate-700 text-white text-sm font-bold"
              >
                เพิ่ม
              </button>
              <button
                onClick={() => setShowCustom(false)}
                className="px-3 py-2 rounded-lg bg-gray-200 text-gray-600 text-sm"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCustom(true)}
            className="w-full p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-center gap-1 text-[12px] font-bold text-gray-600 hover:bg-gray-100 transition"
          >
            <Plus size={14} /> เพิ่มรายจ่ายเอง
          </button>
        )}

        <div className="p-3 bg-slate-700 text-white flex items-center justify-between">
          <div className="text-[12px] font-bold opacity-90">รายจ่ายจำเป็นรวม</div>
          <div className="text-base font-extrabold">฿{fmtBaht(totalMonthly)}/เดือน</div>
        </div>
      </div>

      {totalMonthly > 0 && (
        <NextActButton onClick={onNext} label="คำนวณเงินสำรองที่ควรมี →" icon={<Sparkles size={16} />} />
      )}
    </section>
  );
});

// ═══════════════════════════════════════════════════════════════════
// ACT 2 — Verdict
// ═══════════════════════════════════════════════════════════════════

const Act2 = forwardRef<
  HTMLElement,
  {
    totalMonthly: number;
    requiredBuffer: number;
    currentSavings: number;
    setCurrentSavings: (v: number) => void;
    gap: number;
    monthsCovered: number;
    bufferMonths: 3 | 6 | 12;
    setBufferMonths: (v: 3 | 6 | 12) => void;
    onNext: () => void;
  }
>(function Act2(
  { totalMonthly, requiredBuffer, currentSavings, setCurrentSavings, gap, monthsCovered, bufferMonths, setBufferMonths, onNext },
  ref,
) {
  const status: "danger" | "warn" | "ok" =
    monthsCovered < 3 ? "danger" : monthsCovered < 6 ? "warn" : "ok";
  return (
    <section ref={ref} data-act={2} className="scroll-mt-16">
      <ActHeader actNumber={2} title="คุณมีเงินสำรองพอไหม?" subtitle="3 ตัวเลขที่ควรรู้" />

      {/* Buffer level chips */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-[11px] text-gray-500">ฉันต้องการสำรอง</span>
        {([3, 6, 12] as const).map((m) => (
          <button
            key={m}
            onClick={() => setBufferMonths(m)}
            className={`text-[11px] font-bold px-2 py-1 rounded-md transition ${
              bufferMonths === m ? "bg-slate-700 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {m} เดือน
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <VerdictCard
          tone="red" icon={<ArrowDown size={14} />}
          label="รายจ่าย/เดือน"
          mainValue={`฿${fmtBahtShort(totalMonthly)}`}
          mainSub="เฉพาะที่ขาดไม่ได้"
          footer={`× ${bufferMonths} เดือน`}
        />
        <VerdictCard
          tone="amber" icon={<Target size={14} />}
          label="ต้องสำรอง"
          mainValue={`฿${fmtBahtShort(requiredBuffer)}`}
          mainSub={`= ${bufferMonths} เดือน × รายจ่าย`}
          footer="เป้าหมาย"
        />
        <VerdictCard
          tone={status === "ok" ? "green" : status === "warn" ? "amber" : "red"}
          icon={status === "ok" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          label="ตอนนี้มี"
          mainValue={`฿${fmtBahtShort(currentSavings)}`}
          mainSub={`= ${monthsCovered.toFixed(1)} เดือน`}
          footer={gap > 0 ? `ขาด ฿${fmtBahtShort(gap)}` : "✓ พอแล้ว"}
        />
      </div>

      {/* Editable current savings */}
      <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
        <Wallet size={18} className="text-gray-400" />
        <label className="text-[12px] text-gray-600 flex-1">เงินสดที่มีในออมทรัพย์ตอนนี้</label>
        <input
          type="number"
          value={currentSavings || ""}
          onChange={(e) => setCurrentSavings(Number(e.target.value) || 0)}
          placeholder="0"
          className="w-32 text-right text-sm font-bold bg-gray-50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      {/* Verdict ribbon */}
      <div
        className="mt-3 rounded-xl p-3 flex items-start gap-2.5 border"
        style={{
          background: status === "ok" ? PAL.greenSoft : status === "warn" ? PAL.orangeSoft : PAL.redSoft,
          borderColor: status === "ok" ? PAL.green : status === "warn" ? PAL.orange : PAL.red,
        }}
      >
        <span className="text-base">{status === "ok" ? "🟢" : status === "warn" ? "🟡" : "🔴"}</span>
        <div className="text-[13px] font-bold leading-snug" style={{
          color: status === "ok" ? PAL.green : status === "warn" ? PAL.orange : PAL.red,
        }}>
          {status === "ok"
            ? `ดีมาก! เงินสำรองพอใช้ ${monthsCovered.toFixed(1)} เดือน คุณพร้อมไปลงทุนชั้นถัดไปได้`
            : status === "warn"
              ? `ดีระดับหนึ่ง — แต่ยังขาด ฿${fmtBahtShort(gap)} ก่อนถึงเป้าหมาย ${bufferMonths} เดือน`
              : `อันตราย! เงินสำรองอยู่ได้แค่ ${monthsCovered.toFixed(1)} เดือน — ควรเร่งสะสมก่อน`}
        </div>
      </div>

      <NextActButton onClick={onNext} label="ดูสถานการณ์ Survival →" icon={<TrendingUp size={16} />} />
    </section>
  );
});

// ═══════════════════════════════════════════════════════════════════
// ACT 3 — Survival timeline ("ถ้าตกงาน N เดือน")
// ═══════════════════════════════════════════════════════════════════

const Act3 = forwardRef<
  HTMLElement,
  {
    totalMonthly: number;
    currentSavings: number;
    requiredBuffer: number;
    monthsCovered: number;
    onNext: () => void;
  }
>(function Act3({ totalMonthly, currentSavings, monthsCovered, onNext }, ref) {
  const [scrubMonth, setScrubMonth] = useState<number>(0);
  const maxMonths = Math.max(12, Math.ceil(monthsCovered + 4));
  const remainingAt = (m: number) => Math.max(0, currentSavings - m * totalMonthly);
  const remaining = remainingAt(scrubMonth);
  const survived = remaining > 0;

  return (
    <section ref={ref} data-act={3} className="scroll-mt-16">
      <ActHeader actNumber={3} title="🕰 ถ้าตกงานวันนี้..." subtitle="คุณจะอยู่ได้กี่เดือน" />

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[12px] text-gray-500">ตกงานมาแล้ว</div>
          <div className="text-3xl font-extrabold" style={{ color: PAL.deepNavy }}>
            {scrubMonth} <span className="text-base font-normal text-gray-400">เดือน</span>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={maxMonths}
          value={scrubMonth}
          onChange={(e) => setScrubMonth(Number(e.target.value))}
          className="w-full accent-slate-700"
          style={{ height: 6 }}
        />
        <div className="flex justify-between text-[11px] text-gray-400 mt-1">
          <span>วันแรก</span>
          <span>{maxMonths} เดือน</span>
        </div>

        <div
          className="mt-4 rounded-xl p-4 flex items-start gap-3 border"
          style={{
            background: survived ? PAL.greenSoft : PAL.redSoft,
            borderColor: survived ? PAL.green : PAL.red,
          }}
        >
          <span className="text-2xl">{survived ? "🟢" : "🔴"}</span>
          <div>
            <div className="text-[11px] font-bold tracking-[0.15em]" style={{
              color: survived ? PAL.green : PAL.red,
            }}>
              {survived ? "ยังอยู่ได้" : "เงินหมดแล้ว"}
            </div>
            <div className="text-base font-extrabold mt-1" style={{ color: PAL.deepNavy }}>
              {survived ? `เหลือ ฿${fmtBaht(remaining)}` : `ขาด ฿${fmtBaht(scrubMonth * totalMonthly - currentSavings)}`}
            </div>
            <div className="text-[12px] text-gray-600 mt-1">
              {survived
                ? `อยู่ได้อีก ${(remaining / totalMonthly).toFixed(1)} เดือน`
                : `ต้องกู้/ขายของ/ขอจากครอบครัว`}
            </div>
          </div>
        </div>

        {/* Quick milestones */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {[0, 3, 6, 12, Math.floor(monthsCovered)].filter((v, i, arr) => arr.indexOf(v) === i && v <= maxMonths).sort((a, b) => a - b).map((m) => (
            <button
              key={m}
              onClick={() => setScrubMonth(m)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition ${
                scrubMonth === m
                  ? "bg-gray-900 text-white"
                  : m === Math.floor(monthsCovered)
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {m === Math.floor(monthsCovered) && "💸 "}
              {m === 0 ? "เริ่ม" : `${m} เดือน`}
            </button>
          ))}
        </div>
      </div>

      <NextActButton onClick={onNext} label="ควรเก็บเงินสำรองที่ไหน →" />
    </section>
  );
});

// ═══════════════════════════════════════════════════════════════════
// ACT 4 — Where to park the cash (3-way comparison)
// ═══════════════════════════════════════════════════════════════════

const Act4 = forwardRef<
  HTMLElement,
  { requiredBuffer: number; onNext: () => void }
>(function Act4({ requiredBuffer, onNext }, ref) {
  // Annual yield × buffer for "earning" comparison
  const yields = {
    savings: 0.005, // 0.5% — ออมทรัพย์ทั่วไป
    mmf: 0.022,     // 2.2% — Money Market Fund (กองตลาดเงิน)
    eMf: 0.030,     // 3.0% — Emergency MF (ตราสารหนี้ระยะสั้น)
  };
  const yearly = (rate: number) => requiredBuffer * rate;

  const options = [
    {
      key: "savings",
      title: "ออมทรัพย์ธนาคาร",
      yield: yields.savings,
      pros: ["ถอนได้ทันที", "ปลอดภัยที่สุด"],
      cons: ["ดอกเบี้ยน้อยมาก ไม่ทันเงินเฟ้อ"],
      tone: "blue" as const,
    },
    {
      key: "mmf",
      title: "Money Market Fund",
      yield: yields.mmf,
      pros: ["ถอนได้ T+1", "ดอกเบี้ยสูงกว่าธนาคาร"],
      cons: ["ต้องเปิดบัญชี บลจ.", "ไม่การันตี"],
      tone: "green" as const,
    },
    {
      key: "eMf",
      title: "กองตราสารหนี้สั้น",
      yield: yields.eMf,
      pros: ["ดอกเบี้ยดีที่สุดในกลุ่มสภาพคล่อง", "เหมาะระยะกลาง"],
      cons: ["ถอนช้ากว่า T+2-3", "อาจติดลบสั้นๆ"],
      tone: "gold" as const,
    },
  ];

  return (
    <section ref={ref} data-act={4} className="scroll-mt-16">
      <ActHeader actNumber={4} title="⚖ ควรเก็บเงินสำรองที่ไหน" subtitle="3 ตัวเลือกที่นิยม" />

      <div className="space-y-3">
        {options.map((o) => (
          <div
            key={o.key}
            className="bg-white rounded-2xl p-4 shadow-sm border-2"
            style={{
              borderColor: o.tone === "gold" ? PAL.gold : "#e5e7eb",
            }}
          >
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-base font-bold" style={{ color: PAL.deepNavy }}>{o.title}</div>
              <div className="text-base font-extrabold" style={{ color: o.tone === "gold" ? PAL.goldDark : PAL.green }}>
                {(o.yield * 100).toFixed(1)}%/ปี
              </div>
            </div>
            <div className="text-[12px] text-gray-500 mb-2">
              ฝาก ฿{fmtBahtShort(requiredBuffer)} → ดอก ฿{fmtBahtShort(yearly(o.yield))}/ปี
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <div className="text-[10px] font-bold tracking-[0.15em] text-emerald-600 mb-1">✓ ดี</div>
                <ul className="text-[12px] text-gray-700 space-y-0.5">
                  {o.pros.map((p, i) => <li key={i}>• {p}</li>)}
                </ul>
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-[0.15em] text-rose-600 mb-1">✗ ระวัง</div>
                <ul className="text-[12px] text-gray-700 space-y-0.5">
                  {o.cons.map((c, i) => <li key={i}>• {c}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-3 rounded-xl p-3 border flex items-start gap-2"
        style={{ background: PAL.goldSoft, borderColor: PAL.gold }}
      >
        <span className="text-base">💡</span>
        <div className="text-[12px] text-gray-700 leading-relaxed">
          <span className="font-bold" style={{ color: PAL.deepNavy }}>คำแนะนำ:</span>{" "}
          แบ่ง 1 เดือนแรก = ออมทรัพย์ (ฉุกเฉินจริงๆ) · ที่เหลือ 2-5 เดือน = MMF/กองตราสารหนี้สั้น (ได้ดอกเพิ่ม)
        </div>
      </div>

      <NextActButton onClick={onNext} label="ดูสรุปแผน →" />
    </section>
  );
});

// ═══════════════════════════════════════════════════════════════════
// ACT 5 — Summary
// ═══════════════════════════════════════════════════════════════════

const Act5 = forwardRef<
  HTMLElement,
  {
    totalMonthly: number;
    requiredBuffer: number;
    currentSavings: number;
    gap: number;
    monthsCovered: number;
    bufferMonths: 3 | 6 | 12;
  }
>(function Act5({ totalMonthly, requiredBuffer, currentSavings, gap, monthsCovered, bufferMonths }, ref) {
  return (
    <section ref={ref} data-act={5} className="scroll-mt-16">
      <ActHeader actNumber={5} title="📋 สรุปแผนสำรองฉุกเฉิน" subtitle="ก่อนไปชั้นถัดไปของ Pyramid" />

      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100">
        <div className="space-y-3">
          <SummaryBullet
            icon={<ArrowDown size={14} className="text-rose-600" />}
            title="รายจ่ายจำเป็นต่อเดือน"
            body={`฿${fmtBaht(totalMonthly)}`}
            sub="เฉพาะค่าใช้จ่ายที่ขาดไม่ได้"
          />
          <SummaryBullet
            icon={<Target size={14} className="text-amber-600" />}
            title={`เป้าหมายเงินสำรอง ${bufferMonths} เดือน`}
            body={`฿${fmtBaht(requiredBuffer)}`}
            sub={`= ${bufferMonths} เดือน × รายจ่ายต่อเดือน`}
          />
          <SummaryBullet
            icon={gap > 0 ? <ArrowDown size={14} className="text-rose-600" /> : <ArrowUp size={14} className="text-emerald-600" />}
            title="สถานะปัจจุบัน"
            body={
              gap > 0
                ? `มี ฿${fmtBaht(currentSavings)} ขาดอีก ฿${fmtBaht(gap)}`
                : `มี ฿${fmtBaht(currentSavings)} เกินเป้าหมาย ฿${fmtBaht(-gap)}`
            }
            sub={`อยู่ได้ ${monthsCovered.toFixed(1)} เดือน`}
          />
          <SummaryBullet
            icon={<Wallet size={14} className="text-blue-600" />}
            title="แนะนำที่เก็บ"
            body="1 เดือน = ออมทรัพย์ · ที่เหลือ = MMF/กองตราสารหนี้สั้น"
            sub="ได้ดอกเบี้ย 2-3%/ปี ดีกว่าฝากธนาคารธรรมดา"
          />
        </div>

        <div className="mt-5">
          <Disclaimer
            title="ข้อแนะนำ"
            bullets={[
              "ก่อนซื้อประกันชีวิต/ลงทุน ควรมีเงินสำรองครบเป้าก่อน",
              "อาชีพเสี่ยง (Freelance, ขายของ) ควรสำรอง 12 เดือน",
              "ครอบครัวมีลูก ควรสำรอง 6 เดือนขึ้นไป",
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <button
          onClick={() => typeof window !== "undefined" && window.print()}
          className="py-3 rounded-xl text-sm font-bold border-2 transition active:scale-[0.99] flex items-center justify-center gap-2"
          style={{ borderColor: PAL.deepNavy, color: PAL.deepNavy }}
        >
          <Printer size={14} /> พิมพ์ / PDF
        </button>
        <button
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.share) {
              navigator.share({
                title: "เงินสำรองฉุกเฉิน",
                text: `ต้องสำรอง ฿${fmtBahtShort(requiredBuffer)} (${bufferMonths} เดือน × ฿${fmtBahtShort(totalMonthly)})`,
              });
            }
          }}
          className="py-3 rounded-xl text-sm font-bold transition active:scale-[0.99] flex items-center justify-center gap-2"
          style={{ background: PAL.deepNavy, color: "white" }}
        >
          <Share2 size={14} /> ส่งสรุปให้ลูกค้า
        </button>
      </div>

      <Link href="/" className="block mt-3 py-2.5 rounded-xl text-[12px] text-center text-gray-500 hover:text-gray-700">
        ← กลับ Pyramid
      </Link>
    </section>
  );
});
