"use client";

/**
 * Store sync registry — maps each Zustand store to a plan_data
 * domain. Single source of truth for "what to save/load per client."
 *
 * Each entry exposes:
 *  - getState() / setState() / subscribe() — the zustand trio, sans
 *    action methods (stripActions guards round-trip through JSON)
 *  - reset() — wipe back to defaults. Called when switching to a
 *    client that has NO row for this domain yet, so the previous
 *    client's data doesn't leak into the new one's first autosave.
 *
 * To add a new store: import the hook, append an entry with a unique
 * domain string and a reset thunk. plan_data.domain is a plain TEXT
 * column — no migration needed.
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
import { useSelectedModulesStore } from "@/store/selected-modules-store";

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
  reset: () => void;
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
  reset: () => void,
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
    reset,
  };
}

// Type-narrow the hook to its shape that exposes the clear/reset action
// we want. We cast at call-site rather than parameterize `entry` to
// avoid pulling every store's state type into this file.
type WithAction<K extends string> = { [P in K]: () => void };

export const SYNCED_STORES: SyncedStore[] = [
  entry("profile", "Profile", useProfileStore, () =>
    (useProfileStore.getState() as WithAction<"clearProfile">).clearProfile(),
  ),
  entry("cashflow", "Cashflow", useCashFlowStore, () =>
    (useCashFlowStore.getState() as WithAction<"clearAll">).clearAll(),
  ),
  entry("balance_sheet", "Balance Sheet", useBalanceSheetStore, () =>
    (useBalanceSheetStore.getState() as WithAction<"clearAll">).clearAll(),
  ),
  entry("retirement", "Retirement", useRetirementStore, () =>
    (useRetirementStore.getState() as WithAction<"clearAll">).clearAll(),
  ),
  entry("insurance", "Insurance", useInsuranceStore, () =>
    (useInsuranceStore.getState() as WithAction<"clearAll">).clearAll(),
  ),
  entry("education", "Education", useEducationStore, () =>
    (useEducationStore.getState() as WithAction<"clearAll">).clearAll(),
  ),
  entry("goals", "Goals", useGoalsStore, () =>
    (useGoalsStore.getState() as WithAction<"clearGoals">).clearGoals(),
  ),
  entry("tax", "Tax", useTaxStore, () =>
    (useTaxStore.getState() as WithAction<"clearAll">).clearAll(),
  ),
  // variable-store has no dedicated reset action — wipe the map directly.
  entry("variables", "Variables", useVariableStore, () =>
    useVariableStore.setState({ variables: {} }),
  ),
  entry("selected_modules", "Selected Modules", useSelectedModulesStore, () =>
    (useSelectedModulesStore.getState() as WithAction<"clearAll">).clearAll(),
  ),
];
