"use client";

// ─── CompareWorkspace ──────────────────────────────────────────────────────
// The reusable body of the compare UI — applicant bar, 2-3 bundle columns,
// cost/benefits tab switcher, charts, tables.  Extracted out of the old
// /compare page so the same surface can be embedded on the policies page
// (tab = "เปรียบเทียบแผน") without duplicating logic.
//
// One prop controls the only behavioural difference between embed sites:
//   • urlSync = true  → /compare standalone; bundle state mirrors the URL so
//                       links can be shared & the "แชร์ลิงก์" button copies it
//   • urlSync = false → embedded on /policies; state is memory-only, the
//                       "แชร์ลิงก์" button is hidden (no URL to copy)

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Link2, Check, Wallet, Stethoscope, HeartPulse } from "lucide-react";
import BundleColumn, { type BundleConfig } from "./BundleColumn";
import CompareOverlayChart from "./CompareOverlayChart";
import CompareSummaryTable from "./CompareSummaryTable";
import BenefitCompareTable from "./BenefitCompareTable";
import CICompareTable from "./CICompareTable";
import { MAIN_PRESETS, RIDER_PRESETS, BUNDLE_COLORS, BUNDLE_LABELS, resolveMainPlan } from "./presets";
import { decodeCompareState, encodeCompareState } from "./urlState";
import { calculateCashflow } from "@/lib/allianz/cashflow";
import { allianzAge } from "@/lib/allianz/age";
import { detectRenewalShocks } from "@/lib/allianz/shocks";
import { buildPolicyFromQuote } from "@/lib/allianz/toPolicy";
import { useInsuranceStore } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import type { CalcInput, CalcRiderInput, Gender, OccClass } from "@/lib/allianz/types";

export interface CompareWorkspaceProps {
  /** Mirror bundle state to `window.location.search` and show the
   *  "แชร์ลิงก์" button.  Keep false when embedded inside another page
   *  that owns the URL (e.g. policies uses ?tab=compare for its own tabs). */
  urlSync?: boolean;
}

// ─── Defaults ─────────────────────────────────────────────────────────────
function makeDefaultBundle(index: number): BundleConfig {
  // Three sensible starter bundles so a first-time visitor immediately sees
  // differences between product shapes.
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  const birthDefault = new Date(today);
  birthDefault.setFullYear(birthDefault.getFullYear() - 35);
  const birthIso = birthDefault.toISOString().slice(0, 10);

  const defaults: Omit<BundleConfig, "label" | "color">[] = [
    { mainCode: "MWLA9906", sumAssured: 10_000_000, riderIds: ["ipd-ultra-bdms"], birthDate: birthIso, policyStartDate: iso },
    { mainCode: "MWLA9920", sumAssured: 3_000_000, riderIds: ["ipd-ultra-bdms", "ci-1m"], birthDate: birthIso, policyStartDate: iso },
    { mainCode: "T1010", sumAssured: 3_000_000, riderIds: ["ipd-beyond-bdms"], birthDate: birthIso, policyStartDate: iso },
  ];

  const d = defaults[Math.min(index, defaults.length - 1)];
  return {
    label: BUNDLE_LABELS[index] ?? "?",
    color: BUNDLE_COLORS[index] ?? "#555",
    ...d,
  };
}

// ─── Price one bundle → (cashflow, shocks, errors, derivedAge) ────────────
interface BundleEval {
  cashflow: ReturnType<typeof calculateCashflow>["cashflow"];
  summary: ReturnType<typeof calculateCashflow>["summary"];
  errors: string[];
  shocks: ReturnType<typeof detectRenewalShocks>;
  derivedAge: number | null;
  firstYearPremium: number;
}

function evaluateBundle(
  b: BundleConfig,
  gender: Gender,
  occClass: OccClass,
): BundleEval {
  let derivedAge: number | null = null;
  try {
    derivedAge = allianzAge(b.birthDate, b.policyStartDate);
  } catch {
    derivedAge = null;
  }

  if (derivedAge == null || b.sumAssured <= 0) {
    return {
      cashflow: [],
      summary: { totalPaid: 0, mainTotalPaid: 0, riderTotalPaid: 0, lastPremiumAge: derivedAge ?? 0 },
      errors:
        derivedAge == null
          ? ["วันเกิด/วันเริ่มกรมธรรม์ไม่ถูกต้อง"]
          : ["กรอกทุนประกัน"],
      shocks: [],
      derivedAge,
      firstYearPremium: 0,
    };
  }

  const riders: CalcRiderInput[] = b.riderIds
    .map((id) => RIDER_PRESETS.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => r != null)
    .map((r) => ({
      productCode: r.code,
      planCode: r.planCode,
      sumAssured: r.sumAssured,
      dailyBenefit: r.dailyBenefit,
    }));

  const preset = MAIN_PRESETS.find((p) => p.code === b.mainCode);
  const mainPlan = resolveMainPlan(preset, b.planVariant, derivedAge);
  const input: CalcInput = {
    birthDate: b.birthDate,
    policyStartDate: b.policyStartDate,
    retireAge: 98,
    gender,
    occupationClass: occClass,
    main: {
      productCode: b.mainCode,
      planCode: mainPlan.planCode,
      sumAssured: b.sumAssured,
      premiumYears: mainPlan.premiumYears,
    },
    riders,
  };

  const out = calculateCashflow(input);
  const shocks = detectRenewalShocks(out.cashflow);
  const firstYear = out.cashflow.find((y) => y.totalPremium > 0);

  return {
    cashflow: out.cashflow,
    summary: out.summary,
    errors: out.errors,
    shocks,
    derivedAge,
    firstYearPremium: firstYear?.totalPremium ?? 0,
  };
}

// ─── Component ────────────────────────────────────────────────────────────
export default function CompareWorkspace({ urlSync = false }: CompareWorkspaceProps) {
  const [bundles, setBundles] = useState<BundleConfig[]>([
    makeDefaultBundle(0),
    makeDefaultBundle(1),
    makeDefaultBundle(2),
  ]);
  // Gender defaults from profile; share-links can override via `?g=M|F`
  // (receiver may want to see "what if I were male/female" without changing
  // their own profile — `g` wins over profile when present).
  const profileGender = useProfileStore((s) => s.gender);
  const setProfileGender = useProfileStore((s) => s.updateProfile);
  const [genderOverride, setGenderOverride] = useState<Gender | null>(null);
  const gender: Gender = genderOverride ?? profileGender;
  const setGender = (g: Gender) => {
    // Clicking the pill writes through to the profile store when there's no
    // share-link override in effect; otherwise it adjusts the local override.
    if (genderOverride != null) setGenderOverride(g);
    else setProfileGender("gender", g);
  };
  const [occClass, setOccClass] = useState<OccClass>(1);
  const [adoptedIdx, setAdoptedIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"cost" | "benefits" | "ci">("cost");
  const hydrated = useRef(false);
  const addPolicy = useInsuranceStore((s) => s.addPolicy);
  const salary = useProfileStore((s) => s.salary);
  const annualIncome = salary * 12;

  // ─── URL hydration & mirroring (only when urlSync=true) ──────────────
  // We guard both the read and the write with `urlSync`.  When the workspace
  // is embedded inside another page, that page owns its own URL state (e.g.
  // ?tab=compare on policies) and shouldn't be stomped by bundle queries.
  useEffect(() => {
    if (!urlSync) return;
    if (hydrated.current) return;
    hydrated.current = true;
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (![...sp.keys()].length) return;
    const decoded = decodeCompareState(sp);
    if (decoded.bundles.length >= 2) setBundles(decoded.bundles);
    // Share-link gender is an override — keep profile untouched, let the
    // recipient tinker temporarily (different from their own stored profile).
    if (decoded.gender) setGenderOverride(decoded.gender);
    if (decoded.occClass) setOccClass(decoded.occClass);
  }, [urlSync]);

  useEffect(() => {
    if (!urlSync) return;
    if (!hydrated.current || typeof window === "undefined") return;
    const qs = encodeCompareState({ bundles, gender, occClass });
    const next = `${window.location.pathname}?${qs}`;
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", next);
    }
  }, [urlSync, bundles, gender, occClass]);

  const copyShareLink = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("คัดลอก URL นี้:", url);
    }
  };

  const evals = useMemo(
    () => bundles.map((b) => evaluateBundle(b, gender, occClass)),
    [bundles, gender, occClass],
  );

  const updateBundle = (idx: number, next: BundleConfig) => {
    setBundles((prev) => prev.map((b, i) => (i === idx ? next : b)));
  };

  const addBundle = () => {
    if (bundles.length >= 3) return;
    setBundles((prev) => [...prev, makeDefaultBundle(prev.length)]);
  };

  // ─── Adopt: push every product in a bundle into the insurance store ──
  const adoptBundle = (idx: number) => {
    const b = bundles[idx];
    const ev = evals[idx];
    if (!b || !ev || ev.errors.length > 0 || ev.derivedAge == null) return;
    const firstYear = ev.cashflow.find((y) => y.totalPremium > 0);
    if (!firstYear) return;

    const preset = MAIN_PRESETS.find((p) => p.code === b.mainCode);
    const mainPlan = resolveMainPlan(preset, b.planVariant, ev.derivedAge);

    const mainPayload = buildPolicyFromQuote({
      productCode: b.mainCode,
      planCode: mainPlan.planCode,
      premium: firstYear.mainPremium,
      sumInsured: b.sumAssured,
      premiumYears: mainPlan.premiumYears ?? 1,
      coverageEndAge: mainPlan.coverageEndAge,
      currentAge: ev.derivedAge,
    });
    if (mainPayload) addPolicy(mainPayload);

    for (const r of firstYear.ridersPremium) {
      if (r.premium <= 0) continue;
      const riderPreset = RIDER_PRESETS.find(
        (rp) => b.riderIds.includes(rp.id) && rp.code === r.code,
      );
      const riderPayload = buildPolicyFromQuote({
        productCode: r.code,
        planCode: riderPreset?.planCode,
        premium: r.premium,
        sumInsured: 0,
        premiumYears: 1,
        currentAge: ev.derivedAge,
        ...(riderPreset?.dailyBenefit ? { dailyBenefit: riderPreset.dailyBenefit } : {}),
        ...(riderPreset?.sumAssured && riderPreset.kind === "CI"
          ? { ciLumpSum: riderPreset.sumAssured }
          : {}),
      });
      if (riderPayload) addPolicy(riderPayload);
    }

    setAdoptedIdx(idx);
    setTimeout(() => setAdoptedIdx((cur) => (cur === idx ? null : cur)), 2500);
  };

  const removeBundle = (idx: number) => {
    if (bundles.length <= 2) return;
    setBundles((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.map((b, i) => ({
        ...b,
        label: BUNDLE_LABELS[i] ?? "?",
        color: BUNDLE_COLORS[i] ?? "#555",
      }));
    });
  };

  const overlayBundles = bundles.map((b, i) => ({
    label: b.label,
    color: b.color,
    cashflow: evals[i].cashflow,
    shocks: evals[i].shocks,
  }));

  const summaryBundles = bundles.map((b, i) => ({
    label: b.label,
    color: b.color,
    cashflow: evals[i].cashflow,
    shocks: evals[i].shocks,
    lifetimeTotal: evals[i].summary.totalPaid,
    sumAssured: b.sumAssured,
  }));

  const benefitBundles = bundles.map((b) => ({
    label: b.label,
    color: b.color,
    riderIds: b.riderIds,
  }));

  return (
    <div className="space-y-4">
      {/* ─── Shared applicant attributes ────────────────────── */}
      <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-gray-500 tracking-wide">เพศ</span>
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {(["M", "F"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`px-3 py-1 text-[13px] transition ${
                  gender === g
                    ? "bg-indigo-600 text-white font-bold"
                    : "bg-white/60 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {g === "M" ? "ชาย" : "หญิง"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-gray-500 tracking-wide">อาชีพ</span>
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {([1, 3, 4] as OccClass[]).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOccClass(o)}
                className={`px-3 py-1 text-[13px] transition ${
                  occClass === o
                    ? "bg-indigo-600 text-white font-bold"
                    : "bg-white/60 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {o === 1 ? "ระดับ 1-2" : o === 3 ? "ระดับ 3" : "ระดับ 4"}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {urlSync && (
            <button
              type="button"
              onClick={copyShareLink}
              className={`flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-xl border transition ${
                copied
                  ? "bg-emerald-500 text-white border-emerald-600"
                  : "bg-white/60 text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
              title="คัดลอกลิงก์เพื่อแชร์การเปรียบเทียบนี้"
            >
              {copied ? <Check size={14} /> : <Link2 size={14} />}
              {copied ? "คัดลอกแล้ว" : "แชร์ลิงก์"}
            </button>
          )}
          {bundles.length < 3 && (
            <button
              type="button"
              onClick={addBundle}
              className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
            >
              <Plus size={14} />
              เพิ่ม Bundle
            </button>
          )}
        </div>
      </div>

      {/* ─── Bundle columns ─────────────────────────────────── */}
      <div
        className={`grid gap-3 ${
          bundles.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
        } grid-cols-1`}
      >
        {bundles.map((b, i) => (
          <div key={i} className="relative">
            <BundleColumn
              value={b}
              onChange={(next) => updateBundle(i, next)}
              derivedAge={evals[i].derivedAge}
              errors={evals[i].errors}
              firstYearPremium={evals[i].firstYearPremium}
              onAdopt={() => adoptBundle(i)}
              adopted={adoptedIdx === i}
            />
            {bundles.length > 2 && (
              <button
                type="button"
                onClick={() => removeBundle(i)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                aria-label="remove bundle"
                title="ลบ bundle นี้"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ─── Tab switcher (cost vs benefits) ────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/40 border border-gray-200 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("cost")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition ${
            activeTab === "cost"
              ? "bg-indigo-600 text-white font-bold shadow-sm"
              : "text-gray-600 hover:bg-white/60"
          }`}
        >
          <Wallet size={14} />
          เบี้ย + Renewal Shocks
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("benefits")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition ${
            activeTab === "benefits"
              ? "bg-indigo-600 text-white font-bold shadow-sm"
              : "text-gray-600 hover:bg-white/60"
          }`}
        >
          <Stethoscope size={14} />
          ความคุ้มครอง (NHS 13)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ci")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition ${
            activeTab === "ci"
              ? "bg-indigo-600 text-white font-bold shadow-sm"
              : "text-gray-600 hover:bg-white/60"
          }`}
        >
          <HeartPulse size={14} />
          CI / มะเร็ง
        </button>
      </div>

      {/* ─── Active tab content ─────────────────────────────── */}
      {activeTab === "cost" && (
        <>
          <CompareOverlayChart bundles={overlayBundles} />
          <CompareSummaryTable bundles={summaryBundles} annualIncome={annualIncome} />
        </>
      )}
      {activeTab === "benefits" && <BenefitCompareTable bundles={benefitBundles} />}
      {activeTab === "ci" && <CICompareTable bundles={benefitBundles} />}

      {/* ─── Hint footer ────────────────────────────────────── */}
      <div className="text-[12px] text-gray-400 text-center py-2 leading-relaxed">
        อายุประกันคำนวณตามกฎ Allianz (เกิน 6 เดือนหลังวันเกิด → +1 ปี).
        เบี้ยประกันหลักผูกกับอายุ ณ วันเริ่มกรมธรรม์;
        เบี้ยสัญญาเพิ่มเติมขยับตามช่วงอายุในแต่ละปี.
      </div>
    </div>
  );
}
