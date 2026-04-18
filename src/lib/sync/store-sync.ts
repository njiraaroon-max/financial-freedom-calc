"use client";

/**
 * Store sync registry — maps each Zustand store to a plan_data
 * domain. Single source of truth for "what to save/load per client."
 *
 * To add a new store to sync: import the hook, append an entry to
 * SYNCED_STORES with a unique domain string. No migration needed —
 * plan_data.domain is a plain TEXT column.
 */

import type { PlanDomain } from "@/lib/supabase/database.types";

import { useProfileStore } from "@/store/profile-store";
import { useCashFlowStore } from "@/store/cashflow-store";
import { useBalanceSheetStore } from "@/store/balance-sheet-store";
import { useRetirementStore } from "@/store/retirement-store";
import { useInsuranceStore } from "@/store/insurance-store";
import { useGoalsStore } from "@/store/goals-store";
import { useTaxStore } from "@/store/tax-store";
import { useVariableStore } from "@/store/variable-store";
import { useEducationStore } from "@/store/education-store";

/**
 * Minimal Zustand store shape — each hook exposes these statics.
 * We only care about the three methods, not the hook's per-component
 * subscription semantics.
 */
interface ZustandHook {
  getState: () => unknown;
  setState: (partial: Record<string, unknown>) => void;
  subscribe: (listener: () => void) => () => void;
}

export interface SyncedStore {
  domain: PlanDomain;
  label: string;
  getState: () => Record<string, unknown>;
  setState: (state: Record<string, unknown>) => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Strip function-valued keys before serializing. Zustand stores
 * include action methods on the state object; they can't round-trip
 * through JSON, and re-hydrating them would overwrite the real
 * actions attached by the create() call.
 */
function stripActions(state: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key in state) {
    if (typeof state[key] !== "function") {
      out[key] = state[key];
    }
  }
  return out;
}

function entry(
  domain: PlanDomain,
  label: string,
  hook: ZustandHook,
): SyncedStore {
  return {
    domain,
    label,
    getState: () => stripActions(hook.getState() as Record<string, unknown>),
    setState: (state) => {
      // Shallow merge — keeps existing action functions intact.
      hook.setState(state);
    },
    subscribe: (listener) => hook.subscribe(listener),
  };
}

export const SYNCED_STORES: SyncedStore[] = [
  entry("profile", "Profile", useProfileStore),
  entry("cashflow", "Cashflow", useCashFlowStore),
  entry("balance_sheet", "Balance Sheet", useBalanceSheetStore),
  entry("retirement", "Retirement", useRetirementStore),
  entry("insurance", "Insurance", useInsuranceStore),
  entry("education", "Education", useEducationStore),
  entry("goals", "Goals", useGoalsStore),
  entry("tax", "Tax", useTaxStore),
  entry("variables", "Variables", useVariableStore),
];
