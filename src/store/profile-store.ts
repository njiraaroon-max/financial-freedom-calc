"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OccupationType =
  | "private"           // พนักงานเอกชน — SSO + PVD + เงินชดเชยเลิกจ้าง
  | "government"        // ข้าราชการ — กบข. + บำนาญ
  | "state_enterprise"  // รัฐวิสาหกิจ — กองทุนสำรองฯ ของแต่ละ องค์กร + บำเหน็จ/บำนาญ ของรัฐวิสาหกิจ
  | "freelance"         // อาชีพอิสระ — ไม่มีสวัสดิการจากนายจ้าง
  | "business_owner";   // เจ้าของกิจการ — รายได้จากธุรกิจ
export type MaritalStatus = "single" | "married" | "married_with_children";
export type Gender = "M" | "F";

export interface ProfileState {
  // ข้อมูลส่วนตัว
  name: string;
  birthDate: string;            // YYYY-MM-DD
  gender: Gender;               // M | F  — used by Allianz pricer (age+gender rates)
  occupation: OccupationType;
  maritalStatus: MaritalStatus;
  numberOfChildren: number;

  // ข้อมูลการทำงาน
  salary: number;               // เงินเดือน
  salaryCap: number;            // เพดานเงินเดือนสูงสุด
  retireAge: number;            // อายุเกษียณ
  yearsWorked: number;          // ทำงานมาแล้วกี่ปี
  socialSecurityMonths: number; // ส่งประกันสังคมมาแล้วกี่เดือน

  // Computed
  getAge: () => number;

  // Actions
  updateProfile: <K extends keyof Omit<ProfileState, "getAge" | "updateProfile" | "clearProfile">>(
    key: K,
    value: ProfileState[K]
  ) => void;
  clearProfile: () => void;
}

const DEFAULT_PROFILE = {
  name: "",
  birthDate: "",
  gender: "M" as Gender,
  occupation: "private" as OccupationType,
  maritalStatus: "single" as MaritalStatus,
  numberOfChildren: 0,
  salary: 0,
  salaryCap: 0,
  retireAge: 60,
  yearsWorked: 0,
  socialSecurityMonths: 0,
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_PROFILE,

      getAge: () => {
        const bd = get().birthDate;
        if (!bd) return 0;
        const birth = new Date(bd);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
      },

      updateProfile: (key, value) => set({ [key]: value }),

      clearProfile: () => set({ ...DEFAULT_PROFILE }),
    }),
    { name: "ffc-profile" }
  )
);

// Labels
export const OCCUPATION_OPTIONS = [
  { value: "private" as const, label: "พนักงานเอกชน", description: "ประกันสังคม + PVD + เงินชดเชย" },
  { value: "government" as const, label: "ข้าราชการ", description: "กบข. + บำนาญข้าราชการ" },
  { value: "state_enterprise" as const, label: "รัฐวิสาหกิจ", description: "กองทุนสำรองฯ + บำเหน็จ/บำนาญ รัฐวิสาหกิจ" },
  { value: "freelance" as const, label: "Freelance / อาชีพอิสระ", description: "ไม่มีสวัสดิการจากนายจ้าง" },
  { value: "business_owner" as const, label: "เจ้าของกิจการ", description: "รายได้จากธุรกิจส่วนตัว ไม่มีสวัสดิการจากนายจ้าง" },
];

/**
 * Salaried = มีนายจ้างจ่ายเงินเดือนคงที่ (พนักงานเอกชน / ข้าราชการ /
 * รัฐวิสาหกิจ). Non-salaried (freelance, เจ้าของกิจการ) รายได้ผันผวน
 * ต่อเดือน — UI ควรโชว์ label "รายรับเฉลี่ยต่อเดือน" แทน "เงินเดือน"
 * เพื่อไม่ให้สับสนกับคอนเซปต์เงินเดือนประจำ.
 */
export function isSalariedOccupation(o: OccupationType): boolean {
  return o === "private" || o === "government" || o === "state_enterprise";
}

export function monthlyIncomeLabel(o: OccupationType): string {
  return isSalariedOccupation(o) ? "เงินเดือน" : "รายรับเฉลี่ยต่อเดือน";
}

export const MARITAL_OPTIONS = [
  { value: "single" as const, label: "โสด", description: "" },
  { value: "married" as const, label: "แต่งงาน (ไม่มีบุตร)", description: "" },
  { value: "married_with_children" as const, label: "แต่งงาน (มีบุตร)", description: "" },
];

export const GENDER_OPTIONS = [
  { value: "M" as const, label: "ชาย" },
  { value: "F" as const, label: "หญิง" },
];
