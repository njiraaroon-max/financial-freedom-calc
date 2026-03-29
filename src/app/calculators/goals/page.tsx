"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus, Save, Pencil, Trash2, X,
  ShieldAlert, HeartPulse, Banknote, Palmtree,
  Plane, Home, Car, Heart, GraduationCap,
  Briefcase, Star, ArrowRight, Target,
  ChevronUp, ChevronDown,
} from "lucide-react";
import {
  useGoalsStore,
  PRESET_GOALS,
  GoalItem,
  GoalCategory,
  GoalFrequency,
  PresetGoal,
} from "@/store/goals-store";
import { useVariableStore } from "@/store/variable-store";
import { useProfileStore } from "@/store/profile-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";

// ─── helpers ────────────────────────────────────────────────────────────────
const CURRENT_YEAR_CE = new Date().getFullYear(); // 2026
const CE_TO_BE = 543;

// Navy blue palette (matches reference table)
const NAVY       = "#1e3a6e"; // primary — headers, axis, dots
const NAVY_MID   = "#6b8fbf"; // stems
const NAVY_LIGHT = "#b8cfe8"; // arrow lines / yearly row
const NAVY_PALE  = "#e2edf8"; // grid lines / bg tints

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

// Icon map — navy
const ICON_MAP: Record<string, React.ReactNode> = {
  ShieldAlert:   <ShieldAlert   size={20} style={{ color: NAVY }} />,
  HeartPulse:    <HeartPulse    size={20} style={{ color: NAVY }} />,
  Banknote:      <Banknote      size={20} style={{ color: NAVY }} />,
  Palmtree:      <Palmtree      size={20} style={{ color: NAVY }} />,
  Plane:         <Plane         size={20} style={{ color: NAVY }} />,
  Home:          <Home          size={20} style={{ color: NAVY }} />,
  Car:           <Car           size={20} style={{ color: NAVY }} />,
  Heart:         <Heart         size={20} style={{ color: NAVY }} />,
  GraduationCap: <GraduationCap size={20} style={{ color: NAVY }} />,
  Briefcase:     <Briefcase     size={20} style={{ color: NAVY }} />,
  Star:          <Star          size={20} style={{ color: NAVY }} />,
  PiggyBank:     <Banknote      size={20} style={{ color: NAVY }} />,
};

const ICON_MAP_SM: Record<string, React.ReactNode> = {
  ShieldAlert:   <ShieldAlert   size={24} style={{ color: NAVY }} />,
  HeartPulse:    <HeartPulse    size={24} style={{ color: NAVY }} />,
  Banknote:      <Banknote      size={24} style={{ color: NAVY }} />,
  Palmtree:      <Palmtree      size={24} style={{ color: NAVY }} />,
  Plane:         <Plane         size={24} style={{ color: NAVY }} />,
  Home:          <Home          size={24} style={{ color: NAVY }} />,
  Car:           <Car           size={24} style={{ color: NAVY }} />,
  Heart:         <Heart         size={24} style={{ color: NAVY }} />,
  GraduationCap: <GraduationCap size={24} style={{ color: NAVY }} />,
  Briefcase:     <Briefcase     size={24} style={{ color: NAVY }} />,
  Star:          <Star          size={24} style={{ color: NAVY }} />,
  PiggyBank:     <Banknote      size={24} style={{ color: NAVY }} />,
};

function getPreset(category: GoalCategory): PresetGoal {
  return PRESET_GOALS.find((p) => p.category === category) ?? PRESET_GOALS[PRESET_GOALS.length - 1];
}

function getGoalIconName(g: GoalItem): string {
  return g.iconName || getPreset(g.category).iconName;
}

// ─── Timeline Component ──────────────────────────────────────────────────────

function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000)   return `${Math.round(n / 1000)}K`;
  return Math.round(n).toLocaleString("th-TH");
}

function GoalTimeline({
  goals,
  currentAge,
  retireAge,
  variables,
}: {
  goals: GoalItem[];
  currentAge: number;
  retireAge: number;
  variables: Record<string, { value: number; label: string }>;
}) {
  // Measure container width so timeline fits without scrolling
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(320);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.offsetWidth);
    const ro = new ResizeObserver((e) => setContainerWidth(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (goals.length === 0) return null;

  function resolveAmt(g: GoalItem): number | null {
    if (g.amount !== null) return g.amount;
    if (g.amountSourceKey && variables[g.amountSourceKey])
      return variables[g.amountSourceKey].value;
    return null;
  }

  // Separate yearly vs positioned
  const yearlyGoals = goals.filter((g) => g.frequency === "yearly");
  const positioned  = goals.filter((g) => g.frequency !== "yearly");

  // Attach plotAge
  const withAge = positioned.map((g) => ({
    ...g,
    plotAge:
      g.frequency === "immediate" ? currentAge
      : g.targetYear ? currentAge + (g.targetYear - CURRENT_YEAR_CE)
      : currentAge,
  }));
  withAge.sort((a, b) => a.plotAge - b.plotAge);

  // All goals go ABOVE the axis — stacked by level within same age
  const slotCount: Record<number, number> = {};
  const assignments = withAge.map((g) => {
    if (!slotCount[g.plotAge]) slotCount[g.plotAge] = 0;
    const level = slotCount[g.plotAge]++;
    return { ...g, level };
  });

  const maxLevel = assignments.reduce((m, a) => Math.max(m, a.level + 1), 0);

  // ── Geometry ──
  const YEARLY_ROW_H = 26;
  const LABEL_H      = 48; // icon(24) + gap(4) + amount(12) + pad(8)
  const STEM_H       = 8;
  const LEVEL_H      = LABEL_H + STEM_H; // 44px per level

  const yearlyAreaH = yearlyGoals.length > 0 ? yearlyGoals.length * YEARLY_ROW_H + 6 : 0;
  const goalsAreaH  = Math.max(maxLevel * LEVEL_H, maxLevel > 0 ? 44 : 0);
  const AXIS_Y      = yearlyAreaH + goalsAreaH + 4;
  const TICK_H      = 20;
  const totalH      = AXIS_Y + 2 + TICK_H + 8;

  // ── Width: fit container, no scrolling ──
  const L = 20, R = 20;
  const drawW  = Math.max(containerWidth - L - R, 1);
  const minAge = currentAge;
  const maxAge = Math.max(retireAge, ...assignments.map((a) => a.plotAge), currentAge + 1);
  const ageRange = maxAge - minAge;

  function xOf(age: number) {
    if (ageRange === 0) return L;
    return L + ((age - minAge) / ageRange) * drawW;
  }

  // Label top Y — level 0 is closest to axis
  function labelTopY(level: number) {
    return AXIS_Y - (level + 1) * LEVEL_H;
  }

  const ticks: number[] = [];
  for (let age = minAge; age <= maxAge; age++) ticks.push(age);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <div style={{ position: "relative", width: containerWidth, height: totalH }}>

        {/* ── Yearly goal rows (top section) ── */}
        {yearlyGoals.map((g, i) => {
          const amt = resolveAmt(g);
          return (
            <div key={g.id} style={{
              position: "absolute", top: i * YEARLY_ROW_H + 2, left: L, right: R,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              {ICON_MAP_SM[getGoalIconName(g)] ?? <Star size={24} className="text-[#1e3a6e]" />}
              <span style={{ fontSize: 11, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>
                {g.name}
              </span>
              {amt !== null && (
                <span style={{ fontSize: 11, color: NAVY, whiteSpace: "nowrap" }}>
                  ฿{fmt(amt)}
                </span>
              )}
              <div style={{ flex: 1, height: 2, background: NAVY_LIGHT }} />
              <ArrowRight size={11} className="text-blue-300 flex-shrink-0" />
            </div>
          );
        })}

        {/* ── Vertical grid lines at each age (behind everything) ── */}
        {ticks.map((age) => (
          <div key={`vl-${age}`} style={{
            position: "absolute",
            left: xOf(age),
            top: yearlyAreaH,
            width: 1,
            height: goalsAreaH + 4,
            background: NAVY_PALE,
            zIndex: 0,
          }} />
        ))}

        {/* ── Axis line ── */}
        <div style={{
          position: "absolute", top: AXIS_Y, left: L,
          width: drawW + 10, height: 2, background: NAVY, zIndex: 1,
        }} />
        <div style={{ position: "absolute", top: AXIS_Y - 5, right: R - 12, zIndex: 1 }}>
          <ArrowRight size={12} className="text-[#1e3a6e]" />
        </div>

        {/* ── Age ticks + labels ── */}
        {ticks.map((age) => (
          <div key={age} style={{ position: "absolute", left: xOf(age), top: AXIS_Y, zIndex: 1 }}>
            <div style={{ width: 1, height: 5, background: NAVY }} />
            <div style={{
              fontSize: 9, color: NAVY, fontWeight: 600,
              transform: "translateX(-50%)", marginTop: 2, whiteSpace: "nowrap",
            }}>
              {age}
            </div>
          </div>
        ))}

        {/* ── Stems (label bottom → axis) ── */}
        {assignments.map((a) => {
          const lt = labelTopY(a.level);
          const stemTop = lt + LABEL_H + 2;
          return (
            <div key={`stem-${a.id}`} style={{
              position: "absolute",
              left: xOf(a.plotAge), top: stemTop,
              width: 1, height: AXIS_Y - stemTop,
              background: NAVY_MID, zIndex: 1,
            }} />
          );
        })}

        {/* ── Dots on axis ── */}
        {assignments.map((a) => (
          <div key={`dot-${a.id}`} style={{
            position: "absolute",
            left: xOf(a.plotAge) - 7, top: AXIS_Y - 7,
            width: 14, height: 14, borderRadius: "50%",
            background: NAVY, zIndex: 3,
          }} />
        ))}

        {/* ── Labels (all above axis) ── */}
        {assignments.map((a) => {
          const amt    = resolveAmt(a);
          const lt     = labelTopY(a.level);
          return (
            <div key={`lbl-${a.id}`} style={{
              position: "absolute",
              left: xOf(a.plotAge), top: lt,
              transform: "translateX(-50%)",
              width: 64, height: LABEL_H,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 2,
              zIndex: 2,
            }}>
              {ICON_MAP_SM[getGoalIconName(a)] ?? <Star size={24} className="text-[#1e3a6e]" />}
              {amt !== null ? (
                <div style={{
                  fontSize: 9, fontWeight: 700, color: NAVY,
                  whiteSpace: "nowrap", textAlign: "center",
                }}>
                  {fmtShort(amt)}
                </div>
              ) : (
                <div style={{ fontSize: 8, color: "#9ca3af" }}>ไม่ทราบ</div>
              )}
            </div>
          );
        })}

      </div>
    </div>
  );
}

// ─── Goal Form ───────────────────────────────────────────────────────────────
type FormStep = "pick" | "fill";

interface FormState {
  name: string;
  category: GoalCategory;
  iconName: string; // chosen icon name
  amount: string;
  unknownAmount: boolean;
  targetYearBE: string; // พ.ศ.
  frequency: GoalFrequency;
  notes: string;
  amountSourceKey: string | null;
}

const AVAILABLE_ICONS = [
  "Star", "ShieldAlert", "HeartPulse", "Banknote", "Palmtree",
  "Plane", "Home", "Car", "Heart", "GraduationCap", "Briefcase",
  "Target",
] as const;

const defaultForm = (): FormState => ({
  name: "",
  category: "custom",
  iconName: "Star",
  amount: "",
  unknownAmount: false,
  targetYearBE: String(CURRENT_YEAR_CE + CE_TO_BE),
  frequency: "once",
  notes: "",
  amountSourceKey: null,
});

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function GoalsPage() {
  const { goals, addGoal, updateGoal, removeGoal, reorderGoals } = useGoalsStore();
  const { variables } = useVariableStore();
  const profile = useProfileStore();

  const currentAge = profile.getAge ? profile.getAge() : 35;
  const retireAge = profile.retireAge || 60;

  const [hasSaved, setHasSaved] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formStep, setFormStep] = useState<FormStep>("pick");
  const [form, setForm] = useState<FormState>(defaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Resolve amount for display
  function resolveAmount(g: GoalItem): { value: number | null; fromLabel: string | null } {
    if (g.amount !== null) return { value: g.amount, fromLabel: null };
    if (g.amountSourceKey && variables[g.amountSourceKey]) {
      const v = variables[g.amountSourceKey];
      return { value: v.value, fromLabel: v.label };
    }
    return { value: null, fromLabel: null };
  }

  // Format "เมื่อไร" for display
  function formatWhen(g: GoalItem): string {
    if (g.frequency === "immediate") return "ทันที";
    if (g.frequency === "yearly") return "ทุกปี";
    if (g.targetYear) return `ปี ${g.targetYear + CE_TO_BE}`;
    return "-";
  }

  // Format target age
  function formatAge(g: GoalItem): string {
    if (g.targetAge) return `อายุ ${g.targetAge}`;
    if (g.frequency === "immediate") return `อายุ ${currentAge}`;
    if (g.targetYear) {
      const age = currentAge + (g.targetYear - CURRENT_YEAR_CE);
      return age > currentAge ? `อายุ ${age}` : "";
    }
    return "";
  }

  // Total known amount
  const totalKnown = useMemo(() => {
    return goals.reduce((sum, g) => {
      const { value } = resolveAmount(g);
      return sum + (value ?? 0);
    }, 0);
  }, [goals, variables]);

  // ── Open modal to add ──
  function openAdd() {
    setForm(defaultForm());
    setEditingId(null);
    setFormStep("pick");
    setShowModal(true);
  }

  // ── Open modal to edit ──
  function openEdit(g: GoalItem) {
    const targetYearBE = g.targetYear ? String(g.targetYear + CE_TO_BE) : String(CURRENT_YEAR_CE + CE_TO_BE);
    setForm({
      name: g.name,
      category: g.category,
      iconName: g.iconName || getPreset(g.category).iconName,
      amount: g.amount !== null ? String(g.amount) : "",
      unknownAmount: g.amount === null,
      targetYearBE,
      frequency: g.frequency,
      notes: g.notes,
      amountSourceKey: g.amountSourceKey,
    });
    setEditingId(g.id);
    setFormStep("fill");
    setShowModal(true);
  }

  // ── Select preset from picker ──
  function selectPreset(preset: PresetGoal) {
    const resolvedAmt =
      preset.amountSourceKey && variables[preset.amountSourceKey]
        ? variables[preset.amountSourceKey].value
        : null;

    setForm({
      name: preset.name,
      category: preset.category,
      iconName: preset.iconName,
      amount: resolvedAmt !== null ? String(resolvedAmt) : "",
      unknownAmount: resolvedAmt === null && preset.amountSourceKey !== null,
      targetYearBE: String(CURRENT_YEAR_CE + CE_TO_BE),
      frequency: preset.defaultFrequency,
      notes: "",
      amountSourceKey: preset.amountSourceKey,
    });
    setFormStep("fill");
  }

  // ── Save goal ──
  function handleSaveGoal() {
    const amountNum = form.unknownAmount ? null : (Number(form.amount.replace(/[^0-9.]/g, "")) || null);
    const targetYearCE = form.frequency === "once"
      ? (Number(form.targetYearBE) - CE_TO_BE) || null
      : null;
    const targetAge = targetYearCE ? currentAge + (targetYearCE - CURRENT_YEAR_CE) : null;

    const payload = {
      name: form.name || getPreset(form.category).name,
      category: form.category,
      iconName: form.category === "custom" ? form.iconName : undefined,
      amount: amountNum,
      amountSourceKey: form.unknownAmount ? form.amountSourceKey : null,
      targetYear: targetYearCE,
      targetAge,
      frequency: form.frequency,
      notes: form.notes,
    };

    if (editingId) {
      updateGoal(editingId, payload);
    } else {
      addGoal(payload);
    }
    setShowModal(false);
    setHasSaved(false);
  }

  // ── Final save to variable store ──
  const { setVariable } = useVariableStore();
  function handleFinalSave() {
    setVariable({ key: "life_goals_count", label: "จำนวนเป้าหมาย", value: goals.length, source: "goals" });
    setVariable({ key: "life_goals_total", label: "มูลค่าเป้าหมายรวม", value: totalKnown, source: "goals" });
    setHasSaved(true);
  }

  // Ordered goals
  const sortedGoals = [...goals].sort((a, b) => a.order - b.order);

  // Move goal up/down in priority
  function moveGoal(idx: number, direction: "up" | "down") {
    const arr = [...sortedGoals];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= arr.length) return;
    [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
    reorderGoals(arr);
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="เป้าหมายชีวิต"
        subtitle="Life Goals"
        characterImg="/character/journey.png"
      />

      {/* ── Summary bar ── */}
      {goals.length > 0 && (
        <div className="px-4 md:px-8 pt-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex justify-between items-center">
            <div>
              <div className="text-xs text-gray-500">เป้าหมายทั้งหมด</div>
              <div className="text-xl font-extrabold text-gray-800">{goals.length} เป้าหมาย</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">มูลค่ารวม (ที่ทราบ)</div>
              <div className="text-xl font-extrabold text-[#1e3a6e]">฿{fmt(totalKnown)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Goal Table ── */}
      <div className="px-4 md:px-8 pt-4">
        {sortedGoals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
            <Target size={36} className="text-gray-300 mx-auto mb-3" />
            <div className="text-sm font-bold text-gray-500 mb-1">ยังไม่มีเป้าหมาย</div>
            <div className="text-xs text-gray-400">กดปุ่มด้านล่างเพื่อเพิ่มเป้าหมายแรก</div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[28px_28px_1fr_auto_auto_32px] gap-1.5 px-3 py-2.5 bg-gray-50 border-b border-gray-100">
              <div className="text-[10px] font-bold text-gray-500 text-center">#</div>
              <div className="text-[10px] font-bold text-gray-400 text-center">จัด</div>
              <div className="text-[10px] font-bold text-gray-500">เป้าหมาย</div>
              <div className="text-[10px] font-bold text-gray-500 text-right">เท่าไร</div>
              <div className="text-[10px] font-bold text-gray-500 text-right">เมื่อไร</div>
              <div />
            </div>

            {/* Rows */}
            {sortedGoals.map((g, idx) => {
              const preset = getPreset(g.category);
              const { value: amt, fromLabel } = resolveAmount(g);
              const ageStr = formatAge(g);

              return (
                <div
                  key={g.id}
                  className="grid grid-cols-[28px_28px_1fr_auto_auto_32px] gap-1.5 px-3 py-3 border-b border-gray-50 last:border-b-0 items-center"
                >
                  {/* # */}
                  <div className="text-xs font-bold text-gray-400 text-center">{idx + 1}</div>

                  {/* Sort up/down */}
                  <div className="flex flex-col items-center gap-0">
                    <button
                      onClick={() => moveGoal(idx, "up")}
                      disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 transition"
                    >
                      <ChevronUp size={12} className="text-gray-500" />
                    </button>
                    <button
                      onClick={() => moveGoal(idx, "down")}
                      disabled={idx === sortedGoals.length - 1}
                      className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 transition"
                    >
                      <ChevronDown size={12} className="text-gray-500" />
                    </button>
                  </div>

                  {/* Name + icon */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#e8f0f8] rounded-xl flex items-center justify-center">
                      {ICON_MAP_SM[getGoalIconName(g)] ?? <Star size={14} className="text-[#1e3a6e]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-800 truncate">{g.name}</div>
                      {g.notes ? (
                        <div className="text-[10px] text-gray-400 truncate">{g.notes}</div>
                      ) : (
                        ageStr && <div className="text-[10px] text-[#7a9fc4]">{ageStr}</div>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    {amt !== null ? (
                      <div>
                        <div className="text-xs font-bold text-gray-800">฿{fmt(amt)}</div>
                        {fromLabel && (
                          <div className="text-[9px] text-[#1e3a6e] whitespace-nowrap">จากแผนเกษียณ</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-400 italic">ไม่ทราบ</div>
                    )}
                  </div>

                  {/* When */}
                  <div className="text-right text-xs text-gray-600 whitespace-nowrap">
                    {formatWhen(g)}
                  </div>

                  {/* Edit button */}
                  <div className="flex items-center justify-center">
                    {deleteConfirmId === g.id ? (
                      <button
                        onClick={() => { removeGoal(g.id); setDeleteConfirmId(null); }}
                        className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center"
                      >
                        <Trash2 size={12} className="text-red-500" />
                      </button>
                    ) : (
                      <button
                        onClick={() => openEdit(g)}
                        className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center active:scale-95"
                      >
                        <Pencil size={12} className="text-gray-500" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Goal Button ── */}
      <div className="px-4 md:px-8 pt-3">
        <button
          onClick={openAdd}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-[#7a9fc4] text-[#1e3a6e] text-sm font-bold active:scale-[0.98] transition-all hover:bg-[#e8f0f8]"
        >
          <Plus size={18} />
          เพิ่มเป้าหมาย
        </button>
      </div>

      {/* ── Timeline ── */}
      {sortedGoals.length > 0 && (
        <div className="px-4 md:px-8 pt-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="text-xs font-bold text-gray-600 mb-4">📅 Timeline เป้าหมาย</div>
            <GoalTimeline
              goals={sortedGoals}
              currentAge={currentAge}
              retireAge={retireAge}
              variables={variables}
            />

            {/* Summary Table */}
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              {/* Header */}
              <div
                className="grid text-white text-[11px] font-bold"
                style={{
                  gridTemplateColumns: "36px 1fr 90px 90px 1fr",
                  background: NAVY,
                }}
              >
                <div className="py-2.5 text-center">ลำดับ</div>
                <div className="py-2.5 px-2">อะไร</div>
                <div className="py-2.5 text-center">เท่าไร</div>
                <div className="py-2.5 text-center">เมื่อไร</div>
                <div className="py-2.5 px-2">หมายเหตุ</div>
              </div>

              {/* Rows */}
              {sortedGoals.map((g, idx) => {
                const preset = getPreset(g.category);
                const { value: amt } = resolveAmount(g);

                // Format "เมื่อไร" detailed
                let whenStr = "";
                if (g.frequency === "immediate") {
                  whenStr = "ทันที";
                } else if (g.frequency === "yearly") {
                  whenStr = "ทุกปี";
                } else if (g.targetYear) {
                  const yearsAway = g.targetYear - CURRENT_YEAR_CE;
                  const ageAtGoal = currentAge + yearsAway;
                  const yearBE = g.targetYear + CE_TO_BE;
                  whenStr = `${yearsAway} ปี / ${ageAtGoal} / ${yearBE}`;
                }

                const isEven = idx % 2 === 1;
                return (
                  <div
                    key={g.id}
                    className="grid items-center text-[11px]"
                    style={{
                      gridTemplateColumns: "36px 1fr 90px 90px 1fr",
                      background: isEven ? NAVY_PALE : "#ffffff",
                      borderTop: `1px solid #d4e4f5`,
                    }}
                  >
                    <div className="py-2.5 text-center font-bold" style={{ color: NAVY }}>{idx + 1}</div>
                    <div className="py-2.5 px-2 flex items-center gap-1.5">
                      {ICON_MAP_SM[getGoalIconName(g)] ?? <Star size={14} style={{ color: NAVY }} />}
                      <span className="font-semibold text-gray-800">{g.name}</span>
                    </div>
                    <div className="py-2.5 text-center font-bold text-gray-800">
                      {amt !== null ? fmt(amt) : <span className="text-gray-400 font-normal text-[10px]">ไม่ทราบ</span>}
                    </div>
                    <div className="py-2.5 text-center text-gray-700">{whenStr}</div>
                    <div className="py-2.5 px-2 text-gray-500 text-[10px]">{g.notes || ""}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Save Button ── */}
      <div className="px-4 md:px-8 pb-8 pt-4">
        <ActionButton
          label="บันทึก"
          successLabel="บันทึกแล้ว"
          onClick={handleFinalSave}
          hasCompleted={hasSaved}
          variant="primary"
          icon={<Save size={18} />}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
              <div>
                <div className="text-sm font-extrabold text-gray-800">
                  {formStep === "pick" ? "เลือกเป้าหมาย" : editingId ? "แก้ไขเป้าหมาย" : "เพิ่มเป้าหมาย"}
                </div>
                {formStep === "fill" && (
                  <button
                    onClick={() => !editingId && setFormStep("pick")}
                    className="text-[11px] text-[#1e3a6e] mt-0.5"
                  >
                    {!editingId && "← เลือกใหม่"}
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4">
              {/* ── STEP 1: PRESET PICKER ── */}
              {formStep === "pick" && (
                <div className="grid grid-cols-3 gap-3">
                  {PRESET_GOALS.map((preset) => {
                    const resolvedAmt =
                      preset.amountSourceKey && variables[preset.amountSourceKey]
                        ? variables[preset.amountSourceKey].value
                        : null;
                    return (
                      <button
                        key={preset.category}
                        onClick={() => selectPreset(preset)}
                        className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-gray-100 hover:border-[#7a9fc4] hover:bg-[#e8f0f8] active:scale-95 transition-all"
                      >
                        <div className="w-10 h-10 bg-[#e8f0f8] rounded-2xl flex items-center justify-center">
                          {ICON_MAP[preset.iconName] ?? <Star size={20} className="text-[#1e3a6e]" />}
                        </div>
                        <div className="text-[11px] font-bold text-gray-700 text-center leading-tight">
                          {preset.name}
                        </div>
                        {resolvedAmt !== null && (
                          <div className="text-[9px] text-[#1e3a6e] font-semibold">
                            ฿{fmt(resolvedAmt)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── STEP 2: FILL FORM ── */}
              {formStep === "fill" && (
                <div className="space-y-4">
                  {/* Selected category indicator */}
                  <div className="flex items-center gap-3 p-3 bg-[#e8f0f8] rounded-2xl">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      {ICON_MAP[form.category === "custom" ? form.iconName : getPreset(form.category).iconName] ?? <Star size={20} className="text-[#1e3a6e]" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#1e3a6e]">{getPreset(form.category).name}</div>
                      <div className="text-[10px] text-[#7a9fc4]">{getPreset(form.category).description}</div>
                    </div>
                  </div>

                  {/* Icon picker for custom goals */}
                  {form.category === "custom" && (
                    <div>
                      <label className="text-[11px] text-gray-500 mb-1.5 block font-semibold">
                        เลือกไอคอน
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_ICONS.map((iconKey) => (
                          <button
                            key={iconKey}
                            type="button"
                            onClick={() => setForm({ ...form, iconName: iconKey })}
                            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                            style={{
                              background: form.iconName === iconKey ? NAVY : NAVY_PALE,
                              border: form.iconName === iconKey ? `2px solid ${NAVY}` : "2px solid transparent",
                            }}
                          >
                            <span style={{ color: form.iconName === iconKey ? "#fff" : NAVY }}>
                              {ICON_MAP[iconKey]}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Goal name */}
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1.5 block font-semibold">
                      ชื่อเป้าหมาย
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200"
                      placeholder={getPreset(form.category).name}
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1.5 block font-semibold">
                      จำนวนเงิน
                    </label>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="unknownAmount"
                        checked={form.unknownAmount}
                        onChange={(e) => setForm({ ...form, unknownAmount: e.target.checked })}
                        className="accent-blue-500 w-4 h-4"
                      />
                      <label htmlFor="unknownAmount" className="text-xs text-gray-500">
                        ไม่ทราบจำนวน
                        {form.amountSourceKey && (
                          <span className="ml-1 text-[#1e3a6e]">(จะดึงค่าจากแผนอื่นอัตโนมัติ)</span>
                        )}
                      </label>
                    </div>
                    {!form.unknownAmount && (
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold">฿</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={form.amount}
                          onChange={(e) => setForm({ ...form, amount: e.target.value })}
                          className="w-full text-sm bg-gray-50 rounded-xl pl-8 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200"
                          placeholder="0"
                        />
                      </div>
                    )}
                    {form.unknownAmount && form.amountSourceKey && variables[form.amountSourceKey] && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-[#e8f0f8] rounded-xl">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#e8f0f8]0" />
                        <span className="text-xs text-[#1e3a6e] font-semibold">
                          ค่าปัจจุบัน: ฿{fmt(variables[form.amountSourceKey].value)}
                        </span>
                        <span className="text-[10px] text-[#7a9fc4]">จากแผนเกษียณ</span>
                      </div>
                    )}
                  </div>

                  {/* Frequency */}
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1.5 block font-semibold">
                      ความถี่
                    </label>
                    <div className="flex gap-2">
                      {(["immediate", "once", "yearly"] as GoalFrequency[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setForm({ ...form, frequency: f })}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            form.frequency === f
                              ? "bg-[#1e3a6e] text-white shadow-lg shadow-[#b8cfe8]"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {f === "immediate" ? "ทันที" : f === "once" ? "ครั้งเดียว" : "ทุกปี"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Target Year (only for "once") */}
                  {form.frequency === "once" && (
                    <div>
                      <label className="text-[11px] text-gray-500 mb-1.5 block font-semibold">
                        ปีเป้าหมาย (พ.ศ.)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.targetYearBE}
                        onChange={(e) => setForm({ ...form, targetYearBE: e.target.value })}
                        className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200"
                        placeholder="เช่น 2573"
                      />
                      {form.targetYearBE && (
                        <div className="text-[10px] text-gray-400 mt-1">
                          อายุประมาณ {currentAge + (Number(form.targetYearBE) - CE_TO_BE - CURRENT_YEAR_CE)} ปี
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1.5 block font-semibold">
                      หมายเหตุ (ถ้ามี)
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={2}
                      className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 resize-none"
                      placeholder="เช่น รองรับค่าใช้จ่าย 6 เดือน"
                    />
                  </div>

                  {/* Save */}
                  <button
                    onClick={handleSaveGoal}
                    className="w-full py-4 rounded-2xl bg-[#1e3a6e] text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#b8cfe8] active:scale-[0.98] transition-all"
                  >
                    <Save size={16} />
                    {editingId ? "บันทึกการแก้ไข" : "เพิ่มเป้าหมาย"}
                  </button>

                  {/* Delete (edit mode) */}
                  {editingId && (
                    <button
                      onClick={() => {
                        if (deleteConfirmId === editingId) {
                          removeGoal(editingId);
                          setShowModal(false);
                          setDeleteConfirmId(null);
                        } else {
                          setDeleteConfirmId(editingId);
                        }
                      }}
                      className={`w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                        deleteConfirmId === editingId
                          ? "bg-red-500 text-white"
                          : "bg-red-50 text-red-500"
                      }`}
                    >
                      <Trash2 size={15} />
                      {deleteConfirmId === editingId ? "ยืนยันลบ" : "ลบเป้าหมายนี้"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
