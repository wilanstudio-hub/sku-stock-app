export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      billing_events: {
        Row: {
          provider: string
          event_id: string
          event_type: string
          status: string
          company_id: string | null
          received_at: string
          processed_at: string | null
          error_message: string | null
        }
        Insert: {
          provider: string
          event_id: string
          event_type: string
          status?: string
          company_id?: string | null
          received_at?: string
          processed_at?: string | null
          error_message?: string | null
        }
        Update: {
          provider?: string
          event_id?: string
          event_type?: string
          status?: string
          company_id?: string | null
          received_at?: string
          processed_at?: string | null
          error_message?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          id: string
          slug: string
          name: string
          status: string
          contact_name: string | null
          contact_email: string | null
          logo_url: string | null
          subscription_expires_at: string | null
          billing_plan?: string | null
          billing_status?: string | null
          billing_provider?: string | null
          billing_customer_id?: string | null
          billing_subscription_id?: string | null
          billing_expires_at?: string | null
          seat_limit?: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          status?: string
          contact_name?: string | null
          contact_email?: string | null
          logo_url?: string | null
          subscription_expires_at?: string | null
          billing_plan?: string | null
          billing_status?: string | null
          billing_provider?: string | null
          billing_customer_id?: string | null
          billing_subscription_id?: string | null
          billing_expires_at?: string | null
          seat_limit?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          status?: string
          contact_name?: string | null
          contact_email?: string | null
          logo_url?: string | null
          subscription_expires_at?: string | null
          billing_plan?: string | null
          billing_status?: string | null
          billing_provider?: string | null
          billing_customer_id?: string | null
          billing_subscription_id?: string | null
          billing_expires_at?: string | null
          seat_limit?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          company_id: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name_th: string
          order_index: number | null
          sync_format: string | null
        }
        Insert: {
          code: string
          company_id?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_th: string
          order_index?: number | null
          sync_format?: string | null
        }
        Update: {
          code?: string
          company_id?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_th?: string
          order_index?: number | null
          sync_format?: string | null
        }
        Relationships: []
      }
      google_sheets_registry: {
        Row: {
          company_id: string | null
          created_at: string
          department: string
          id: string
          is_active: boolean
          name: string
          sheet_id: string
          sku_prefix: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          department: string
          id?: string
          is_active?: boolean
          name: string
          sheet_id: string
          sku_prefix?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          department?: string
          id?: string
          is_active?: boolean
          name?: string
          sheet_id?: string
          sku_prefix?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          department: string | null
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_reservations: {
        Row: {
          id: string
          company_id: string
          external_project_id: string
          external_project_name: string
          status: "reserved" | "checked_out" | "cancelled" | "returned"
          start_at: string
          end_at: string
          requested_by: string
          idempotency_key: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          external_project_id: string
          external_project_name: string
          status?: "reserved" | "checked_out" | "cancelled" | "returned"
          start_at: string
          end_at: string
          requested_by: string
          idempotency_key: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          external_project_id?: string
          external_project_name?: string
          status?: "reserved" | "checked_out" | "cancelled" | "returned"
          start_at?: string
          end_at?: string
          requested_by?: string
          idempotency_key?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      inventory_reservation_items: {
        Row: {
          id: string
          reservation_id: string
          company_id: string
          sku_id: string | null
          sku_code: string
          quantity: number
          created_at: string
        }
        Insert: {
          id?: string
          reservation_id: string
          company_id: string
          sku_id?: string | null
          sku_code: string
          quantity: number
          created_at?: string
        }
        Update: {
          id?: string
          reservation_id?: string
          company_id?: string
          sku_id?: string | null
          sku_code?: string
          quantity?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservation_items_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "inventory_reservations"
            referencedColumns: ["id"]
          }
        ]
      }
      sku_transactions: {
        Row: {
          action_type: string
          company_id: string | null
          created_at: string
          department: string
          id: string
          person_name: string
          sku_code: string
          sku_id: string | null
        }
        Insert: {
          action_type: string
          company_id?: string | null
          created_at?: string
          department: string
          id?: string
          person_name: string
          sku_code: string
          sku_id?: string | null
        }
        Update: {
          action_type?: string
          company_id?: string | null
          created_at?: string
          department?: string
          id?: string
          person_name?: string
          sku_code?: string
          sku_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sku_transactions_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      skus: {
        Row: {
          availability: string
          category: string | null
          color: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          current_status: string | null
          department: string
          id: string
          image_url: string | null
          image_urls: string[]
          last_handler: string | null
          location: string | null
          min_stock: number
          name_en: string
          name_th: string
          notes_en: string | null
          notes_th: string | null
          quantity: number
          sku_code: string
          special_features: string | null
          style: string | null
          unit: string | null
          updated_at: string
          zone_key: string | null
        }
        Insert: {
          availability?: string
          category?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_status?: string | null
          department: string
          id?: string
          image_url?: string | null
          image_urls?: string[]
          last_handler?: string | null
          location?: string | null
          min_stock?: number
          name_en: string
          name_th: string
          notes_en?: string | null
          notes_th?: string | null
          quantity?: number
          sku_code: string
          special_features?: string | null
          style?: string | null
          unit?: string | null
          updated_at?: string
          zone_key?: string | null
        }
        Update: {
          availability?: string
          category?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_status?: string | null
          department?: string
          id?: string
          image_url?: string | null
          image_urls?: string[]
          last_handler?: string | null
          location?: string | null
          min_stock?: number
          name_en?: string
          name_th?: string
          notes_en?: string | null
          notes_th?: string | null
          quantity?: number
          sku_code?: string
          special_features?: string | null
          style?: string | null
          unit?: string | null
          updated_at?: string
          zone_key?: string | null
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          created_at: string
          deleted: number
          department: string
          errors: string[]
          id: string
          inserted: number
          per_category: Json
          triggered_by: string | null
          updated: number
        }
        Insert: {
          created_at?: string
          deleted?: number
          department: string
          errors?: string[]
          id?: string
          inserted?: number
          per_category?: Json
          triggered_by?: string | null
          updated?: number
        }
        Update: {
          created_at?: string
          deleted?: number
          department?: string
          errors?: string[]
          id?: string
          inserted?: number
          per_category?: Json
          triggered_by?: string | null
          updated?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      viewer_section_access: {
        Row: {
          company_id: string | null
          department: string
          id: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          department: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          department?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "art" | "wd" | "viewer" | "equipment"
      department: "art" | "wd" | "equipment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "art", "wd", "viewer", "equipment"],
      department: ["art", "wd", "equipment"],
    },
  },
} as const
