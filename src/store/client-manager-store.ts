"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// All localStorage keys used by the app stores
const STORE_KEYS = [
  "ffc-profile",
  "ffc-cashflow",
  "ffc-balance-sheet",
  "ffc-retirement",
  "ffc-variables",
];

export interface ClientBundle {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  data: Record<string, string>; // key → JSON string from localStorage
}

interface ClientManagerState {
  clients: ClientBundle[];
  activeClientId: string | null;

  // Actions
  saveCurrentAsClient: (name: string) => string;
  updateClient: (id: string) => void;
  loadClient: (id: string) => void;
  deleteClient: (id: string) => void;
  createNewClient: () => void;
  getActiveClient: () => ClientBundle | undefined;
  getClientProgress: (id: string) => number;
}

function captureStoreData(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of STORE_KEYS) {
    const val = localStorage.getItem(key);
    if (val) data[key] = val;
  }
  return data;
}

function restoreStoreData(data: Record<string, string>) {
  // Clear current stores
  for (const key of STORE_KEYS) {
    localStorage.removeItem(key);
  }
  // Restore saved data
  for (const [key, val] of Object.entries(data)) {
    localStorage.setItem(key, val);
  }
  // Redirect to home page to re-initialize all Zustand stores
  window.location.href = "/";
}

function clearAllStores() {
  for (const key of STORE_KEYS) {
    localStorage.removeItem(key);
  }
}

function calculateProgress(data: Record<string, string>): number {
  let completed = 0;
  const total = 5; // profile, cashflow, balance-sheet, retirement, variables

  // Check profile
  try {
    const profile = JSON.parse(data["ffc-profile"] || "{}");
    const state = profile?.state;
    if (state?.name && state.name.trim() !== "") completed += 1;
  } catch { /* empty */ }

  // Check cashflow
  try {
    const cf = JSON.parse(data["ffc-cashflow"] || "{}");
    const state = cf?.state;
    if (state?.incomes?.length > 0 || state?.expenses?.length > 0) {
      const hasValues = [...(state.incomes || []), ...(state.expenses || [])].some(
        (item: { amounts?: number[] }) => item.amounts?.some((a: number) => a > 0)
      );
      if (hasValues) completed += 1;
    }
  } catch { /* empty */ }

  // Check balance sheet
  try {
    const bs = JSON.parse(data["ffc-balance-sheet"] || "{}");
    const state = bs?.state;
    if (state?.assets?.length > 0 || state?.liabilities?.length > 0) {
      const hasValues = [...(state.assets || []), ...(state.liabilities || [])].some(
        (item: { value?: number }) => (item.value || 0) > 0
      );
      if (hasValues) completed += 1;
    }
  } catch { /* empty */ }

  // Check retirement
  try {
    const ret = JSON.parse(data["ffc-retirement"] || "{}");
    const state = ret?.state;
    if (state?.basicExpenses?.length > 0) {
      const hasValues = state.basicExpenses.some((e: { monthlyAmount?: number }) => (e.monthlyAmount || 0) > 0);
      if (hasValues) completed += 1;
    }
  } catch { /* empty */ }

  // Check variables (means they've saved at least once)
  try {
    const vars = JSON.parse(data["ffc-variables"] || "{}");
    const state = vars?.state;
    if (state?.variables && Object.keys(state.variables).length > 3) completed += 1;
  } catch { /* empty */ }

  return Math.round((completed / total) * 100);
}

export const useClientManagerStore = create<ClientManagerState>()(
  persist(
    (set, get) => ({
      clients: [],
      activeClientId: null,

      saveCurrentAsClient: (name: string) => {
        const id = generateId();
        const now = new Date().toISOString();

        // Save name to profile store so it shows on home page
        try {
          const profileRaw = localStorage.getItem("ffc-profile");
          const profile = profileRaw ? JSON.parse(profileRaw) : { state: {} };
          profile.state = { ...profile.state, name };
          localStorage.setItem("ffc-profile", JSON.stringify(profile));
        } catch { /* empty */ }

        const bundle: ClientBundle = {
          id,
          name,
          createdAt: now,
          updatedAt: now,
          data: captureStoreData(),
        };
        set((state) => ({
          clients: [...state.clients, bundle],
          activeClientId: id,
        }));
        return id;
      },

      updateClient: (id: string) => {
        const now = new Date().toISOString();
        const data = captureStoreData();

        // Also update name from profile
        let clientName = "";
        try {
          const profile = JSON.parse(data["ffc-profile"] || "{}");
          clientName = profile?.state?.name || "";
        } catch { /* empty */ }

        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === id
              ? { ...c, updatedAt: now, data, name: clientName || c.name }
              : c
          ),
        }));
      },

      loadClient: (id: string) => {
        const client = get().clients.find((c) => c.id === id);
        if (!client) return;

        // Save current client first if there's an active one
        const activeId = get().activeClientId;
        if (activeId && activeId !== id) {
          get().updateClient(activeId);
        }

        set({ activeClientId: id });
        restoreStoreData(client.data);
      },

      deleteClient: (id: string) => {
        set((state) => ({
          clients: state.clients.filter((c) => c.id !== id),
          activeClientId: state.activeClientId === id ? null : state.activeClientId,
        }));
      },

      createNewClient: () => {
        // Save current client if active
        const activeId = get().activeClientId;
        if (activeId) {
          get().updateClient(activeId);
        }

        // Clear all stores and redirect to home
        clearAllStores();
        set({ activeClientId: null });
        window.location.href = "/";
      },

      getActiveClient: () => {
        const { clients, activeClientId } = get();
        return clients.find((c) => c.id === activeClientId);
      },

      getClientProgress: (id: string) => {
        const client = get().clients.find((c) => c.id === id);
        if (!client) return 0;
        return calculateProgress(client.data);
      },
    }),
    { name: "ffc-client-manager" }
  )
);
