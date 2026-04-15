"use client";

import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  /** auto-dismiss after N ms; 0 = persistent */
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  show: (message: string, type?: ToastType, duration?: number) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

function genId() {
  return Math.random().toString(36).substring(2, 9);
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, type = "success", duration = 2500) => {
    const id = genId();
    set((s) => ({ toasts: [...s.toasts, { id, message, type, duration }] }));
    if (duration > 0) {
      setTimeout(() => {
        get().dismiss(id);
      }, duration);
    }
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Convenience helpers — call from anywhere (components / handlers) */
export const toast = {
  success: (msg: string, duration?: number) =>
    useToastStore.getState().show(msg, "success", duration),
  error: (msg: string, duration?: number) =>
    useToastStore.getState().show(msg, "error", duration),
  info: (msg: string, duration?: number) =>
    useToastStore.getState().show(msg, "info", duration),
  warning: (msg: string, duration?: number) =>
    useToastStore.getState().show(msg, "warning", duration),
};
