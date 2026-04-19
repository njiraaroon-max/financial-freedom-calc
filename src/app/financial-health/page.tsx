"use client";

import { Droplets, Anchor, Umbrella, Sprout } from "lucide-react";
import { useVariableStore } from "@/store/variable-store";
import PageHeader from "@/components/PageHeader";
import GaugeChart, { higherIsBetterZones, lowerIsBetterZones, mapToGauge } from "@/components/GaugeChart";
import type { ReactElement } from "react";

function fmt(n: number): string {
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return n.toFixed(1) + "%";
}

// Dimension icon
function DimensionIcon({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 mb-2">
      <div className="w-10 h-10 bg-[#1e3a5f] rounded-full flex items-center justify-center">
        <Icon size={18} className="text-white" />
      </div>
      <span className="text-[13px] font-bold text-[#1e3a5f] text-center leading-tight">{label}</span>
    </div>
  );
}

interface GaugeRow {
  description: string;
  gauge: ReactElement;
}

export default function FinancialHealthPage() {
  const { variables } = useVariableStore();

  const v = (key: string) => variables[key]?.value || 0;
  const annualIncome = v("annual_income");
  const annualExpense = v("annual_expense");
  const monthlyEssentialExpense = v("monthly_essential_expense");
  const liquidAssets = v("liquid_assets");
  const shortTermLiabilities = v("short_term_liabilities");
  const totalLiabilities = v("total_liabilities");
  const annualDebtPayment = v("annual_debt_payment");
  const annualSavingInvestment = v("annual_saving_investment");
  const investmentAssets = v("investment_assets");
  const totalAssets = v("total_assets");
  const netWorth = v("net_worth");

  const hasCFData = annualIncome > 0;
  const hasBSData = totalAssets > 0 || totalLiabilities > 0;
  const hasData = hasCFData || hasBSData;

  // Summary data
  const summaryItems = [
    { label: "รายได้รวม", value: annualIncome, unit: "บาทต่อปี" },
    { label: "รายจ่ายรวม (จากงบกระแสเงินสด)", value: annualExpense, unit: "บาทต่อปี" },
    { label: "รายจ่ายจำเป็นต่อเดือน", value: monthlyEssentialExpense, unit: "บาทต่อเดือน" },
    { label: "มูลค่าของสินทรัพย์สภาพคล่อง", value: liquidAssets, unit: "บาท" },
    { label: "หนี้ระยะสั้นไม่เกิน 1 ปี", value: shortTermLiabilities, unit: "บาท" },
    { label: "หนี้สินรวม", value: totalLiabilities, unit: "บาท" },
    { label: "ค่างวดชำระทั้งหมด", value: annualDebtPayment, unit: "บาทต่อปี" },
    { label: "เงินออมหรือลงทุน (จากงบกระแสเงินสด)", value: annualSavingInvestment, unit: "บาทต่อปี" },
    { label: "สินทรัพย์เพื่อการลงทุน", value: investmentAssets, unit: "บาท" },
    { label: "สินทรัพย์รวม", value: totalAssets, unit: "บาท" },
    { label: "ความมั่งคั่งสุทธิ", value: netWorth, unit: "บาท" },
  ];

  // Calculate ratios
  const liquidityShortTerm = shortTermLiabilities > 0 ? liquidAssets / shortTermLiabilities : -1;
  const liquidityEmergency = monthlyEssentialExpense > 0 ? liquidAssets / monthlyEssentialExpense : 0;
  const debtToAsset = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
  const dsr = annualIncome > 0 ? (annualDebtPayment / annualIncome) * 100 : 0;
  const savingRatio = annualIncome > 0 ? (annualSavingInvestment / annualIncome) * 100 : 0;
  const investToNetWorth = netWorth > 0 ? (investmentAssets / netWorth) * 100 : 0;

  // Build gauge sections
  const dimensions: {
    icon: React.ElementType;
    label: string;
    rows: GaugeRow[];
  }[] = [
    {
      icon: Droplets,
      label: "สภาพคล่อง",
      rows: [
        {
          description: "เพียงพอชำระหนี้สินระยะสั้น",
          gauge: (
            <GaugeChart
              value={liquidityShortTerm === -1 ? 95 : mapToGauge(liquidityShortTerm, 0, 3)}
              displayValue={liquidityShortTerm === -1 ? "ไม่มีหนี้ระยะสั้น" : `${liquidityShortTerm.toFixed(2)} เท่า`}
              benchmarkPosition={mapToGauge(1, 0, 3)}
              benchmarkLabel="1.0"
              zones={higherIsBetterZones(50, 25)}
              leftLabel="0"
              rightLabel="3.0"
              hasData={hasBSData}
            />
          ),
        },
        {
          description: "เพียงพอใช้จ่ายยามฉุกเฉิน",
          gauge: (
            <GaugeChart
              value={mapToGauge(liquidityEmergency, 0, 12)}
              displayValue={liquidityEmergency > 0 ? `${liquidityEmergency.toFixed(1)} เดือน` : "-"}
              benchmarkPosition={mapToGauge(6, 0, 12)}
              benchmarkLabel="6 เดือน"
              zones={[
                { start: 0, end: mapToGauge(1, 0, 12), color: "#dc2626" },
                { start: mapToGauge(1, 0, 12), end: mapToGauge(2, 0, 12), color: "#f97316" },
                { start: mapToGauge(2, 0, 12), end: mapToGauge(3, 0, 12), color: "#fbbf24" },
                { start: mapToGauge(3, 0, 12), end: mapToGauge(4.5, 0, 12), color: "#84cc16" },
                { start: mapToGauge(4.5, 0, 12), end: mapToGauge(7.5, 0, 12), color: "#22c55e" },
                { start: mapToGauge(7.5, 0, 12), end: mapToGauge(9, 0, 12), color: "#84cc16" },
                { start: mapToGauge(9, 0, 12), end: mapToGauge(10, 0, 12), color: "#fbbf24" },
                { start: mapToGauge(10, 0, 12), end: mapToGauge(11, 0, 12), color: "#f97316" },
                { start: mapToGauge(11, 0, 12), end: 100, color: "#dc2626" },
              ]}
              leftLabel="0"
              rightLabel="12"
              hasData={hasCFData && hasBSData}
            />
          ),
        },
      ],
    },
    {
      icon: Anchor,
      label: "ภาระหนี้สิน",
      rows: [
        {
          description: "มูลค่าหนี้สินเทียบกับสินทรัพย์",
          gauge: (
            <GaugeChart
              value={mapToGauge(debtToAsset, 0, 100)}
              displayValue={hasBSData ? fmtPct(debtToAsset) : "-"}
              benchmarkPosition={50}
              benchmarkLabel="50%"
              zones={lowerIsBetterZones(40, 65)}
              leftLabel="0%"
              rightLabel="100%"
              hasData={hasBSData}
            />
          ),
        },
        {
          description: "ภาระการผ่อนชำระเทียบกับรายได้",
          gauge: (
            <GaugeChart
              value={mapToGauge(dsr, 0, 80)}
              displayValue={hasCFData ? fmtPct(dsr) : "-"}
              benchmarkPosition={mapToGauge(40, 0, 80)}
              benchmarkLabel="40%"
              zones={lowerIsBetterZones(38, 62)}
              leftLabel="0%"
              rightLabel="80%"
              hasData={hasCFData}
            />
          ),
        },
      ],
    },
    {
      icon: Sprout,
      label: "ออม/ลงทุน",
      rows: [
        {
          description: "เงินออมเทียบกับรายได้",
          gauge: (
            <GaugeChart
              value={mapToGauge(savingRatio, 0, 40)}
              displayValue={hasCFData ? fmtPct(savingRatio) : "-"}
              benchmarkPosition={mapToGauge(10, 0, 40)}
              benchmarkLabel="10%"
              zones={higherIsBetterZones(50, 25)}
              leftLabel="0%"
              rightLabel="40%"
              hasData={hasCFData}
            />
          ),
        },
        {
          description: "สินทรัพย์ลงทุนเทียบกับความมั่งคั่งสุทธิ",
          gauge: (
            <GaugeChart
              value={mapToGauge(investToNetWorth, 0, 100)}
              displayValue={hasBSData && netWorth > 0 ? fmtPct(investToNetWorth) : "-"}
              benchmarkPosition={50}
              benchmarkLabel="50%"
              zones={higherIsBetterZones(50, 30)}
              leftLabel="0%"
              rightLabel="100%"
              hasData={hasBSData && netWorth > 0}
            />
          ),
        },
      ],
    },
    {
      icon: Umbrella,
      label: "ความเสี่ยงภัย",
      rows: [
        {
          description: "มีประกันชีวิตที่เพียงพอ",
          gauge: (
            <GaugeChart
              value={0}
              displayValue="ยังไม่มีข้อมูล"
              zones={higherIsBetterZones(50, 25)}
              leftLabel="ไม่พอ"
              rightLabel="เพียงพอ"
              hasData={false}
            />
          ),
        },
        {
          description: "มีประกันสุขภาพที่เพียงพอ",
          gauge: (
            <GaugeChart
              value={0}
              displayValue="ยังไม่มีข้อมูล"
              zones={higherIsBetterZones(50, 25)}
              leftLabel="ไม่พอ"
              rightLabel="เพียงพอ"
              hasData={false}
            />
          ),
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader title="สุขภาพทางการเงิน" subtitle="Financial Health Check" />

      {!hasData ? (
        <div className="px-4 md:px-8 py-20 text-center">
          <div className="text-4xl mb-4">📊</div>
          <div className="text-sm font-bold text-gray-600 mb-2">ยังไม่มีข้อมูล</div>
          <div className="text-xs text-gray-400">
            กรุณาบันทึกข้อมูล Cash Flow และ Balance Sheet ก่อน
          </div>
        </div>
      ) : (
        <>
          {/* Section 1: สรุปจากงบการเงินส่วนบุคคล */}
          <div className="px-4 md:px-8 pt-4">
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
              <div className="bg-[#1e3a5f] px-4 py-2.5">
                <h2 className="text-xs font-bold text-white">สรุปจากงบการเงินส่วนบุคคล</h2>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {summaryItems.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2 text-gray-700 font-medium">{item.label}</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-800 whitespace-nowrap">
                        {item.value === 0 ? "-" : fmt(item.value)}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-400 whitespace-nowrap text-[13px]">
                        {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: อัตราส่วนทางการเงิน — Gauge style */}
          <div className="px-4 md:px-8 pt-4 pb-8">
            <div className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-[#1e3a5f] px-4 py-2.5">
                <h2 className="text-xs font-bold text-white">อัตราส่วนทางการเงิน</h2>
              </div>

              {dimensions.map((dim, dIdx) => (
                <div key={dIdx} className={`border-b-2 border-gray-200 last:border-b-0 ${dIdx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                  {/* Dimension header */}
                  <div className="pt-4 pb-1 flex justify-center">
                    <DimensionIcon icon={dim.icon} label={dim.label} />
                  </div>

                  {/* Gauge rows — 2 gauges side by side */}
                  <div className="grid grid-cols-2 gap-1 px-2 pb-4">
                    {dim.rows.map((row, rIdx) => (
                      <div key={rIdx} className="flex flex-col items-center">
                        <div className="text-[13px] text-gray-600 font-medium text-center px-2 mb-1 leading-tight">
                          {row.description}
                        </div>
                        {row.gauge}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
