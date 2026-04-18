"use client";

/**
 * active-client-store — tracks which client the FA is currently
 * planning for. Persisted to localStorage so the selection survives
 * reloads, and also written to a cookie so server components /
 * middleware can read it in Phase D.
 *
 * This is intentionally small: id + name only. Full client data is
 * fetched fresh from Supabase as needed.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

const COOKIE_NAME = "ffc-active-client";

interface ActiveClientState {
  activeClientId: string | null;
  activeClientName: string | null;
  setActive: (id: string, name: string) => void;
  clearActive: () => void;
}

function writeCookie(id: string | null) {
  if (typeof document === "undefined") return;
  if (id) {
    // 30 days
    document.cookie = `${COOKIE_NAME}=${id}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  } else {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export const useActiveClientStore = create<ActiveClientState>()(
  persist(
    (set) => ({
      activeClientId: null,
      activeClientName: null,
      setActive: (id, name) => {
        writeCookie(id);
        set({ activeClientId: id, activeClientName: name });
      },
      clearActive: () => {
        writeCookie(null);
        set({ activeClientId: null, activeClientName: null });
      },
    }),
    {
      name: "ffc-active-client",
      // Keep cookie in sync on hydration
      onRehydrateStorage: () => (state) => {
        if (state?.activeClientId) writeCookie(state.activeClientId);
      },
    },
  ),
);
