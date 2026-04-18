"use client";

/**
 * useClients — React hook that fetches the current FA's client list
 * from Supabase and exposes CRUD operations with optimistic-ish UI
 * state.
 *
 * Minimal dependencies — no SWR/React Query yet. Refetch on mount,
 * after mutations, and on a manual refresh() call. Good enough for
 * the clients page; upgrade to SWR later if we start needing
 * background revalidation.
 */

import { useCallback, useEffect, useState } from "react";
import {
  listClients,
  createClient as createClientRow,
  updateClient as updateClientRow,
  deleteClient as deleteClientRow,
} from "@/lib/supabase/clients";
import type { Client, ClientInsert, ClientUpdate } from "@/lib/supabase/database.types";

interface UseClientsResult {
  clients: Client[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: Omit<ClientInsert, "fa_user_id">) => Promise<Client>;
  update: (id: string, patch: ClientUpdate) => Promise<Client>;
  remove: (id: string) => Promise<void>;
}

export function useClients(): UseClientsResult {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const rows = await listClients();
      setClients(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: Omit<ClientInsert, "fa_user_id">) => {
      const row = await createClientRow(input);
      // Optimistic: prepend so it appears at the top without a roundtrip
      setClients((prev) => [row, ...prev]);
      return row;
    },
    [],
  );

  const update = useCallback(async (id: string, patch: ClientUpdate) => {
    const row = await updateClientRow(id, patch);
    setClients((prev) => prev.map((c) => (c.id === id ? row : c)));
    return row;
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteClientRow(id);
    setClients((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { clients, loading, error, refresh, create, update, remove };
}
