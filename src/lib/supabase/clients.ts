"use client";

/**
 * Client CRUD helpers — wraps Supabase queries so UI code doesn't
 * have to deal with the client/table naming confusion (our table is
 * called "clients"; Supabase's client factory is also "createClient").
 *
 * All functions throw on error — callers handle try/catch or use
 * the useClients() hook which surfaces errors in state.
 *
 * RLS ensures only the current FA's rows come back, so we never
 * filter by fa_user_id client-side.
 */

import { createClient as createSupabase } from "./client";
import type {
  Client,
  ClientInsert,
  ClientUpdate,
} from "./database.types";

/** List all active clients of the current FA, newest first. */
export async function listClients(includeArchived = false): Promise<Client[]> {
  const sb = createSupabase();
  const q = sb.from("clients").select("*").order("updated_at", { ascending: false });
  if (!includeArchived) q.eq("status", "active");

  const { data, error } = await q;
  if (error) throw new Error(`listClients: ${error.message}`);
  return (data ?? []) as Client[];
}

/** Fetch one client by id. Returns null if not found (or RLS blocked). */
export async function getClient(id: string): Promise<Client | null> {
  const sb = createSupabase();
  const { data, error } = await sb
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getClient: ${error.message}`);
  return (data as Client | null) ?? null;
}

/**
 * Create a new client under the current FA. Accepts only the
 * input fields — fa_user_id is set server-side (well, by RLS policy
 * `with check`) using the current session's auth.uid().
 */
export async function createClient(
  input: Omit<ClientInsert, "fa_user_id">,
): Promise<Client> {
  const sb = createSupabase();

  // We need auth.uid() for the with-check policy. Easier to read it
  // here than let the policy fail silently.
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("createClient: not authenticated");

  const { data, error } = await sb
    .from("clients")
    .insert({ ...input, fa_user_id: auth.user.id })
    .select()
    .single();
  if (error) throw new Error(`createClient: ${error.message}`);
  return data as Client;
}

export async function updateClient(
  id: string,
  patch: ClientUpdate,
): Promise<Client> {
  const sb = createSupabase();
  const { data, error } = await sb
    .from("clients")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateClient: ${error.message}`);
  return data as Client;
}

export async function deleteClient(id: string): Promise<void> {
  const sb = createSupabase();
  const { error } = await sb.from("clients").delete().eq("id", id);
  if (error) throw new Error(`deleteClient: ${error.message}`);
}

export async function archiveClient(id: string): Promise<Client> {
  return updateClient(id, { status: "archived" });
}

export async function unarchiveClient(id: string): Promise<Client> {
  return updateClient(id, { status: "active" });
}
