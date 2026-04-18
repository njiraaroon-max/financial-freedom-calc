/**
 * Supabase database TypeScript types.
 *
 * Mirrors the schema in supabase/migrations/001_schema.sql.
 * Hand-maintained for now; if the schema grows, regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 *
 * Usage:
 *   import type { Database } from "@/lib/supabase/database.types";
 *   type Client = Database["public"]["Tables"]["clients"]["Row"];
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Domains stored in plan_data JSONB. The DB column is `text` with no
 * enum constraint, so adding a new domain here doesn't require a
 * migration — just register a store in store-sync.ts.
 */
export type PlanDomain =
  | "profile"
  | "cashflow"
  | "retirement"
  | "insurance"
  | "education"
  | "goals"
  | "balance_sheet"
  | "tax"
  | "variables";

export interface Database {
  public: {
    Tables: {
      fa_profiles: {
        Row: {
          user_id: string;
          email: string;
          display_name: string | null;
          license_no: string | null;
          company: string | null;
          phone: string | null;
          avatar_url: string | null;
          role: "fa" | "admin";
          status: "pending" | "approved" | "rejected";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email: string;
          display_name?: string | null;
          license_no?: string | null;
          company?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: "fa" | "admin";
          status?: "pending" | "approved" | "rejected";
        };
        Update: Partial<Database["public"]["Tables"]["fa_profiles"]["Insert"]>;
        Relationships: [];
      };

      clients: {
        Row: {
          id: string;
          fa_user_id: string;
          name: string;
          nickname: string | null;
          birth_date: string | null;
          gender: string | null;
          phone: string | null;
          email: string | null;
          photo_url: string | null;
          occupation: string | null;
          marital_status: string | null;
          salary: number | null;
          num_children: number;
          status: "active" | "archived";
          last_reviewed_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fa_user_id: string;
          name: string;
          nickname?: string | null;
          birth_date?: string | null;
          gender?: string | null;
          phone?: string | null;
          email?: string | null;
          photo_url?: string | null;
          occupation?: string | null;
          marital_status?: string | null;
          salary?: number | null;
          num_children?: number;
          status?: "active" | "archived";
          last_reviewed_at?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };

      cashflow_items: {
        Row: {
          id: string;
          client_id: string;
          kind: "income" | "expense";
          name: string;
          amounts: number[];
          tax_category: string | null;
          salary_percent: number | null;
          expense_category: "fixed" | "variable" | "investment" | null;
          is_essential: boolean;
          is_debt_repayment: "debt" | "non_debt" | null;
          is_recurring: boolean;
          start_month: number | null;
          end_month: number | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          kind: "income" | "expense";
          name: string;
          amounts?: number[];
          tax_category?: string | null;
          salary_percent?: number | null;
          expense_category?: "fixed" | "variable" | "investment" | null;
          is_essential?: boolean;
          is_debt_repayment?: "debt" | "non_debt" | null;
          is_recurring?: boolean;
          start_month?: number | null;
          end_month?: number | null;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["cashflow_items"]["Insert"]>;
        Relationships: [];
      };

      plan_data: {
        Row: {
          client_id: string;
          domain: PlanDomain;
          data: Json;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          domain: PlanDomain;
          data?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["plan_data"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

// Convenience aliases
export type FaProfile = Database["public"]["Tables"]["fa_profiles"]["Row"];
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type ClientInsert =
  Database["public"]["Tables"]["clients"]["Insert"];
export type ClientUpdate =
  Database["public"]["Tables"]["clients"]["Update"];
export type CashflowItemRow =
  Database["public"]["Tables"]["cashflow_items"]["Row"];
export type CashflowItemInsert =
  Database["public"]["Tables"]["cashflow_items"]["Insert"];
export type PlanDataRow =
  Database["public"]["Tables"]["plan_data"]["Row"];
