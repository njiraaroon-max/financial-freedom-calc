"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SavedVariable {
  key: string;
  label: string;
  value: number;
  source: string; // e.g. "cashflow", "retirement", "emergency"
  updatedAt: string;
}

interface VariableState {
  variables: Record<string, SavedVariable>;
  setVariable: (variable: Omit<SavedVariable, "updatedAt">) => void;
  getVariable: (key: string) => SavedVariable | undefined;
  removeVariable: (key: string) => void;
}

export const useVariableStore = create<VariableState>()(
  persist(
    (set, get) => ({
      variables: {},

      setVariable: (variable) =>
        set((state) => ({
          variables: {
            ...state.variables,
            [variable.key]: { ...variable, updatedAt: new Date().toISOString() },
          },
        })),

      getVariable: (key) => get().variables[key],

      removeVariable: (key) =>
        set((state) => {
          const { [key]: _, ...rest } = state.variables;
          return { variables: rest };
        }),
    }),
    {
      name: "ffc-variables",
    }
  )
);
