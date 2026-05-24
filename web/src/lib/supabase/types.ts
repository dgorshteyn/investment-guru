/**
 * Hand-written Database types matching supabase/migrations/0001_init.sql.
 * In a later sprint, regenerate from Supabase CLI: `supabase gen types typescript`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Tier = "free" | "paid";
export type TransactionKind =
  | "opening_balance"
  | "buy"
  | "sell"
  | "dividend"
  | "reinvest_dividend"
  | "deposit"
  | "withdraw"
  | "split";
export type TransactionSource = "manual" | "csv" | "rebalance_action";
export type RebalanceTrigger = "threshold" | "calendar" | "both";
export type RebalanceCalendar = "monthly" | "quarterly" | "semiannual" | "annual";
export type BacktestStatus = "pending" | "running" | "done" | "failed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          tier: Tier;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          tier?: Tier;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          tier?: Tier;
          is_admin?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      portfolios: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          cloned_from: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          cloned_from?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          cloned_from?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      target_allocations: {
        Row: {
          id: string;
          portfolio_id: string;
          weights: Json;
          effective_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          portfolio_id: string;
          weights: Json;
          effective_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          portfolio_id?: string;
          weights?: Json;
          effective_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      rebalance_rules: {
        Row: {
          portfolio_id: string;
          trigger_type: RebalanceTrigger;
          drift_pct: number | null;
          calendar: RebalanceCalendar | null;
          use_cash_flow: boolean;
          updated_at: string;
        };
        Insert: {
          portfolio_id: string;
          trigger_type: RebalanceTrigger;
          drift_pct?: number | null;
          calendar?: RebalanceCalendar | null;
          use_cash_flow?: boolean;
          updated_at?: string;
        };
        Update: {
          portfolio_id?: string;
          trigger_type?: RebalanceTrigger;
          drift_pct?: number | null;
          calendar?: RebalanceCalendar | null;
          use_cash_flow?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          portfolio_id: string;
          kind: TransactionKind;
          ticker: string | null;
          shares: number | null;
          price: number | null;
          amount: number | null;
          fees: number;
          trade_date: string;
          notes: string | null;
          source: TransactionSource | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          portfolio_id: string;
          kind: TransactionKind;
          ticker?: string | null;
          shares?: number | null;
          price?: number | null;
          amount?: number | null;
          fees?: number;
          trade_date: string;
          notes?: string | null;
          source?: TransactionSource | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          portfolio_id?: string;
          kind?: TransactionKind;
          ticker?: string | null;
          shares?: number | null;
          price?: number | null;
          amount?: number | null;
          fees?: number;
          trade_date?: string;
          notes?: string | null;
          source?: TransactionSource | null;
          created_at?: string;
        };
        Relationships: [];
      };
      holdings_cache: {
        Row: {
          portfolio_id: string;
          ticker: string;
          shares: number;
          cost_basis_total: number;
        };
        Insert: {
          portfolio_id: string;
          ticker: string;
          shares: number;
          cost_basis_total: number;
        };
        Update: {
          portfolio_id?: string;
          ticker?: string;
          shares?: number;
          cost_basis_total?: number;
        };
        Relationships: [];
      };
      cash_balances: {
        Row: {
          portfolio_id: string;
          balance: number;
        };
        Insert: {
          portfolio_id: string;
          balance?: number;
        };
        Update: {
          portfolio_id?: string;
          balance?: number;
        };
        Relationships: [];
      };
      backtests: {
        Row: {
          id: string;
          portfolio_id: string | null;
          owner_id: string;
          name: string | null;
          config: Json;
          result: Json | null;
          status: BacktestStatus;
          error: string | null;
          share_token: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          portfolio_id?: string | null;
          owner_id: string;
          name?: string | null;
          config: Json;
          result?: Json | null;
          status?: BacktestStatus;
          error?: string | null;
          share_token?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          portfolio_id?: string | null;
          owner_id?: string;
          name?: string | null;
          config?: Json;
          result?: Json | null;
          status?: BacktestStatus;
          error?: string | null;
          share_token?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      starter_portfolios: {
        Row: {
          slug: string;
          name: string;
          description: string;
          attribution: string | null;
          weights: Json;
          default_rebalance: Json;
          created_at: string;
        };
        Insert: {
          slug: string;
          name: string;
          description: string;
          attribution?: string | null;
          weights: Json;
          default_rebalance: Json;
          created_at?: string;
        };
        Update: {
          slug?: string;
          name?: string;
          description?: string;
          attribution?: string | null;
          weights?: Json;
          default_rebalance?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
