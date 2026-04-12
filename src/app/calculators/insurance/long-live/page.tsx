"use client";

import { useState, useMemo } from "react";
import { Landmark, Link2, AlertTriangle, CheckCircle2, TrendingUp, Coins } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useInsuranceStore } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import { useVariableStore } from "@/store/variable-store";

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

// ─── Input Components ────────────────────────────────────────────────────────
function MoneyInput({ label, value, onChange, hint, suffix = "บาท" }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; suffix?: string;
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
        <input type="text" inputMode="numeric" value={display} onChange={handleChange}
          className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 border border-gray-200 text-right font-bold"
          placeholder="0" />
        <span className="text-xs text-gray-400 shrink-0 w-8">{suffix}</span>
      </div>
      {hint && <div className="text-[9px] text-gray-400 mt-0.5 pl-1">{hint}</div>}
    </div>
  );
}

function LinkToggle({ label, checked, onChange, linkedValue, linkedLabel }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; linkedValue?: number; linkedLabel?: string;
}) {
  return (
    <div className={`rounded-xl border p-3 transition-all ${checked ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-white"}`}>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
        <Link2 size={14} className={checked ? "text-indigo-500" : "text-gray-400"} />
        <span className="text-xs text-gray-700 font-medium">{label}</span>
      </label>
      {checked && linkedValue !== undefined && (
        <div className="mt-1.5 ml-7 text-[10px] text-indigo-600 font-bold">
          {linkedLabel}: {fmt(linkedValue)} บาท
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — Long Live Protection (Saving & Retirement & Annuity)
// ═══════════════════════════════════════════════════════════════════════════════
export default function LongLivePage() {
  const store = useInsuranceStore();
  const profile = useProfileStore();
  const variableStore = useVariableStore();

  const ll = store.riskManagement.longLiveProtection;
  const update = store.updateLongLiveProtection;

  const currentAge = profile.getAge?.() || 35;
  const retireAge = profile.retireAge || 60;
  const yearsToRetire = Math.max(retireAge - currentAge, 0);

  // ─── Saving & Pension policies from store ─────────────────────────────
  const savingPolicies = store.policies.filter((p) => ["endowment"].includes(p.policyType));
  const pensionPolicies = store.policies.filter((p) => p.policyType === "annuity");
  const totalSavingCashValue = savingPolicies.reduce((s, p) => s + p.cashValue, 0);
  const totalSavingSumInsured = savingPolicies.reduce((s, p) => s + p.sumInsured, 0);
  const totalPensionSumInsured = pensionPolicies.reduce((s, p) => s + p.sumInsured, 0);
  const totalSavingPremium = savingPolicies.reduce((s, p) => s + p.premium, 0);
  const totalPensionPremium = pensionPolicies.reduce((s, p) => s + p.premium, 0);

  // ─── Variable store data (from retirement module) ─────────────────────
  const retireFundNeeded = variableStore.getVariable("retire_fund_needed");
  const retireFundHave = variableStore.getVariable("retire_fund_at_retire");

  // ─── Gap Analysis ─────────────────────────────────────────────────────
  const analysis = useMemo(() => {
    const fundNeeded = ll.useRetirementGap && retireFundNeeded
      ? retireFundNeeded.value
      : ll.retirementFundNeeded;
    const fundHave = ll.useRetirementGap && retireFundHave
      ? retireFundHave.value
      : ll.retirementFundHave;

    // Add saving/pension policies to what we have
    const totalHave = fundHave + totalSavingCashValue + totalPensionSumInsured;
    const gap = fundNeeded - totalHave;
    const coveragePct = fundNeeded > 0 ? Math.min((totalHave / fundNeeded) * 100, 200) : 0;

    return { fundNeeded, fundHave, totalHave, gap, coveragePct };
  }, [ll, retireFundNeeded, retireFundHave, totalSavingCashValue, totalPensionSumInsured]);

  const handleSave = () => {
    store.markPillarCompleted("longLive");
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="Long Live Protection"
        subtitle="Pillar 4 — Saving & Retirement"
        characterImg="/circle-icons/risk-management.png"
        backHref="/calculators/insurance"
      />

      <div className="px-2 md:px-4 pt-3 pb-8 space-y-3">
        {/* Intro Card */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-4 text-white mx-1">
          <div className="flex items-center gap-2 mb-2">
            <Landmark size={20} />
            <span className="text-sm font-bold">เกษียณไปใครเลี้ยง? (Live too long)</span>
          </div>
          <p className="text-[11px] opacity-80 leading-relaxed">
            ประเมินความพร้อมทางการเงินหลังเกษียณ ผ่านประกันสะสมทรัพย์ ประกันบำนาญ
            และแผนเกษียณอายุ เพื่อให้มั่นใจว่าจะมีเงินพอใช้ตลอดชีวิต
          </p>
        </div>

        {/* ─── SECTION 1: กรมธรรม์สะสมทรัพย์ ──────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">1</span>
            <Coins size={14} className="text-indigo-600" />
            กรมธรรม์สะสมทรัพย์ & บำนาญ
          </h3>

          {/* Saving policies */}
          <div className="bg-indigo-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-800">ประกันสะสมทรัพย์ (Endowment)</span>
              <span className="text-xs font-bold text-indigo-600">{savingPolicies.length} เล่ม</span>
            </div>
            {savingPolicies.length > 0 ? (
              <>
                {savingPolicies.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[10px] py-1">
                    <span className="text-indigo-700">{p.planName} <span className="text-indigo-400">({p.company || "-"})</span></span>
                    <span className="font-bold text-indigo-600">{fmt(p.sumInsured)}</span>
                  </div>
                ))}
                <div className="border-t border-indigo-200 mt-2 pt-2 grid grid-cols-3 gap-2 text-[9px]">
                  <div className="text-center">
                    <div className="text-indigo-500">ทุนประกันรวม</div>
                    <div className="font-bold text-indigo-700">{fmtShort(totalSavingSumInsured)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-indigo-500">มูลค่าเวนคืน</div>
                    <div className="font-bold text-indigo-700">{fmtShort(totalSavingCashValue)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-indigo-500">เบี้ย/ปี</div>
                    <div className="font-bold text-indigo-700">{fmtShort(totalSavingPremium)}</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-[10px] text-indigo-400">ยังไม่มีกรมธรรม์สะสมทรัพย์</div>
            )}
          </div>

          {/* Pension/Annuity policies */}
          <div className="bg-purple-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-purple-800">ประกันบำนาญ (Annuity)</span>
              <span className="text-xs font-bold text-purple-600">{pensionPolicies.length} เล่ม</span>
            </div>
            {pensionPolicies.length > 0 ? (
              <>
                {pensionPolicies.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[10px] py-1">
                    <span className="text-purple-700">{p.planName} <span className="text-purple-400">({p.company || "-"})</span></span>
                    <span className="font-bold text-purple-600">{fmt(p.sumInsured)}</span>
                  </div>
                ))}
                <div className="border-t border-purple-200 mt-2 pt-2 grid grid-cols-2 gap-2 text-[9px]">
                  <div className="text-center">
                    <div className="text-purple-500">ทุนประกันรวม</div>
                    <div className="font-bold text-purple-700">{fmtShort(totalPensionSumInsured)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-purple-500">เบี้ย/ปี</div>
                    <div className="font-bold text-purple-700">{fmtShort(totalPensionPremium)}</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-[10px] text-purple-400">ยังไม่มีกรมธรรม์บำนาญ — เพิ่มได้ที่หน้าสรุปกรมธรรม์</div>
            )}
          </div>
        </div>

        {/* ─── SECTION 2: ทุนเกษียณ (Retirement Fund) ────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">2</span>
            <TrendingUp size={14} className="text-indigo-600" />
            ข้อมูลเกษียณ (Retirement Data)
          </h3>

          {/* Link from retirement module */}
          <LinkToggle
            label="ดึงข้อมูลจากแผนเกษียณ (Retirement Module)"
            checked={ll.useRetirementGap}
            onChange={(v) => update({ useRetirementGap: v })}
            linkedValue={retireFundNeeded?.value}
            linkedLabel="ทุนเกษียณที่ต้องมี"
          />

          {ll.useRetirementGap && retireFundNeeded && (
            <div className="bg-indigo-50 rounded-xl p-3 text-[10px] text-indigo-700">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-indigo-500">ทุนเกษียณที่ต้องมี</div>
                  <div className="font-bold text-lg text-indigo-700">{fmtShort(retireFundNeeded.value)}</div>
                </div>
                {retireFundHave && (
                  <div>
                    <div className="text-indigo-500">ที่คาดว่าจะมีตอนเกษียณ</div>
                    <div className="font-bold text-lg text-indigo-700">{fmtShort(retireFundHave.value)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!ll.useRetirementGap && (
            <div className="space-y-3">
              <MoneyInput
                label="ทุนเกษียณที่ต้องการ"
                value={ll.retirementFundNeeded}
                onChange={(v) => update({ retirementFundNeeded: v })}
                hint={`อีก ${yearsToRetire} ปีจะเกษียณ (อายุ ${retireAge})`}
              />
              <MoneyInput
                label="ทุนเกษียณที่มีแล้ว (ณ ปัจจุบัน)"
                value={ll.retirementFundHave}
                onChange={(v) => update({ retirementFundHave: v })}
                hint="เงินออม + กองทุน + สินทรัพย์ลงทุน"
              />
            </div>
          )}

          <MoneyInput
            label="เงินบำนาญที่ต้องการ/เดือน (หลังเกษียณ)"
            value={ll.desiredPensionMonthly}
            onChange={(v) => update({ desiredPensionMonthly: v })}
            hint="แนะนำ 50-70% ของรายได้ปัจจุบัน"
            suffix="บาท/เดือน"
          />

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <div className="text-[9px] text-gray-500">อายุปัจจุบัน</div>
              <div className="text-sm font-bold text-gray-800">{currentAge}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <div className="text-[9px] text-gray-500">เกษียณอายุ</div>
              <div className="text-sm font-bold text-gray-800">{retireAge}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <div className="text-[9px] text-gray-500">อีกกี่ปี</div>
              <div className="text-sm font-bold text-indigo-600">{yearsToRetire}</div>
            </div>
          </div>
        </div>

        {/* ─── SECTION 3: Gap Analysis ────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">3</span>
            วิเคราะห์ช่องว่าง (Retirement Gap Analysis)
          </h3>

          {analysis.fundNeeded > 0 ? (
            <>
              {/* Need vs Have */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-50">
                  <span className="text-xs text-gray-600">ทุนเกษียณที่ต้องการ</span>
                  <span className="text-xs font-bold text-red-600">{fmtShort(analysis.fundNeeded)}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-50">
                  <span className="text-xs text-gray-600">ทุนจากแผนเกษียณ</span>
                  <span className="text-xs font-bold text-gray-700">{fmtShort(analysis.fundHave)}</span>
                </div>
                {totalSavingCashValue > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50">
                    <span className="text-[10px] text-gray-500 pl-4">+ มูลค่าเวนคืนสะสมทรัพย์</span>
                    <span className="text-[10px] font-bold text-gray-600">{fmtShort(totalSavingCashValue)}</span>
                  </div>
                )}
                {totalPensionSumInsured > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50">
                    <span className="text-[10px] text-gray-500 pl-4">+ ทุนประกันบำนาญ</span>
                    <span className="text-[10px] font-bold text-gray-600">{fmtShort(totalPensionSumInsured)}</span>
                  </div>
                )}
                <div className={`flex items-center justify-between px-3 py-2.5 ${analysis.gap <= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                  <span className={`text-xs font-bold ${analysis.gap <= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {analysis.gap <= 0 ? "เหลือเกิน" : "Gap (ขาดอีก)"}
                  </span>
                  <span className={`text-sm font-extrabold ${analysis.gap <= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {fmt(Math.abs(analysis.gap))}
                  </span>
                </div>
              </div>

              {/* Visual bar */}
              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-gray-600">ความพร้อมเกษียณ</span>
                  <span className={`font-bold ${analysis.coveragePct >= 100 ? "text-emerald-600" : "text-red-600"}`}>
                    {analysis.coveragePct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      analysis.coveragePct >= 100 ? "bg-emerald-400" : analysis.coveragePct >= 50 ? "bg-amber-400" : "bg-red-400"
                    }`}
                    style={{ width: `${Math.min(analysis.coveragePct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Result */}
              <div className={`rounded-xl p-4 text-center ${analysis.gap <= 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                {analysis.gap <= 0 ? (
                  <>
                    <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                    <div className="text-sm font-bold text-emerald-700">ทุนเกษียณเพียงพอ!</div>
                    <div className="text-xs text-emerald-600 mt-1">มีทุนเกินกว่าที่ต้องการ {fmtShort(Math.abs(analysis.gap))} บาท</div>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
                    <div className="text-sm font-bold text-red-700">ทุนเกษียณยังไม่เพียงพอ</div>
                    <div className="text-2xl font-extrabold text-red-600 mt-1">{fmtShort(analysis.gap)} บาท</div>
                    <div className="text-[10px] text-red-500 mt-1">
                      ต้องออมเพิ่มเดือนละ ~{fmtShort(Math.round(analysis.gap / (yearsToRetire * 12)))} บาท
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-gray-400 text-xs">
              กรุณาระบุทุนเกษียณที่ต้องการ หรือ link จากแผนเกษียณ
            </div>
          )}
        </div>

        {/* ─── CFP Tips ───────────────────────────────────────────────── */}
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 mx-1">
          <div className="text-[10px] font-bold text-amber-800 mb-1">💡 คำแนะนำจาก CFP</div>
          <div className="text-[10px] text-amber-700 leading-relaxed space-y-1">
            <p>• <strong>ประกันบำนาญ</strong> ช่วยสร้างรายได้ประจำหลังเกษียณ ลดความเสี่ยง "Live Too Long"</p>
            <p>• แนะนำเงินบำนาญหลังเกษียณ = <strong>50-70%</strong> ของรายได้ก่อนเกษียณ</p>
            <p>• <strong>ประกันสะสมทรัพย์</strong> เหมาะสำหรับเป้าหมายระยะกลาง-ยาว + มีความคุ้มครองชีวิตด้วย</p>
            <p>• เบี้ยประกันบำนาญ ลดหย่อนภาษีได้สูงสุด <strong>200,000</strong> บาท (15% ของรายได้)</p>
            <p>• ควรเริ่มวางแผนเกษียณ <strong>ตั้งแต่เนิ่นๆ</strong> — ดอกเบี้ยทบต้นช่วยมหาศาล</p>
          </div>
        </div>

        {/* Save button */}
        <div className="mx-1">
          <button onClick={handleSave}
            className="w-full py-3 rounded-2xl bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600 active:scale-[0.98] transition shadow-lg">
            บันทึกการประเมิน Long Live Protection
          </button>
        </div>
      </div>
    </div>
  );
}
