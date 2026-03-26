"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AssetItem, LiabilityItem, AssetCategory, LiabilityCategory, FinancialRatio } from "@/types/balance-sheet";

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function createDefaultAssets(): AssetItem[] {
  return [
    // สินทรัพย์สภาพคล่อง
    { id: generateId(), name: "เงินสด", value: 0, assetType: "liquid" },
    { id: generateId(), name: "เงินฝากออมทรัพย์", value: 0, assetType: "liquid" },
    { id: generateId(), name: "เงินฝากประจำ", value: 0, assetType: "liquid" },
    { id: generateId(), name: "กองทุนรวมตลาดเงิน", value: 0, assetType: "liquid" },
    // สินทรัพย์ลงทุน
    { id: generateId(), name: "หุ้น", value: 0, assetType: "investment" },
    { id: generateId(), name: "กองทุนรวม", value: 0, assetType: "investment" },
    { id: generateId(), name: "พันธบัตร", value: 0, assetType: "investment" },
    { id: generateId(), name: "PVD (กองทุนสำรองเลี้ยงชีพ)", value: 0, assetType: "investment" },
    { id: generateId(), name: "RMF", value: 0, assetType: "investment" },
    { id: generateId(), name: "TESG", value: 0, assetType: "investment" },
    { id: generateId(), name: "มูลค่ากรมธรรม์ กรณีเวนคืนกรมธรรม์", value: 0, assetType: "investment" },
    // สินทรัพย์ใช้ส่วนตัว
    { id: generateId(), name: "บ้าน/คอนโด", value: 0, assetType: "personal" },
    { id: generateId(), name: "รถยนต์", value: 0, assetType: "personal" },
    { id: generateId(), name: "ทรัพย์สินอื่นๆ", value: 0, assetType: "personal" },
  ];
}

function createDefaultLiabilities(): LiabilityItem[] {
  return [
    // หนี้สินระยะสั้น
    { id: generateId(), name: "บัตรเครดิต", value: 0, liabilityType: "short_term" },
    { id: generateId(), name: "ค่างวดค้างจ่าย", value: 0, liabilityType: "short_term" },
    { id: generateId(), name: "สินเชื่อส่วนบุคคล", value: 0, liabilityType: "short_term" },
    // หนี้สินระยะยาว
    { id: generateId(), name: "สินเชื่อบ้าน", value: 0, liabilityType: "long_term" },
    { id: generateId(), name: "สินเชื่อรถ", value: 0, liabilityType: "long_term" },
  ];
}

interface BalanceSheetState {
  assets: AssetItem[];
  liabilities: LiabilityItem[];

  // Actions
  addAsset: (name: string, assetType: AssetCategory) => string;
  addLiability: (name: string, liabilityType: LiabilityCategory) => string;
  removeItem: (id: string) => void;
  updateValue: (id: string, value: number) => void;
  updateName: (id: string, name: string) => void;
  setAssetCategory: (id: string, category: AssetCategory) => void;
  setLiabilityCategory: (id: string, category: LiabilityCategory) => void;
  clearAll: () => void;

  // Computed
  getTotalByAssetType: (type: AssetCategory) => number;
  getTotalByLiabilityType: (type: LiabilityCategory) => number;
  getTotalAssets: () => number;
  getTotalLiabilities: () => number;
  getNetWorth: () => number;
  getFinancialRatios: (cfVariables: Record<string, number>) => FinancialRatio[];
}

export const useBalanceSheetStore = create<BalanceSheetState>()(
  persist(
    (set, get) => ({
      assets: createDefaultAssets(),
      liabilities: createDefaultLiabilities(),

      addAsset: (name, assetType) => {
        const id = generateId();
        set((state) => ({
          assets: [
            ...state.assets,
            { id, name, value: 0, assetType },
          ],
        }));
        return id;
      },

      addLiability: (name, liabilityType) => {
        const id = generateId();
        set((state) => ({
          liabilities: [
            ...state.liabilities,
            { id, name, value: 0, liabilityType },
          ],
        }));
        return id;
      },

      removeItem: (id) =>
        set((state) => ({
          assets: state.assets.filter((a) => a.id !== id),
          liabilities: state.liabilities.filter((l) => l.id !== id),
        })),

      updateValue: (id, value) =>
        set((state) => ({
          assets: state.assets.map((a) =>
            a.id === id ? { ...a, value } : a
          ),
          liabilities: state.liabilities.map((l) =>
            l.id === id ? { ...l, value } : l
          ),
        })),

      updateName: (id, name) =>
        set((state) => ({
          assets: state.assets.map((a) =>
            a.id === id ? { ...a, name } : a
          ),
          liabilities: state.liabilities.map((l) =>
            l.id === id ? { ...l, name } : l
          ),
        })),

      setAssetCategory: (id, category) =>
        set((state) => ({
          assets: state.assets.map((a) =>
            a.id === id ? { ...a, assetType: category } : a
          ),
        })),

      setLiabilityCategory: (id, category) =>
        set((state) => ({
          liabilities: state.liabilities.map((l) =>
            l.id === id ? { ...l, liabilityType: category } : l
          ),
        })),

      clearAll: () =>
        set({
          assets: createDefaultAssets(),
          liabilities: createDefaultLiabilities(),
        }),

      getTotalByAssetType: (type) => {
        return get().assets
          .filter((a) => a.assetType === type)
          .reduce((sum, a) => sum + a.value, 0);
      },

      getTotalByLiabilityType: (type) => {
        return get().liabilities
          .filter((l) => l.liabilityType === type)
          .reduce((sum, l) => sum + l.value, 0);
      },

      getTotalAssets: () => {
        return get().assets.reduce((sum, a) => sum + a.value, 0);
      },

      getTotalLiabilities: () => {
        return get().liabilities.reduce((sum, l) => sum + l.value, 0);
      },

      getNetWorth: () => {
        return get().getTotalAssets() - get().getTotalLiabilities();
      },

      getFinancialRatios: (cfVars) => {
        const totalAssets = get().getTotalAssets();
        const totalLiabilities = get().getTotalLiabilities();
        const liquidAssets = get().getTotalByAssetType("liquid");
        const netWorth = totalAssets - totalLiabilities;

        const monthlyExpense = cfVars.monthly_total_expense || 0;
        const monthlyIncome = cfVars.monthly_income || 0;
        const monthlyDebt = cfVars.monthly_debt_payment || 0;
        const monthlySaving = cfVars.monthly_saving || 0;

        const ratios: FinancialRatio[] = [];

        // 1. Liquidity Ratio
        const liquidityRatio = monthlyExpense > 0 ? liquidAssets / monthlyExpense : 0;
        ratios.push({
          name: "Liquidity Ratio (สภาพคล่อง)",
          value: liquidityRatio,
          unit: "เท่า",
          status: liquidityRatio >= 6 ? "good" : liquidityRatio >= 3 ? "warning" : "danger",
          benchmark: "≥ 6 เดือน ดี / 3-6 พอใช้ / < 3 ต้องปรับ",
        });

        // 2. D/A Ratio
        const daRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
        ratios.push({
          name: "Debt to Asset Ratio (หนี้สิน/สินทรัพย์)",
          value: daRatio,
          unit: "%",
          status: daRatio <= 50 ? "good" : daRatio <= 75 ? "warning" : "danger",
          benchmark: "≤ 50% ดี / 50-75% ระวัง / > 75% ต้องปรับ",
        });

        // 3. DSR (Debt Service Ratio)
        const dsr = monthlyIncome > 0 ? (monthlyDebt / monthlyIncome) * 100 : 0;
        ratios.push({
          name: "DSR (ความสามารถชำระหนี้)",
          value: dsr,
          unit: "%",
          status: monthlyIncome === 0 ? "neutral" : dsr <= 35 ? "good" : dsr <= 50 ? "warning" : "danger",
          benchmark: monthlyIncome === 0 ? "กรุณาบันทึก Cash Flow ก่อน" : "≤ 35% ดี / 35-50% ระวัง / > 50% ต้องปรับ",
        });

        // 4. Saving Ratio
        const savingRatio = monthlyIncome > 0 ? (monthlySaving / monthlyIncome) * 100 : 0;
        ratios.push({
          name: "Saving Ratio (อัตราการออม)",
          value: savingRatio,
          unit: "%",
          status: monthlyIncome === 0 ? "neutral" : savingRatio >= 20 ? "good" : savingRatio >= 10 ? "warning" : "danger",
          benchmark: monthlyIncome === 0 ? "กรุณาบันทึก Cash Flow ก่อน" : "≥ 20% ดี / 10-20% พอใช้ / < 10% ต้องปรับ",
        });

        // 5. Net Worth
        ratios.push({
          name: "Net Worth (ความมั่งคั่งสุทธิ)",
          value: netWorth,
          unit: "฿",
          status: netWorth > 0 ? "good" : netWorth === 0 ? "warning" : "danger",
          benchmark: netWorth > 0 ? "สินทรัพย์มากกว่าหนี้สิน" : "หนี้สินมากกว่าสินทรัพย์",
        });

        return ratios;
      },
    }),
    { name: "ffc-balance-sheet" }
  )
);
