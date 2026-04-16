"use client";

/**
 * CashflowItemCard — shared card UI for post-retirement income/expense items
 *
 * ใช้ทั้งใน:
 *   - special-expenses hub  (direction="expense")
 *   - saving-funds hub      (direction="income")
 *   - travel sub-calc page  (direction="expense", inline only)
 *
 * 3 Modes ตาม sourceKind:
 *   - "inline"    → editable full form (name + kind + amount + inflation + age)
 *   - "calc-link" → read-only summary + edit link (values from live registry)
 *   - "sub-calc"  → aggregate summary + button to sub-calc page
 */

import Link from "next/link";
import { useState } from "react";
import {
  Trash2,
  ChevronRight,
  Settings2,
  ExternalLink,
} from "lucide-react";
import type {
  CashflowItem,
  CashflowKind,
  SavingFundItem,
  SpecialExpenseItem,
  YearlyFlowRow,
} from "@/types/retirement";
import {
  expandToYearly,
  npvAtRetire,
  type CashflowContext,
  type CashflowContribution,
} from "@/lib/cashflow";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtM(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
}
function parseNum(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}

/** Normalize typed input: digits + single dot only */
function cleanNumericInput(raw: string): string {
  let cleaned = raw.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  return cleaned;
}

function averageAnnual(rows: YearlyFlowRow[]): number {
  if (!rows.length) return 0;
  // For "รายปีเฉลี่ย" preview — sum / unique-age count
  const byAge = new Map<number, number>();
  for (const r of rows) byAge.set(r.age, (byAge.get(r.age) ?? 0) + r.amount);
  if (byAge.size === 0) return 0;
  const total = [...byAge.values()].reduce((s, v) => s + v, 0);
  return total / byAge.size;
}

const INFLATION_HINTS: { label: string; rate: number }[] = [
  { label: "0%", rate: 0 },
  { label: "2%", rate: 0.02 },
  { label: "3%", rate: 0.03 },
  { label: "4%", rate: 0.04 },
  { label: "5%", rate: 0.05 },
  { label: "7%", rate: 0.07 },
];

// ---------------------------------------------------------------------------
// Component types
// ---------------------------------------------------------------------------

type AnyItem = SpecialExpenseItem | SavingFundItem | CashflowItem;

interface BaseProps {
  direction: "income" | "expense";
  ctx: CashflowContext;
  onRemove?: () => void;
  /** hide trash icon if you don't want remove */
  canRemove?: boolean;
}

interface InlineProps extends BaseProps {
  mode: "inline";
  item: AnyItem;
  /** partial updates applied to the item */
  onUpdateName?: (name: string) => void;
  onUpdateAmount: (amount: number) => void;
  onUpdateInflation: (rate: number) => void;
  onUpdateKind: (kind: CashflowKind) => void;
  onUpdateOccurAge?: (age: number | undefined) => void;
  onUpdateStartAge?: (age: number | undefined) => void;
  onUpdateEndAge?: (age: number | undefined) => void;
}

interface LinkedProps extends BaseProps {
  mode: "calc-link";
  item: AnyItem;
  /** live contribution from registry (null = no data yet) */
  contribution: CashflowContribution | null;
  /** link to source editor */
  editHref: string;
  editLabel?: string;
}

interface SubCalcProps extends BaseProps {
  mode: "sub-calc";
  item: AnyItem;
  /** aggregate contribution from sub-calc items */
  contribution: CashflowContribution | null;
  /** link to sub-calc page */
  subCalcHref: string;
  subCalcLabel?: string;
}

export type CashflowItemCardProps = InlineProps | LinkedProps | SubCalcProps;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CashflowItemCard(props: CashflowItemCardProps) {
  const { direction, ctx } = props;
  const isIncome = direction === "income";

  // Color scheme — emerald for income, pink for expense
  const accent = isIncome
    ? {
        border: "border-emerald-200",
        bg: "bg-emerald-50/40",
        chip: "text-emerald-600",
        strong: "text-emerald-700",
        button: "bg-emerald-500 hover:bg-emerald-600",
        ring: "focus:ring-emerald-400",
      }
    : {
        border: "border-pink-200",
        bg: "bg-pink-50/30",
        chip: "text-pink-600",
        strong: "text-pink-700",
        button: "bg-pink-500 hover:bg-pink-600",
        ring: "focus:ring-pink-400",
      };

  return (
    <div
      className={`rounded-xl border ${accent.border} ${accent.bg} p-3 space-y-2`}
    >
      {props.mode === "inline" && <InlineCard {...props} accent={accent} />}
      {props.mode === "calc-link" && <LinkedCard {...props} accent={accent} />}
      {props.mode === "sub-calc" && <SubCalcCard {...props} accent={accent} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type AccentTheme = {
  border: string;
  bg: string;
  chip: string;
  strong: string;
  button: string;
  ring: string;
};

function Header({
  name,
  onUpdateName,
  onRemove,
  canRemove,
}: {
  name: string;
  onUpdateName?: (name: string) => void;
  onRemove?: () => void;
  canRemove?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {onUpdateName ? (
        <input
          type="text"
          value={name}
          onChange={(e) => onUpdateName(e.target.value)}
          className="flex-1 text-xs font-medium bg-transparent outline-none truncate"
        />
      ) : (
        <div className="flex-1 text-xs font-medium truncate">{name}</div>
      )}
      {canRemove && onRemove && (
        <button
          onClick={onRemove}
          className="text-gray-300 hover:text-red-500 transition"
          aria-label="ลบรายการ"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function PreviewBox({
  occurLabel,
  occurValue,
  npvLabel,
  npvValue,
  accent,
}: {
  occurLabel: string;
  occurValue: string;
  npvLabel: string;
  npvValue: string;
  accent: AccentTheme;
}) {
  return (
    <div className="border-t border-gray-200 pt-2 space-y-1 text-[10px]">
      <div className="flex justify-between">
        <span className="text-gray-500">🕐 {occurLabel}</span>
        <span className="font-semibold text-gray-700">{occurValue}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">💼 {npvLabel}</span>
        <span className={`font-bold ${accent.strong}`}>{npvValue}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InlineCard — editable full form
// ---------------------------------------------------------------------------

function InlineCard({
  item,
  ctx,
  accent,
  onUpdateName,
  onUpdateAmount,
  onUpdateInflation,
  onUpdateKind,
  onUpdateOccurAge,
  onUpdateStartAge,
  onUpdateEndAge,
  onRemove,
  canRemove,
}: InlineProps & { accent: AccentTheme }) {
  // Derive normalized props to render
  const amount = readAmount(item);
  const inflation =
    item.inflationRate ??
    ctx.generalInflation;
  const kind = readKind(item);
  const occurAge = item.occurAge ?? ctx.retireAge;
  const startAge = item.startAge ?? ctx.retireAge;
  const endAge =
    item.endAge ?? ctx.lifeExpectancy + (ctx.extraYearsBeyondLife ?? 5);

  const rows = expandToYearly(item as AnyItem, ctx);
  const npv = npvAtRetire(rows, ctx.postRetireReturn, ctx.retireAge);
  const occurPreview =
    kind === "lump"
      ? rows[0]?.amount ?? amount
      : averageAnnual(rows);

  return (
    <>
      <Header
        name={item.name}
        onUpdateName={onUpdateName}
        onRemove={onRemove}
        canRemove={canRemove}
      />

      {/* Kind toggle */}
      <div className="flex gap-2">
        <KindChip
          active={kind === "lump"}
          onClick={() => onUpdateKind("lump")}
          accent={accent}
        >
          ก้อนเดียว
        </KindChip>
        <KindChip
          active={kind === "recurring"}
          onClick={() => onUpdateKind("recurring")}
          accent={accent}
        >
          ต่อเนื่องทุกปี
        </KindChip>
      </div>

      {/* Amount */}
      <AmountInput
        amount={amount}
        kind={kind}
        onChange={onUpdateAmount}
        accent={accent}
      />

      {/* Age inputs */}
      {kind === "lump" && onUpdateOccurAge && (
        <div className="flex items-center gap-2 text-[11px] text-gray-600">
          <span>ตอนอายุ</span>
          <AgeInput
            value={occurAge}
            onChange={(v) => onUpdateOccurAge(v)}
            accent={accent}
          />
          <span className="text-gray-400">ปี</span>
        </div>
      )}
      {kind === "recurring" && onUpdateStartAge && onUpdateEndAge && (
        <div className="flex items-center gap-2 text-[11px] text-gray-600 flex-wrap">
          <span>อายุ</span>
          <AgeInput
            value={startAge}
            onChange={(v) => onUpdateStartAge(v)}
            accent={accent}
          />
          <span>ถึง</span>
          <AgeInput
            value={endAge}
            onChange={(v) => onUpdateEndAge(v)}
            accent={accent}
          />
          <span className="text-gray-400">ปี</span>
        </div>
      )}

      {/* Inflation — typeable input + quick-pick chips */}
      <InflationInput
        inflation={inflation}
        onChange={onUpdateInflation}
        accent={accent}
      />

      {/* Preview */}
      {amount > 0 && (
        <PreviewBox
          occurLabel={kind === "lump" ? "ณ วันใช้จริง" : "รายปีเฉลี่ย"}
          occurValue={`฿${fmtM(occurPreview)}`}
          npvLabel="มูลค่า ณ วันเกษียณ (NPV)"
          npvValue={`฿${fmtM(npv)}`}
          accent={accent}
        />
      )}
    </>
  );
}

function KindChip({
  active,
  onClick,
  accent,
  children,
}: {
  active: boolean;
  onClick: () => void;
  accent: AccentTheme;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-1 rounded-lg text-[11px] font-bold transition ${
        active
          ? `${accent.button} text-white`
          : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function AgeInput({
  value,
  onChange,
  accent,
}: {
  value: number;
  onChange: (v: number | undefined) => void;
  accent: AccentTheme;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange(undefined);
        const n = Number(raw);
        onChange(Number.isFinite(n) ? n : undefined);
      }}
      className={`w-14 text-xs font-semibold bg-white rounded-md px-2 py-1 outline-none focus:ring-2 ${accent.ring} transition text-right`}
    />
  );
}

// ---------------------------------------------------------------------------
// AmountInput — typeable numeric input with locale formatting on blur
// Uses local draft state so typing is not disrupted by toLocaleString commas.
// ---------------------------------------------------------------------------
function AmountInput({
  amount,
  kind,
  onChange,
  accent,
}: {
  amount: number;
  kind: CashflowKind;
  onChange: (n: number) => void;
  accent: AccentTheme;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display =
    draft !== null
      ? draft
      : amount === 0
        ? ""
        : amount.toLocaleString("th-TH");

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="decimal"
        value={display}
        placeholder="0"
        onFocus={() => setDraft(amount === 0 ? "" : String(amount))}
        onChange={(e) => {
          const cleaned = cleanNumericInput(e.target.value);
          setDraft(cleaned);
          onChange(parseNum(cleaned));
        }}
        onBlur={() => setDraft(null)}
        className={`flex-1 text-sm font-semibold bg-white rounded-lg px-3 py-1.5 outline-none focus:ring-2 ${accent.ring} transition text-right`}
      />
      <span className="text-[10px] text-gray-400 whitespace-nowrap">
        {kind === "lump" ? "บาท (วันนี้)" : "บาท/ปี (วันนี้)"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InflationInput — typeable % input + quick-pick chips
// Store keeps rate as decimal (0.03), UI shows percent (3).
// ---------------------------------------------------------------------------
function InflationInput({
  inflation,
  onChange,
  accent,
}: {
  inflation: number;
  onChange: (rate: number) => void;
  accent: AccentTheme;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const percentValue = inflation * 100;
  const display =
    draft !== null
      ? draft
      : Number.isFinite(percentValue)
        ? // Trim trailing zeros but keep decimals if any (e.g. 3 not 3.00; 3.5 not 3.50)
          String(Math.round(percentValue * 1000) / 1000)
        : "";

  const commitPercent = (str: string) => {
    const pct = parseNum(str);
    onChange(pct / 100);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-gray-400">เงินเฟ้อ:</span>
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          value={display}
          placeholder="0"
          onFocus={() =>
            setDraft(
              Number.isFinite(percentValue)
                ? String(Math.round(percentValue * 1000) / 1000)
                : "",
            )
          }
          onChange={(e) => {
            const cleaned = cleanNumericInput(e.target.value);
            setDraft(cleaned);
            commitPercent(cleaned);
          }}
          onBlur={() => setDraft(null)}
          className={`w-14 text-xs font-semibold bg-white rounded-md px-2 py-1 outline-none focus:ring-2 ${accent.ring} transition text-right`}
        />
        <span className="text-[10px] text-gray-500">%</span>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {INFLATION_HINTS.map((h) => (
          <button
            key={h.rate}
            type="button"
            onClick={() => onChange(h.rate)}
            className={`px-2 py-0.5 rounded-full text-[10px] transition ${
              Math.abs(inflation - h.rate) < 0.0001
                ? `${accent.button} text-white font-bold`
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {h.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LinkedCard — read-only, live from registry
// ---------------------------------------------------------------------------

function LinkedCard({
  item,
  contribution,
  editHref,
  editLabel,
  accent,
}: LinkedProps & { accent: AccentTheme }) {
  const rows = contribution?.yearlyStream ?? [];
  const npv = contribution?.npvAtRetire ?? 0;
  const avg = averageAnnual(rows);
  const hasData = rows.length > 0 && npv !== 0;

  const summary = buildLinkedSummary(contribution, item);

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1 min-w-0">
          <div className="text-xs font-medium truncate">{item.name}</div>
          <span className="text-[9px] text-gray-400 shrink-0">🔗</span>
        </div>
        <Link
          href={editHref}
          className={`text-[10px] ${accent.chip} font-bold hover:underline flex items-center gap-0.5 shrink-0`}
        >
          {editLabel ?? "แก้ไข"} <ExternalLink size={10} />
        </Link>
      </div>

      <div className="text-[11px] text-gray-600 leading-relaxed">
        {hasData ? (
          summary
        ) : (
          <span className="text-gray-400">
            ยังไม่มีข้อมูล — กด &ldquo;แก้ไข&rdquo; เพื่อไปคำนวณ
          </span>
        )}
      </div>

      {hasData && (
        <PreviewBox
          occurLabel="รายปีเฉลี่ย"
          occurValue={`฿${fmtM(avg)}`}
          npvLabel="มูลค่า ณ วันเกษียณ (NPV)"
          npvValue={`฿${fmtM(npv)}`}
          accent={accent}
        />
      )}
    </>
  );
}

function buildLinkedSummary(
  contribution: CashflowContribution | null,
  item: AnyItem,
): string {
  if (!contribution) return "";
  const rows = contribution.yearlyStream;
  const meta = contribution.meta ?? {};
  if (rows.length === 0) return "";

  // Lump (single row)
  if (rows.length === 1) {
    return `เงินก้อน ฿${fmtM(rows[0].amount)} · ตอนอายุ ${rows[0].age}`;
  }

  const first = rows[0].age;
  const last = rows[rows.length - 1].age;
  // Try to read monthly hint
  const monthly = (meta as { monthlyPension?: number }).monthlyPension;
  if (monthly && monthly > 0) {
    return `${fmt(monthly)} บาท/เดือน · ต่อเนื่อง ${first}-${last} ปี`;
  }
  const avg = averageAnnual(rows);
  void item;
  return `${fmtM(avg)} บาท/ปี · ต่อเนื่อง ${first}-${last} ปี`;
}

// ---------------------------------------------------------------------------
// SubCalcCard — aggregate preview + button to sub-calc
// ---------------------------------------------------------------------------

function SubCalcCard({
  item,
  contribution,
  subCalcHref,
  subCalcLabel,
  accent,
}: SubCalcProps & { accent: AccentTheme }) {
  const rows = contribution?.yearlyStream ?? [];
  const npv = contribution?.npvAtRetire ?? 0;
  const avg = averageAnnual(rows);
  const hasData = rows.length > 0 && npv !== 0;

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-xs font-medium truncate">{item.name}</div>
      </div>

      <Link
        href={subCalcHref}
        className={`flex items-center justify-between ${accent.button} text-white rounded-lg px-3 py-2 text-[11px] font-bold hover:opacity-90 transition`}
      >
        <span className="flex items-center gap-1">
          <Settings2 size={12} /> {subCalcLabel ?? "คำนวณรายละเอียด"}
        </span>
        <ChevronRight size={14} />
      </Link>

      {hasData ? (
        <PreviewBox
          occurLabel="รายปีเฉลี่ย"
          occurValue={`฿${fmtM(avg)}`}
          npvLabel="มูลค่า ณ วันเกษียณ (NPV)"
          npvValue={`฿${fmtM(npv)}`}
          accent={accent}
        />
      ) : (
        <div className="text-[10px] text-gray-400">ยังไม่มีรายการ</div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

function readAmount(item: AnyItem): number {
  // For SavingFundItem: prefer new `amount` over legacy `value`
  if ("source" in item) {
    return item.amount ?? item.value ?? 0;
  }
  return item.amount ?? 0;
}

function readKind(item: AnyItem): CashflowKind {
  // SpecialExpenseItem has kind: "annual"|"lump"; map annual → recurring
  const k = item.kind;
  if (k === "annual") return "recurring";
  if (k === "lump") return "lump";
  if (k === "recurring") return "recurring";
  // Default: expense items lump; income varies
  return "lump";
}
