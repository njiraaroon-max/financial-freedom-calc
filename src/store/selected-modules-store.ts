"use client";

/**
 * Tracks which modules the FA has pinned onto the radial ring for the
 * current client. Persists locally (per-browser fallback) and syncs to
 * Supabase via the "selected_modules" plan_data domain, so each client
 * remembers its own ring layout.
 *
 * Legacy key "ffc-selected-modules" (global, pre-multi-client) is
 * migrated on first load: if the new store is still empty and the old
 * key has data, we copy it in and drop the old key.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

const LEGACY_KEY = "ffc-selected-modules";

export interface SelectedModulesState {
  selectedNames: string[];

  addModule: (name: string) => void;
  removeModule: (name: string) => void;
  setSelectedNames: (names: string[]) => void;
  clearAll: () => void;
}

function readLegacy(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export const useSelectedModulesStore = create<SelectedModulesState>()(
  persist(
    (set, get) => ({
      selectedNames: [],

      addModule: (name) =>
        set((state) =>
          state.selectedNames.includes(name)
            ? state
            : { selectedNames: [...state.selectedNames, name] },
        ),

      removeModule: (name) =>
        set((state) => ({
          selectedNames: state.selectedNames.filter((n) => n !== name),
        })),

      setSelectedNames: (names) => set({ selectedNames: names }),

      clearAll: () => set({ selectedNames: [] }),
    }),
    {
      name: "ffc-selected-modules-v2",
      onRehydrateStorage: () => (state) => {
        // One-time migration: if still empty after rehydrate and a
        // legacy global list exists, fold it in.
        if (!state) return;
        if (state.selectedNames && state.selectedNames.length > 0) return;
        const legacy = readLegacy();
        if (legacy && legacy.length > 0) {
          state.setSelectedNames(legacy);
          try {
            window.localStorage.removeItem(LEGACY_KEY);
          } catch {
            /* ignore */
          }
        }
      },
    },
  ),
);
