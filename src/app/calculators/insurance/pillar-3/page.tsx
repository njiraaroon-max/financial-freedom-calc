"use client";

import { useMemo } from "react";
import { Home, Car, ShieldAlert, AlertTriangle, CheckCircle2, Package } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import MoneyInput from "@/components/MoneyInput";
import { useInsuranceStore, VehicleInsuranceType } from "@/store/insurance-store";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}

// ─── Vehicle insurance types ─────────────────────────────────────────────────
const VEHICLE_TYPES: { value: VehicleInsuranceType; label: string; desc: string; color: string }[] = [
  { value: "class1", label: "ชั้น 1", desc: "คุ้มครองทุกกรณี + ตัวรถ", color: "text-emerald-700" },
  { value: "class2plus", label: "ชั้น 2+", desc: "ชนกับยานพาหนะ + ไฟไหม้ + ถูกโจรกรรม", color: "text-blue-700" },
  { value: "class3plus", label: "ชั้น 3+", desc: "ชนกับยานพาหนะเท่านั้น", color: "text-amber-700" },
  { value: "class3", label: "ชั้น 3", desc: "พ.ร.บ. + บุคคลภายนอก", color: "text-gray-700" },
  { value: "none", label: "ไม่มี", desc: "มีแค่ พ.ร.บ.", color: "text-red-700" },
];

// ─── Home types ──────────────────────────────────────────────────────────────
const HOME_TYPES = [
  { value: "house" as const, label: "บ้านเดี่ยว", icon: "🏠" },
  { value: "townhouse" as const, label: "ทาวน์เฮ้าส์", icon: "🏘️" },
  { value: "condo" as const, label: "คอนโด", icon: "🏢" },
];

// ─── Input Components ────────────────────────────────────────────────────────
function MoneyField({ label, value, onChange, hint, suffix = "บาท" }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; suffix?: string;
}) {
  return (
    <div>
      <label className="text-[13px] text-gray-500 font-semibold block mb-1">{label}</label>
      <MoneyInput
        value={value}
        onChange={onChange}
        unit={suffix}
        className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 border border-gray-200 text-right font-bold"
        ringClass="focus:ring-amber-400"
      />
      {hint && <div className="text-[11px] text-gray-400 mt-0.5 pl-1">{hint}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — Pillar 3: Property & Liability
// ═══════════════════════════════════════════════════════════════════════════════
export default function Pillar3Page() {
  const store = useInsuranceStore();
  const p3 = store.riskManagement.pillar3;
  const update = store.updatePillar3;

  // Property policies from store
  const propPolicies = store.policies.filter((p) => p.policyType === "property");

  // ─── Gap Analysis ─────────────────────────────────────────────────────
  const analysis = useMemo(() => {
    // Home gap
    const homeGap = p3.hasHome ? Math.max(p3.homeReplacementCost - p3.homeInsuredAmount, 0) : 0;
    const homePct = p3.hasHome && p3.homeReplacementCost > 0
      ? Math.min((p3.homeInsuredAmount / p3.homeReplacementCost) * 100, 100) : 0;

    // Vehicle gap
    const vehicleGap = p3.hasVehicle ? Math.max(p3.vehicleValue - p3.vehicleInsuredAmount, 0) : 0;
    const vehiclePct = p3.hasVehicle && p3.vehicleValue > 0
      ? Math.min((p3.vehicleInsuredAmount / p3.vehicleValue) * 100, 100) : 0;

    // Third-party liability gap
    const liabilityGap = Math.max(p3.desiredThirdPartyLimit - p3.thirdPartyLimit, 0);
    const liabilityPct = p3.desiredThirdPartyLimit > 0
      ? Math.min((p3.thirdPartyLimit / p3.desiredThirdPartyLimit) * 100, 100) : 0;

    // Other assets gap
    const otherGap = p3.otherAssetValue > 0 ? Math.max(p3.otherAssetValue - p3.otherAssetInsured, 0) : 0;
    const otherPct = p3.otherAssetValue > 0
      ? Math.min((p3.otherAssetInsured / p3.otherAssetValue) * 100, 100) : 0;

    const items = [
      ...(p3.hasHome ? [{ label: "บ้าน/ที่อยู่อาศัย", need: p3.homeReplacementCost, have: p3.homeInsuredAmount, gap: homeGap, pct: homePct }] : []),
      ...(p3.hasVehicle ? [{ label: "ยานพาหนะ", need: p3.vehicleValue, have: p3.vehicleInsuredAmount, gap: vehicleGap, pct: vehiclePct }] : []),
      { label: "ความรับผิดต่อบุคคลภายนอก", need: p3.desiredThirdPartyLimit, have: p3.thirdPartyLimit, gap: liabilityGap, pct: liabilityPct },
      ...(p3.otherAssetValue > 0 ? [{ label: "ทรัพย์สินอื่นๆ", need: p3.otherAssetValue, have: p3.otherAssetInsured, gap: otherGap, pct: otherPct }] : []),
    ];

    const totalNeed = items.reduce((s, i) => s + i.need, 0);
    const totalHave = items.reduce((s, i) => s + i.have, 0);
    const totalGap = items.reduce((s, i) => s + i.gap, 0);
    const adequateCount = items.filter((i) => i.gap <= 0).length;

    return { items, totalNeed, totalHave, totalGap, adequateCount, homeGap, vehicleGap, liabilityGap };
  }, [p3]);

  const handleSave = () => {
    store.markPillarCompleted("pillar3");
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="ทรัพย์สิน & ความรับผิด"
        subtitle="Pillar 3 — Property & Liability"
        characterImg="/circle-icons/risk-management.png"
        backHref="/calculators/insurance"
      />

      <div className="px-2 md:px-4 pt-3 pb-8 space-y-3">
        {/* Intro Card */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 text-white mx-1">
          <div className="flex items-center gap-2 mb-2">
            <Home size={20} />
            <span className="text-sm font-bold">บ้าน รถ ทรัพย์สิน...คุ้มครองเพียงพอไหม?</span>
          </div>
          <p className="text-[13px] opacity-80 leading-relaxed">
            ประเมินความคุ้มครองทรัพย์สินและความรับผิดต่อบุคคลภายนอก
            เพื่อป้องกันความเสียหายที่อาจเกิดขึ้น
          </p>
        </div>

        {/* ─── SECTION 1: บ้าน/ที่อยู่อาศัย ──────────────────────────── */}
        <div className="glass rounded-2xl p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-[12px] font-bold flex items-center justify-center">1</span>
            <Home size={14} className="text-amber-600" />
            บ้าน / ที่อยู่อาศัย
          </h3>

          {/* Toggle has home */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={p3.hasHome}
              onChange={(e) => update({ hasHome: e.target.checked })}
              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
            <span className="text-xs text-gray-700 font-medium">มีบ้าน/ที่อยู่อาศัยเป็นของตัวเอง</span>
          </label>

          {p3.hasHome && (
            <>
              {/* Home type */}
              <div>
                <label className="text-[13px] text-gray-500 font-semibold block mb-2">ประเภทที่อยู่อาศัย</label>
                <div className="flex gap-2">
                  {HOME_TYPES.map((ht) => (
                    <button key={ht.value}
                      onClick={() => update({ homeType: ht.value })}
                      className={`flex-1 text-xs py-2.5 rounded-xl border transition-all text-center ${
                        p3.homeType === ht.value
                          ? "border-amber-400 bg-amber-50 text-amber-700 font-bold"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}>
                      <div className="text-lg mb-0.5">{ht.icon}</div>
                      {ht.label}
                    </button>
                  ))}
                </div>
              </div>

              <MoneyField
                label="ต้นทุนสร้างใหม่ (ไม่รวมที่ดิน)"
                value={p3.homeReplacementCost}
                onChange={(v) => update({ homeReplacementCost: v })}
                hint="Replacement Cost = ค่าสร้างใหม่ทั้งหมด ณ ปัจจุบัน"
              />

              <MoneyField
                label="ทุนประกันอัคคีภัยปัจจุบัน"
                value={p3.homeInsuredAmount}
                onChange={(v) => update({ homeInsuredAmount: v })}
              />

              {/* Coverage options */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={p3.homeFireInsured}
                    onChange={(e) => update({ homeFireInsured: e.target.checked })}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                  <span className="text-xs text-gray-700">มีประกันอัคคีภัย (Fire Insurance)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={p3.homeFloodInsured}
                    onChange={(e) => update({ homeFloodInsured: e.target.checked })}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                  <span className="text-xs text-gray-700">มีประกันน้ำท่วม (Flood Insurance)</span>
                </label>
              </div>

              {/* Home gap visual */}
              {p3.homeReplacementCost > 0 && (
                <div className={`rounded-xl p-3 ${p3.homeInsuredAmount >= p3.homeReplacementCost ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-gray-700">Gap บ้าน</span>
                    <span className={`font-bold ${analysis.homeGap <= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {analysis.homeGap <= 0 ? "✓ เพียงพอ" : `-${fmt(analysis.homeGap)} บาท`}
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${analysis.homeGap <= 0 ? "bg-emerald-400" : "bg-red-400"}`}
                      style={{ width: `${Math.min((p3.homeInsuredAmount / p3.homeReplacementCost) * 100, 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                    <span>ทุนประกัน {fmt(p3.homeInsuredAmount)}</span>
                    <span>ต้นทุนสร้างใหม่ {fmt(p3.homeReplacementCost)}</span>
                  </div>
                </div>
              )}

              {/* CFP tip for home */}
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <div className="text-[11px] text-amber-700 leading-relaxed">
                  <strong>หลักการ:</strong> ทุนประกันอัคคีภัยควร = <strong>Replacement Cost</strong> (ต้นทุนสร้างใหม่) ไม่ใช่ราคาซื้อขาย
                  เพราะไม่รวมมูลค่าที่ดินซึ่งไม่เสียหายจากไฟ
                </div>
              </div>
            </>
          )}
        </div>

        {/* ─── SECTION 2: ยานพาหนะ ──────────────────────────────────── */}
        <div className="glass rounded-2xl p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-[12px] font-bold flex items-center justify-center">2</span>
            <Car size={14} className="text-amber-600" />
            ยานพาหนะ
          </h3>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={p3.hasVehicle}
              onChange={(e) => update({ hasVehicle: e.target.checked })}
              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
            <span className="text-xs text-gray-700 font-medium">มีรถยนต์/จักรยานยนต์</span>
          </label>

          {p3.hasVehicle && (
            <>
              <MoneyField
                label="มูลค่ารถปัจจุบัน (ราคาตลาด)"
                value={p3.vehicleValue}
                onChange={(v) => update({ vehicleValue: v })}
              />

              {/* Insurance type selector */}
              <div>
                <label className="text-[13px] text-gray-500 font-semibold block mb-2">ประเภทประกันรถยนต์</label>
                <div className="space-y-1.5">
                  {VEHICLE_TYPES.map((vt) => (
                    <button key={vt.value}
                      onClick={() => update({ vehicleInsuranceType: vt.value })}
                      className={`w-full text-left text-xs px-3 py-2.5 rounded-xl border transition-all ${
                        p3.vehicleInsuranceType === vt.value
                          ? "border-amber-400 bg-amber-50 font-bold"
                          : "border-gray-200 hover:border-gray-300"
                      }`}>
                      <div className="flex items-center justify-between">
                        <span className={p3.vehicleInsuranceType === vt.value ? vt.color : "text-gray-700"}>{vt.label}</span>
                        <span className="text-[11px] text-gray-400">{vt.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {p3.vehicleInsuranceType !== "none" && (
                <>
                  <MoneyField
                    label="ทุนประกันรถ (ซ่อม/เปลี่ยน)"
                    value={p3.vehicleInsuredAmount}
                    onChange={(v) => update({ vehicleInsuredAmount: v })}
                  />
                  <MoneyField
                    label="เบี้ยประกันรถ/ปี"
                    value={p3.vehiclePremium}
                    onChange={(v) => update({ vehiclePremium: v })}
                  />
                </>
              )}

              {/* Vehicle gap visual */}
              {p3.vehicleValue > 0 && p3.vehicleInsuranceType !== "none" && (
                <div className={`rounded-xl p-3 ${analysis.vehicleGap <= 0 ? "bg-emerald-50 border border-emerald-200" : "bg-orange-50 border border-orange-200"}`}>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-gray-700">Gap รถ</span>
                    <span className={`font-bold ${analysis.vehicleGap <= 0 ? "text-emerald-600" : "text-orange-600"}`}>
                      {analysis.vehicleGap <= 0 ? "✓ เพียงพอ" : `-${fmt(analysis.vehicleGap)} บาท`}
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${analysis.vehicleGap <= 0 ? "bg-emerald-400" : "bg-orange-400"}`}
                      style={{ width: `${Math.min((p3.vehicleInsuredAmount / p3.vehicleValue) * 100, 100)}%` }} />
                  </div>
                </div>
              )}

              {p3.vehicleInsuranceType === "none" && (
                <div className="bg-red-50 rounded-xl p-3 border border-red-200 text-[12px] text-red-700">
                  <strong>คำเตือน:</strong> ไม่มีประกันรถ (มีแค่ พ.ร.บ.) — หากเกิดอุบัติเหตุต้องรับผิดชอบค่าเสียหายเอง
                  ทั้งรถตัวเอง และบุคคลภายนอก
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── SECTION 3: ความรับผิดต่อบุคคลภายนอก ───────────────── */}
        <div className="glass rounded-2xl p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-[12px] font-bold flex items-center justify-center">3</span>
            <ShieldAlert size={14} className="text-amber-600" />
            ความรับผิดต่อบุคคลภายนอก (Liability)
          </h3>

          <MoneyField
            label="วงเงินคุ้มครองที่ต้องการ"
            value={p3.desiredThirdPartyLimit}
            onChange={(v) => update({ desiredThirdPartyLimit: v })}
            hint="แนะนำ 1-5 ล้านบาท (กรณีรถชนคน/ทรัพย์สินผู้อื่น)"
          />

          <MoneyField
            label="วงเงินคุ้มครองปัจจุบัน"
            value={p3.thirdPartyLimit}
            onChange={(v) => update({ thirdPartyLimit: v })}
            hint="จากประกันรถ + พ.ร.บ. + ประกันความรับผิดอื่น"
          />

          <div className="bg-orange-50 rounded-xl p-3 border border-orange-100 text-[12px] text-orange-700 leading-relaxed">
            <strong>ทำไมต้องสนใจ Liability?</strong>
            <p className="mt-1">หากรถชนคนเสียชีวิต ศาลอาจสั่งชดเชย 2-10 ล้านบาท
            วงเงินจาก พ.ร.บ. คุ้มครองแค่ 500,000 บาท — ส่วนที่เหลือต้องจ่ายเอง</p>
          </div>
        </div>

        {/* ─── SECTION 4: ทรัพย์สินอื่นๆ ────────────────────────────── */}
        <div className="glass rounded-2xl p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-[12px] font-bold flex items-center justify-center">4</span>
            <Package size={14} className="text-amber-600" />
            ทรัพย์สินอื่นๆ (Optional)
          </h3>

          <MoneyField
            label="มูลค่าทรัพย์สินอื่นๆ"
            value={p3.otherAssetValue}
            onChange={(v) => update({ otherAssetValue: v })}
            hint="เช่น เครื่องจักร, สต็อกสินค้า, อุปกรณ์มีค่า"
          />
          {p3.otherAssetValue > 0 && (
            <>
              <MoneyField
                label="ทุนประกันทรัพย์สินอื่นๆ"
                value={p3.otherAssetInsured}
                onChange={(v) => update({ otherAssetInsured: v })}
              />
              <div>
                <label className="text-[13px] text-gray-500 font-semibold block mb-1">รายละเอียด</label>
                <input type="text" value={p3.otherAssetDescription}
                  onChange={(e) => update({ otherAssetDescription: e.target.value })}
                  className="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-amber-400 border border-gray-200"
                  placeholder="อธิบายทรัพย์สิน..." />
              </div>
            </>
          )}
        </div>

        {/* ─── SECTION 5: Gap Analysis ────────────────────────────────── */}
        <div className="glass rounded-2xl p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-[12px] font-bold flex items-center justify-center">5</span>
            วิเคราะห์ช่องว่าง (Gap Analysis)
          </h3>

          {analysis.items.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">
              ยังไม่มีทรัพย์สินที่ต้องประเมิน
            </div>
          ) : (
            <>
              {/* Gap items */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="grid grid-cols-4 gap-1 px-3 py-2 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase">
                  <div>ทรัพย์สิน</div>
                  <div className="text-right">มูลค่า</div>
                  <div className="text-right">ทุนประกัน</div>
                  <div className="text-right">Gap</div>
                </div>
                {analysis.items.map((item) => {
                  const isOk = item.gap <= 0;
                  return (
                    <div key={item.label} className="grid grid-cols-4 gap-1 px-3 py-2.5 border-t border-gray-50 items-center">
                      <div className="text-[12px] text-gray-700 font-medium">{item.label}</div>
                      <div className="text-[12px] text-right font-bold text-gray-600">{fmtShort(item.need)}</div>
                      <div className="text-[12px] text-right font-bold text-amber-600">{fmtShort(item.have)}</div>
                      <div className={`text-[12px] text-right font-bold ${isOk ? "text-emerald-600" : "text-red-600"}`}>
                        {isOk ? "✓ OK" : `-${fmtShort(item.gap)}`}
                      </div>
                    </div>
                  );
                })}
                <div className={`px-3 py-3 border-t-2 ${analysis.totalGap <= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700">รวม Gap</span>
                    <span className={`text-xs font-bold ${analysis.totalGap <= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {analysis.totalGap <= 0 ? "✓ เพียงพอทั้งหมด" : `-${fmt(analysis.totalGap)} บาท`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Visual bars */}
              <div className="space-y-3">
                {analysis.items.map((item) => {
                  const isOk = item.gap <= 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-[12px] mb-1">
                        <span className="text-gray-600 font-medium">{item.label}</span>
                        <span className={`font-bold ${isOk ? "text-emerald-600" : "text-red-600"}`}>
                          {item.pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${isOk ? "bg-emerald-400" : item.pct > 50 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Overall result */}
              <div className={`rounded-xl p-4 text-center ${analysis.totalGap <= 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                {analysis.totalGap <= 0 ? (
                  <>
                    <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                    <div className="text-sm font-bold text-emerald-700">ทรัพย์สินมีประกันเพียงพอ!</div>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
                    <div className="text-sm font-bold text-red-700">ช่องว่างความคุ้มครองทรัพย์สิน</div>
                    <div className="text-2xl font-extrabold text-red-600 mt-1">{fmt(analysis.totalGap)} บาท</div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Property policies from store */}
          {propPolicies.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-3">
              <div className="text-xs font-bold text-amber-800 mb-2">กรมธรรม์ทรัพย์สิน (จาก Portfolio)</div>
              {propPolicies.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-[12px] py-1">
                  <span className="text-amber-700">{p.planName}</span>
                  <span className="font-bold text-amber-600">{fmt(p.sumInsured)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── CFP Tips ───────────────────────────────────────────────── */}
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 mx-1">
          <div className="text-[12px] font-bold text-amber-800 mb-1">💡 คำแนะนำจาก CFP</div>
          <div className="text-[12px] text-amber-700 leading-relaxed space-y-1">
            <p>• ประกันอัคคีภัยควรใช้ <strong>Replacement Cost</strong> ไม่ใช่ราคาซื้อขาย</p>
            <p>• คอนโดส่วนกลางมีประกันอาคาร — แต่ควรมี <strong>ประกันของใช้ภายในห้อง</strong> เพิ่ม</p>
            <p>• รถใหม่ 1-3 ปีแรก → ชั้น 1 / รถ 4+ ปี → พิจารณา ชั้น 2+ หรือ 3+</p>
            <p>• วงเงินบุคคลภายนอกแนะนำ <strong>ไม่ต่ำกว่า 1 ล้านบาท</strong></p>
            <p>• <strong>Under-insurance:</strong> หากทุนประกันต่ำกว่ามูลค่าจริง บริษัทจ่ายตามสัดส่วนเท่านั้น</p>
          </div>
        </div>

        {/* Save button */}
        <div className="mx-1">
          <button onClick={handleSave}
            className="w-full py-3 rounded-2xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 active:scale-[0.98] transition shadow-lg">
            บันทึกการประเมิน Pillar 3
          </button>
        </div>
      </div>
    </div>
  );
}
