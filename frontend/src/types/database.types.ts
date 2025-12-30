export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      subscription_plans: {
        Row: {
          id: string
          name: string
          slug: string
          price_monthly: number
          price_yearly: number | null
          features: Json
          limitations: Json
          is_popular: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          price_monthly: number
          price_yearly?: number | null
          features?: Json
          limitations?: Json
          is_popular?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          price_monthly?: number
          price_yearly?: number | null
          features?: Json
          limitations?: Json
          is_popular?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          full_name: string | null
          phone_number: string | null
          country: string | null
          city: string | null
          preferred_language: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          phone_number?: string | null
          country?: string | null
          city?: string | null
          preferred_language?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          phone_number?: string | null
          country?: string | null
          city?: string | null
          preferred_language?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string | null
          plan_id: string | null
          status: string
          payment_method: string | null
          current_period_start: string
          current_period_end: string
          cancel_at_period_end: boolean
          trial_end: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          plan_id?: string | null
          status: string
          payment_method?: string | null
          current_period_start?: string
          current_period_end: string
          cancel_at_period_end?: boolean
          trial_end?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          plan_id?: string | null
          status?: string
          payment_method?: string | null
          current_period_start?: string
          current_period_end?: string
          cancel_at_period_end?: boolean
          trial_end?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      payment_history: {
        Row: {
          id: string
          subscription_id: string | null
          amount: number
          currency: string | null
          status: string
          payment_method: string | null
          transaction_reference: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          subscription_id?: string | null
          amount: number
          currency?: string | null
          status: string
          payment_method?: string | null
          transaction_reference?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          subscription_id?: string | null
          amount?: number
          currency?: string | null
          status?: string
          payment_method?: string | null
          transaction_reference?: string | null
          metadata?: Json
          created_at?: string
        }
      }
      feature_usage: {
        Row: {
          id: string
          user_id: string | null
          feature_name: string
          usage_count: number
          last_used_at: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          feature_name: string
          usage_count?: number
          last_used_at?: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          feature_name?: string
          usage_count?: number
          last_used_at?: string
          metadata?: Json
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_subscription_status: {
        Args: {
          user_uuid: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
