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
  | "variables"
  | "selected_modules";

/** Skin / Home-page layout assigned to an FA (admin-controlled). */
export type Skin = "legacy" | "professional";

/** Per-FA default planning flow — FA can toggle this themselves. */
export type PlanningMode = "modular" | "comprehensive";

/**
 * Per-FA feature flags (JSONB in DB so new flags can ship without
 * migrations). See migration 007 for defaults. Values are optional here
 * because older rows or new flags may be absent — always read with a
 * fallback.
 */
export interface FeatureFlags {
  report_pdf?: boolean;
  export_excel?: boolean;
  ci_shock_simulator?: boolean;
  allianz_deep_data?: boolean;
  multi_insurer_compare?: boolean;
  /** Numeric cap on how many clients this FA can create. 999 = effectively unlimited. */
  client_limit?: number;
  custom_branding?: boolean;
  /**
   * Per-FA planning-mode gates. Admin-controlled.
   * Missing / undefined === true (enabled) so existing FAs aren't
   * silently locked out. Set to `false` to hide + disable that mode
   * on the Professional home — HomePro auto-falls-back to the
   * remaining enabled mode if the FA's current one got turned off.
   */
  mode_modular_enabled?: boolean;
  mode_comprehensive_enabled?: boolean;
  /** Room for future flags without breaking the type. */
  [key: string]: Json | undefined;
}

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          slug: string;
          name: string;
          tagline: string | null;
          logo_url: string | null;
          logo_dark_url: string | null;
          favicon_url: string | null;
          color_primary: string;
          color_primary_dark: string | null;
          color_accent: string | null;
          font_display: string | null;
          font_body: string | null;
          default_skin: Skin;
          nav_config: Json;
          default_features: FeatureFlags;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          tagline?: string | null;
          logo_url?: string | null;
          logo_dark_url?: string | null;
          favicon_url?: string | null;
          color_primary?: string;
          color_primary_dark?: string | null;
          color_accent?: string | null;
          font_display?: string | null;
          font_body?: string | null;
          default_skin?: Skin;
          nav_config?: Json;
          default_features?: FeatureFlags;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: [];
      };

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
          expires_at: string | null;
          organization_id: string;
          skin: Skin;
          planning_mode: PlanningMode;
          features: FeatureFlags;
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
          expires_at?: string | null;
          organization_id?: string;
          skin?: Skin;
          planning_mode?: PlanningMode;
          features?: FeatureFlags;
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
