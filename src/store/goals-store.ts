import { create } from "zustand";
import { persist } from "zustand/middleware";

export type GoalCategory =
  | "emergency"
  | "insurance_life"
  | "insurance_health"
  | "insurance_saving"
  | "retirement"
  | "travel"
  | "house"
  | "car"
  | "wedding"
  | "education"
  | "business"
  | "custom";

export type GoalFrequency = "immediate" | "once" | "yearly";

export interface GoalItem {
  id: string;
  name: string;
  category: GoalCategory;
  iconName?: string; // custom icon override (for "อื่นๆ")
  amount: number | null; // null = ไม่ทราบ
  amountSourceKey: string | null; // key ใน variable store
  targetYear: number | null; // null = ทันที
  targetAge: number | null;
  frequency: GoalFrequency;
  notes: string;
  order: number;
  createdAt: string;
}

export interface PresetGoal {
  category: GoalCategory;
  name: string;
  iconName: string;
  defaultFrequency: GoalFrequency;
  amountSourceKey: string | null;
  description: string;
}

export const PRESET_GOALS: PresetGoal[] = [
  {
    category: "emergency",
    name: "เงินสำรองฉุกเฉิน",
    iconName: "ShieldAlert",
    defaultFrequency: "immediate",
    amountSourceKey: "emergency_fund_target",
    description: "เงินสำรอง 3-6 เดือน",
  },
  {
    category: "insurance_life",
    name: "ประกันชีวิต",
    iconName: "HeartPulse",
    defaultFrequency: "immediate",
    amountSourceKey: null,
    description: "เบี้ยประกันชีวิต",
  },
  {
    category: "insurance_health",
    name: "ประกันสุขภาพและโรคร้ายแรง",
    iconName: "HeartPulse",
    defaultFrequency: "immediate",
    amountSourceKey: null,
    description: "เบี้ยประกันสุขภาพ",
  },
  {
    category: "insurance_saving",
    name: "ประกันสะสมทรัพย์",
    iconName: "PiggyBank",
    defaultFrequency: "immediate",
    amountSourceKey: null,
    description: "ออมทรัพย์ผ่านประกัน",
  },
  {
    category: "retirement",
    name: "ทุนเกษียณอายุ",
    iconName: "Palmtree",
    defaultFrequency: "once",
    amountSourceKey: "retire_fund_needed",
    description: "เงินก้อนสำหรับเกษียณ",
  },
  {
    category: "travel",
    name: "ทุนท่องเที่ยว",
    iconName: "Plane",
    defaultFrequency: "yearly",
    amountSourceKey: null,
    description: "ท่องเที่ยวในและต่างประเทศ",
  },
  {
    category: "house",
    name: "ซื้อบ้าน/คอนโด",
    iconName: "Home",
    defaultFrequency: "once",
    amountSourceKey: null,
    description: "เป้าหมายที่อยู่อาศัย",
  },
  {
    category: "car",
    name: "ซื้อรถยนต์",
    iconName: "Car",
    defaultFrequency: "once",
    amountSourceKey: null,
    description: "ดาวน์หรือซื้อสด",
  },
  {
    category: "wedding",
    name: "แต่งงาน",
    iconName: "Heart",
    defaultFrequency: "once",
    amountSourceKey: null,
    description: "งานแต่งงาน",
  },
  {
    category: "education",
    name: "การศึกษาบุตร",
    iconName: "GraduationCap",
    defaultFrequency: "once",
    amountSourceKey: null,
    description: "ทุนการศึกษาบุตร",
  },
  {
    category: "business",
    name: "เริ่มธุรกิจ",
    iconName: "Briefcase",
    defaultFrequency: "once",
    amountSourceKey: null,
    description: "เงินลงทุนธุรกิจ",
  },
  {
    category: "custom",
    name: "อื่นๆ",
    iconName: "Star",
    defaultFrequency: "once",
    amountSourceKey: null,
    description: "เป้าหมายที่กำหนดเอง",
  },
];

interface GoalsState {
  goals: GoalItem[];
  addGoal: (goal: Omit<GoalItem, "id" | "createdAt" | "order">) => void;
  updateGoal: (id: string, updates: Partial<GoalItem>) => void;
  removeGoal: (id: string) => void;
  reorderGoals: (goals: GoalItem[]) => void;
  clearGoals: () => void;
}

export const useGoalsStore = create<GoalsState>()(
  persist(
    (set, get) => ({
      goals: [],

      addGoal: (goal) => {
        const goals = get().goals;
        const newGoal: GoalItem = {
          ...goal,
          id: Math.random().toString(36).substring(2, 9),
          order: goals.length,
          createdAt: new Date().toISOString(),
        };
        set({ goals: [...goals, newGoal] });
      },

      updateGoal: (id, updates) => {
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
        }));
      },

      removeGoal: (id) => {
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id).map((g, i) => ({ ...g, order: i })),
        }));
      },

      reorderGoals: (goals) => {
        set({ goals: goals.map((g, i) => ({ ...g, order: i })) });
      },

      clearGoals: () => set({ goals: [] }),
    }),
    {
      name: "ffc-goals",
      version: 1,
    }
  )
);
