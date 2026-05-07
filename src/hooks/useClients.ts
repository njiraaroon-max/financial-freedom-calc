"use client";

/**
 * useClients — fetches the current FA's OWN client list.
 *
 * Strict-owner: returns only clients where fa_user_id = auth.uid().
 * Subordinate views are explicitly NOT included — UX feedback during
 * Phase 1 testing was that Pro/Ultra dashboards became cluttered when
 * /clients dumped own + entire team in one list. The flow is now:
 *
 *   /clients          → own clients only (this hook)
 *   /team             → list of subordinates (useTeam)
 *   /team/[fa_id]     → drill-in to one subordinate's clients (useFaClients)
 *   /clients/[id]     → still uses get_client_for_viewer RPC so detail
 *                        pages handle both own + read-only viewing
 *
 * Refetch on mount + after mutations + on manual refresh() call.
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
