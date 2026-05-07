"use client";

/**
 * useClients — React hook that fetches the current FA's client list
 * (own + visible subordinates' for Pro/Ultra) and exposes CRUD ops.
 *
 * Phase 2 update (migration 021): the list query now goes through
 * the SECURITY DEFINER RPC `list_visible_clients` so Pro/Ultra see
 * their team's clients with `can_edit = false`. WRITES still use
 * the strict-owner mutators — those will throw if the FA tries to
 * mutate a client they don't own (defence in depth on top of the
 * UI's read-only mode).
 *
 * Minimal dependencies — no SWR/React Query yet. Refetch on mount,
 * after mutations, and on a manual refresh() call.
 */

import { useCallback, useEffect, useState } from "react";
import {
  createClient as createClientRow,
  updateClient as updateClientRow,
  deleteClient as deleteClientRow,
} from "@/lib/supabase/clients";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Client, ClientInsert, ClientUpdate } from "@/lib/supabase/database.types";

/** Client row augmented with visibility metadata from list_visible_clients. */
export interface ClientWithVisibility extends Client {
  can_edit: boolean;
  owner_display_name: string | null;
  owner_fa_code: string | null;
}

interface UseClientsResult {
  clients: ClientWithVisibility[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: Omit<ClientInsert, "fa_user_id">) => Promise<Client>;
  update: (id: string, patch: ClientUpdate) => Promise<Client>;
  remove: (id: string) => Promise<void>;
}

export function useClients(): UseClientsResult {
  const [clients, setClients] = useState<ClientWithVisibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const supabase = createSupabaseClient();
      const { data, error: rpcError } = await (
        supabase.rpc as unknown as (
          fn: string,
        ) => Promise<{
          data: ClientWithVisibility[] | null;
          error: { message: string } | null;
        }>
      )("list_visible_clients");
      if (rpcError) throw rpcError;
      setClients(data ?? []);
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
      // Newly-created clients are always own → can_edit = true and
      // no owner identity badge needed.
      setClients((prev) => [
        {
          ...row,
          can_edit: true,
          owner_display_name: null,
          owner_fa_code: null,
        },
        ...prev,
      ]);
      return row;
    },
    [],
  );

  const update = useCallback(async (id: string, patch: ClientUpdate) => {
    const row = await updateClientRow(id, patch);
    setClients((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...row,
              can_edit: c.can_edit,
              owner_display_name: c.owner_display_name,
              owner_fa_code: c.owner_fa_code,
            }
          : c,
      ),
    );
    return row;
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteClientRow(id);
    setClients((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { clients, loading, error, refresh, create, update, remove };
}
