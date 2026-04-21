"use client";

// ─── BundleColumn ──────────────────────────────────────────────────────────
// One configurable "shopping bundle" on the compare page.  Self-contained:
// owns its own main-product picker, rider toggles, sum-assured input, and
// birthDate field.  Emits a fully-resolved `BundleConfig` via `onChange`.
//
// Input controls kept deliberately minimal — this is a comparator, not the
// full purchase flow.  Anything more exotic (plan overrides, custom premium
// years) routes through /calculators/insurance/policies.

import { useEffect, useMemo } from "react";
import { X, Plus, Check, Download } from "lucide-react";
import { MAIN_PRESETS, RIDER_PRESETS } from "./presets";
import type { MainPreset, RiderPreset } from "./presets";
import ThaiDatePicker from "@/components/ThaiDatePicker";

// ─── Bundle config (exported — used by compare page + chart) ──────────────
export interface BundleConfig {
  label: string;           // "A" / "B" / "C"
  color: string;
  mainCode: string;        // Allianz product code
  sumAssured: number;      // baht
  riderIds: string[];      // RiderPreset.id values
  birthDate: string;       // YYYY-MM-DD
  policyStartDate: string; // YYYY-MM-DD
  /** When the selected main preset carries `variants` (e.g. SLA85 → A85/10,
   *  /15, /20, /25), this holds the chosen plan_code.  Absent means "use the
   *  preset's default planCode".  Ignored when the preset has no variants. */
  planVariant?: string;
}

// ─── Component props ──────────────────────────────────────────────────────
export interface BundleColumnProps {
  value: BundleConfig;
  onChange: (next: BundleConfig) => void;
  /** Derived from `allianzAge` in the parent — passed back so we can display it. */
  derivedAge: number | null;
  /** Parent-reported validation problems (e.g. "ทุนต่ำกว่าขั้นต่ำ 10M"). */
  errors?: string[];
  /** Per-year premium @ the derived age (for the "ค่าเบี้ยปีแรก" preview). */
  firstYearPremium?: number;
  /** When provided, renders an "Adopt" button that imports this bundle into
   *  the insurance store.  Parent owns the write — we just notify. */
  onAdopt?: () => void;
  /** Latch to show "✓ นำเข้าแล้ว" feedback for a few seconds after adopting. */
  adopted?: boolean;
}

const SA_PRESETS = [1_000_000, 3_000_000, 5_000_000, 10_000_000];

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

export default function BundleColumn({
  value,
  onChange,
  derivedAge,
  errors = [],
  firstYearPremium,
  onAdopt,
  adopted,
}: BundleColumnProps) {
  const main: MainPreset | undefined = useMemo(
    () => MAIN_PRESETS.find((p) => p.code === value.mainCode),
    [value.mainCode],
  );

  // When the main product switches to Wealth Legacy (10M floor), nudge SA up.
  useEffect(() => {
    if (value.mainCode === "MWLA9906" && value.sumAssured < 10_000_000) {
      onChange({ ...value, sumAssured: 10_000_000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.mainCode]);

  // Keep `planVariant` coherent with the current main preset:
  //   • no variants on preset  → drop any stale planVariant
  //   • has variants but current value doesn't match any → snap to default
  useEffect(() => {
    if (!main) return;
    if (!main.variants || main.variants.length === 0) {
      if (value.planVariant != null) {
        const { planVariant: _drop, ...rest } = value;
        void _drop;
        onChange({ ...rest });
      }
      return;
    }
    const matches = main.variants.some((v) => v.planCode === value.planVariant);
    if (!matches) {
      const fallback =
        main.variants.find((v) => v.planCode === main.planCode)?.planCode ??
        main.variants[0].planCode;
      onChange({ ...value, planVariant: fallback });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.mainCode]);

  const selectedRiders: RiderPreset[] = value.riderIds
    .map((id) => RIDER_PRESETS.find((r) => r.id === id))
    .filter((r): r is RiderPreset => r != null);

  const addRider = (id: string) => {
    if (value.riderIds.includes(id)) return;
    if (value.riderIds.length >= 3) return;
    onChange({ ...value, riderIds: [...value.riderIds, id] });
  };

  const removeRider = (id: string) => {
    onChange({ ...value, riderIds: value.riderIds.filter((r) => r !== id) });
  };

  const hasErrors = errors.length > 0;

  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-4 min-h-[520px]">
      {/* ─── Header ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
          style={{ background: value.color }}
        >
          {value.label}
        </div>
        <div className="text-sm font-bold text-gray-800">Bundle {value.label}</div>
        {firstYearPremium != null && firstYearPremium > 0 && (
          <div className="ml-auto text-right">
            <div className="text-[11px] text-gray-400">เบี้ยปีแรก</div>
            <div className="text-sm font-bold text-gray-800">
              {fmt(firstYearPremium)}
              <span className="text-[11px] font-normal text-gray-400 ml-1">บาท</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Main product picker ──────────────────────────────── */}
      <div>
        <div className="text-[11px] font-semibold text-gray-500 mb-1.5 tracking-wide">ประกันหลัก</div>
        <select
          className="w-full rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          value={value.mainCode}
          onChange={(e) => onChange({ ...value, mainCode: e.target.value })}
        >
          {(["life", "annuity", "savings"] as const).map((grp) => {
            const items = MAIN_PRESETS.filter((p) => (p.group ?? "life") === grp);
            if (items.length === 0) return null;
            const heading =
              grp === "life" ? "ประกันชีวิต" : grp === "annuity" ? "บำนาญ" : "ออมทรัพย์";
            return (
              <optgroup key={grp} label={heading}>
                {items.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {main?.sub && (
          <div className="text-[11px] text-gray-400 mt-1 leading-tight">{main.sub}</div>
        )}
        {/* Plan-variant pill picker — only rendered when the preset carries
         *  multiple plan variants (e.g. SLA85 → /10, /15, /20, /25). */}
        {main?.variants && main.variants.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {main.variants.map((v) => {
              const effective = value.planVariant ?? main.planCode;
              const active = effective === v.planCode;
              return (
                <button
                  key={v.planCode}
                  type="button"
                  onClick={() => onChange({ ...value, planVariant: v.planCode })}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                    active
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-bold"
                      : "border-gray-200 bg-white/60 text-gray-500 hover:bg-gray-50"
                  }`}
                  title={`จ่ายเบี้ย ${v.premiumYears} ปี${v.coverageEndAge ? ` / คุ้มครองถึง ${v.coverageEndAge}` : ""}`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Sum assured ──────────────────────────────────────── */}
      <div>
        <div className="text-[11px] font-semibold text-gray-500 mb-1.5 tracking-wide">ทุนประกัน (บาท)</div>
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          {SA_PRESETS.map((s) => {
            const active = value.sumAssured === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ ...value, sumAssured: s })}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                  active
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-bold"
                    : "border-gray-200 bg-white/60 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {s >= 1_000_000 ? `${s / 1_000_000}M` : `${s / 1000}K`}
              </button>
            );
          })}
        </div>
        <input
          type="number"
          className="w-full rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          value={value.sumAssured || ""}
          onChange={(e) => onChange({ ...value, sumAssured: Number(e.target.value) || 0 })}
          min={0}
          step={100000}
        />
      </div>

      {/* ─── Rider slots ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[11px] font-semibold text-gray-500 tracking-wide">สัญญาเพิ่มเติม</div>
          <div className="text-[11px] text-gray-400">{selectedRiders.length}/3</div>
        </div>
        <div className="flex flex-col gap-1.5">
          {selectedRiders.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-xl bg-white/60 border border-gray-200 px-2.5 py-1.5"
            >
              <RiderKindPill kind={r.kind} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-gray-800 truncate">{r.label}</div>
                {r.sub && <div className="text-[11px] text-gray-400 truncate">{r.sub}</div>}
              </div>
              <button
                type="button"
                onClick={() => removeRider(r.id)}
                className="text-gray-400 hover:text-red-500 transition"
                aria-label="remove rider"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {selectedRiders.length < 3 && (
            <select
              className="w-full rounded-xl border border-dashed border-gray-300 bg-white/40 px-3 py-2 text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value=""
              onChange={(e) => {
                if (e.target.value) addRider(e.target.value);
              }}
            >
              <option value="">+ เพิ่มสัญญาเพิ่มเติม</option>
              {RIDER_PRESETS.filter((r) => !value.riderIds.includes(r.id)).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ─── Birth / policy start ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] font-semibold text-gray-500 mb-1.5 tracking-wide">วันเกิด</div>
          <ThaiDatePicker
            value={value.birthDate}
            onChange={(v) => onChange({ ...value, birthDate: v })}
          />
        </div>
        <div>
          <div className="text-[11px] font-semibold text-gray-500 mb-1.5 tracking-wide">วันเริ่มกรมธรรม์</div>
          <ThaiDatePicker
            value={value.policyStartDate}
            onChange={(v) => onChange({ ...value, policyStartDate: v })}
          />
        </div>
      </div>

      {/* ─── Derived age (Allianz rounding) ───────────────────── */}
      {derivedAge != null && (
        <div className="text-[12px] text-gray-500 -mt-1">
          อายุประกัน (Allianz &gt;6ด. → +1):{" "}
          <span className="font-bold text-gray-800">{derivedAge} ปี</span>
        </div>
      )}

      {/* ─── Errors ───────────────────────────────────────────── */}
      {hasErrors && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700 space-y-1">
          {errors.map((e, i) => (
            <div key={i}>• {e}</div>
          ))}
        </div>
      )}

      {/* ─── Adopt button ─────────────────────────────────────── */}
      {onAdopt && (
        <button
          type="button"
          onClick={onAdopt}
          disabled={hasErrors || !firstYearPremium}
          className={`mt-auto w-full rounded-xl px-3 py-2 text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 ${
            adopted
              ? "bg-emerald-500 text-white shadow-sm"
              : hasErrors || !firstYearPremium
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-sm"
          }`}
        >
          {adopted ? (
            <>
              <Check size={14} />
              นำเข้าแล้ว
            </>
          ) : (
            <>
              <Download size={14} />
              ใส่ Bundle นี้ลงกรมธรรม์
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────
function RiderKindPill({ kind }: { kind: RiderPreset["kind"] }) {
  const cfg: Record<RiderPreset["kind"], { bg: string; text: string; label: string }> = {
    IPD:    { bg: "bg-cyan-100",   text: "text-cyan-700",   label: "IPD"    },
    OPD:    { bg: "bg-sky-100",    text: "text-sky-700",    label: "OPD"    },
    HB:     { bg: "bg-emerald-100",text: "text-emerald-700",label: "HB"     },
    CI:     { bg: "bg-red-100",    text: "text-red-700",    label: "CI"     },
    DENTAL: { bg: "bg-amber-100",  text: "text-amber-700",  label: "ทันต."  },
  };
  const c = cfg[kind];
  // Mark Plus as referenced only for linting — keeps the icon import ergonomic
  // in case a future revision wants an "add" affordance inline.
  void Plus;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.bg} ${c.text} shrink-0`}>
      {c.label}
    </span>
  );
}
