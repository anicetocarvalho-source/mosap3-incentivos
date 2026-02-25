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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      farmer_dependents: {
        Row: {
          age: number | null
          birth_date: string | null
          created_at: string
          education: string | null
          farmer_code: string
          gender: string | null
          id: string
          name: string
          occupation: string | null
          relationship: string
        }
        Insert: {
          age?: number | null
          birth_date?: string | null
          created_at?: string
          education?: string | null
          farmer_code: string
          gender?: string | null
          id?: string
          name: string
          occupation?: string | null
          relationship: string
        }
        Update: {
          age?: number | null
          birth_date?: string | null
          created_at?: string
          education?: string | null
          farmer_code?: string
          gender?: string | null
          id?: string
          name?: string
          occupation?: string | null
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_dependents_farmer_code_fkey"
            columns: ["farmer_code"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["code"]
          },
        ]
      }
      farmer_incentives: {
        Row: {
          amount: string
          created_at: string
          farmer_code: string
          id: string
          incentive_code: string
          incentive_date: string | null
          method: string | null
          status: string
          type: string
        }
        Insert: {
          amount: string
          created_at?: string
          farmer_code: string
          id?: string
          incentive_code: string
          incentive_date?: string | null
          method?: string | null
          status?: string
          type: string
        }
        Update: {
          amount?: string
          created_at?: string
          farmer_code?: string
          id?: string
          incentive_code?: string
          incentive_date?: string | null
          method?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_incentives_farmer_code_fkey"
            columns: ["farmer_code"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["code"]
          },
        ]
      }
      farmer_parcels: {
        Row: {
          area: string
          created_at: string
          culture: string
          farmer_code: string
          id: string
          lat: string | null
          lon: string | null
          parcel_code: string
          status: string
          updated_at: string
        }
        Insert: {
          area: string
          created_at?: string
          culture: string
          farmer_code: string
          id?: string
          lat?: string | null
          lon?: string | null
          parcel_code: string
          status?: string
          updated_at?: string
        }
        Update: {
          area?: string
          created_at?: string
          culture?: string
          farmer_code?: string
          id?: string
          lat?: string | null
          lon?: string | null
          parcel_code?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_parcels_farmer_code_fkey"
            columns: ["farmer_code"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["code"]
          },
        ]
      }
      farmer_production: {
        Row: {
          actual_yield: string | null
          area: string | null
          created_at: string
          culture: string
          current_phase: string | null
          escola: string | null
          estimated_yield: string | null
          expected_harvest: string | null
          farmer_code: string
          id: string
          planted_date: string | null
          production_code: string
          status: string
          technician: string | null
          updated_at: string
        }
        Insert: {
          actual_yield?: string | null
          area?: string | null
          created_at?: string
          culture: string
          current_phase?: string | null
          escola?: string | null
          estimated_yield?: string | null
          expected_harvest?: string | null
          farmer_code: string
          id?: string
          planted_date?: string | null
          production_code: string
          status?: string
          technician?: string | null
          updated_at?: string
        }
        Update: {
          actual_yield?: string | null
          area?: string | null
          created_at?: string
          culture?: string
          current_phase?: string | null
          escola?: string | null
          estimated_yield?: string | null
          expected_harvest?: string | null
          farmer_code?: string
          id?: string
          planted_date?: string | null
          production_code?: string
          status?: string
          technician?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_production_farmer_code_fkey"
            columns: ["farmer_code"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["code"]
          },
        ]
      }
      farmer_production_phases: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          phase: string
          phase_date: string | null
          photos: string[] | null
          production_id: string
          tech_note: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          phase: string
          phase_date?: string | null
          photos?: string[] | null
          production_id: string
          tech_note?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          phase?: string
          phase_date?: string | null
          photos?: string[] | null
          production_id?: string
          tech_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farmer_production_phases_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "farmer_production"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_transactions: {
        Row: {
          created_at: string
          empresa: string
          farmer_code: string
          id: string
          product: string
          transaction_date: string | null
          valor: string
        }
        Insert: {
          created_at?: string
          empresa: string
          farmer_code: string
          id?: string
          product: string
          transaction_date?: string | null
          valor: string
        }
        Update: {
          created_at?: string
          empresa?: string
          farmer_code?: string
          id?: string
          product?: string
          transaction_date?: string | null
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_transactions_farmer_code_fkey"
            columns: ["farmer_code"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["code"]
          },
        ]
      }
      farmers: {
        Row: {
          bi: string | null
          biometric_index_left_url: string | null
          biometric_index_right_url: string | null
          biometric_thumb_left_url: string | null
          biometric_thumb_right_url: string | null
          birth_date: string | null
          code: string
          created_at: string
          full_name: string
          gender: string | null
          id: string
          municipality: string | null
          patec: number | null
          phone: string | null
          photo_frontal_url: string | null
          photo_profile_left_url: string | null
          photo_profile_right_url: string | null
          province: string | null
          registered_by: string | null
          saldo_final: string | null
          school: string | null
          status: string
          total_gasto: string | null
          updated_at: string
          valor_recebido: string | null
        }
        Insert: {
          bi?: string | null
          biometric_index_left_url?: string | null
          biometric_index_right_url?: string | null
          biometric_thumb_left_url?: string | null
          biometric_thumb_right_url?: string | null
          birth_date?: string | null
          code: string
          created_at?: string
          full_name: string
          gender?: string | null
          id?: string
          municipality?: string | null
          patec?: number | null
          phone?: string | null
          photo_frontal_url?: string | null
          photo_profile_left_url?: string | null
          photo_profile_right_url?: string | null
          province?: string | null
          registered_by?: string | null
          saldo_final?: string | null
          school?: string | null
          status?: string
          total_gasto?: string | null
          updated_at?: string
          valor_recebido?: string | null
        }
        Update: {
          bi?: string | null
          biometric_index_left_url?: string | null
          biometric_index_right_url?: string | null
          biometric_thumb_left_url?: string | null
          biometric_thumb_right_url?: string | null
          birth_date?: string | null
          code?: string
          created_at?: string
          full_name?: string
          gender?: string | null
          id?: string
          municipality?: string | null
          patec?: number | null
          phone?: string | null
          photo_frontal_url?: string | null
          photo_profile_left_url?: string | null
          photo_profile_right_url?: string | null
          province?: string | null
          registered_by?: string | null
          saldo_final?: string | null
          school?: string | null
          status?: string
          total_gasto?: string | null
          updated_at?: string
          valor_recebido?: string | null
        }
        Relationships: []
      }
      livestock: {
        Row: {
          breed: string | null
          created_at: string
          farmer_id: string
          female_count: number
          id: string
          infrastructure_notes: string | null
          male_count: number
          pasture_area: string | null
          quantity: number
          school_id: string | null
          species: string
          updated_at: string
          young_count: number
        }
        Insert: {
          breed?: string | null
          created_at?: string
          farmer_id: string
          female_count?: number
          id?: string
          infrastructure_notes?: string | null
          male_count?: number
          pasture_area?: string | null
          quantity?: number
          school_id?: string | null
          species: string
          updated_at?: string
          young_count?: number
        }
        Update: {
          breed?: string | null
          created_at?: string
          farmer_id?: string
          female_count?: number
          id?: string
          infrastructure_notes?: string | null
          male_count?: number
          pasture_area?: string | null
          quantity?: number
          school_id?: string | null
          species?: string
          updated_at?: string
          young_count?: number
        }
        Relationships: []
      }
      livestock_health: {
        Row: {
          cost: number | null
          created_at: string
          date: string
          description: string
          id: string
          livestock_id: string
          notes: string | null
          quantity_affected: number
          record_type: string
          veterinarian: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          date?: string
          description: string
          id?: string
          livestock_id: string
          notes?: string | null
          quantity_affected?: number
          record_type: string
          veterinarian?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          livestock_id?: string
          notes?: string | null
          quantity_affected?: number
          record_type?: string
          veterinarian?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "livestock_health_livestock_id_fkey"
            columns: ["livestock_id"]
            isOneToOne: false
            referencedRelation: "livestock"
            referencedColumns: ["id"]
          },
        ]
      }
      livestock_production: {
        Row: {
          created_at: string
          id: string
          livestock_id: string
          notes: string | null
          period_end: string
          period_start: string
          product_type: string
          quantity: number
          revenue: number | null
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          livestock_id: string
          notes?: string | null
          period_end: string
          period_start: string
          product_type: string
          quantity: number
          revenue?: number | null
          unit: string
        }
        Update: {
          created_at?: string
          id?: string
          livestock_id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          product_type?: string
          quantity?: number
          revenue?: number | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "livestock_production_livestock_id_fkey"
            columns: ["livestock_id"]
            isOneToOne: false
            referencedRelation: "livestock"
            referencedColumns: ["id"]
          },
        ]
      }
      municipalities: {
        Row: {
          created_at: string
          id: string
          name: string
          province_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          province_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          province_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipalities_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          category: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      patec_items: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          patec_number: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          patec_number: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          patec_number?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provinces: {
        Row: {
          capital: string
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          capital: string
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          capital?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      schools: {
        Row: {
          active_cycles: number
          created_at: string
          id: string
          municipality_id: string
          name: string
          province_id: string
          status: string
          technician: string | null
          technician_phone: string | null
          total_area: string | null
          total_farmers: number
          updated_at: string
          village: string | null
        }
        Insert: {
          active_cycles?: number
          created_at?: string
          id?: string
          municipality_id: string
          name: string
          province_id: string
          status?: string
          technician?: string | null
          technician_phone?: string | null
          total_area?: string | null
          total_farmers?: number
          updated_at?: string
          village?: string | null
        }
        Update: {
          active_cycles?: number
          created_at?: string
          id?: string
          municipality_id?: string
          name?: string
          province_id?: string
          status?: string
          technician?: string | null
          technician_phone?: string | null
          total_area?: string | null
          total_farmers?: number
          updated_at?: string
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schools_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schools_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      user_ecas: {
        Row: {
          created_at: string
          eca_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          eca_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          eca_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_provinces: {
        Row: {
          created_at: string
          id: string
          province: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          province: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          province?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_managing_eca: {
        Args: { _eca: string; _user_id: string }
        Returns: boolean
      }
      is_managing_province: {
        Args: { _province: string; _user_id: string }
        Returns: boolean
      }
      notify_all_users: {
        Args: {
          _body: string
          _category?: string
          _entity_id?: string
          _entity_type?: string
          _title: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "gestor_incentivos"
        | "senior_agricultura"
        | "senior_monitoria"
        | "junior_monitoria"
        | "junior_agricultura"
        | "senior_agronegocio"
        | "junior_agronegocio"
        | "tecnico_extensionista"
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
      app_role: [
        "admin",
        "gestor_incentivos",
        "senior_agricultura",
        "senior_monitoria",
        "junior_monitoria",
        "junior_agricultura",
        "senior_agronegocio",
        "junior_agronegocio",
        "tecnico_extensionista",
      ],
    },
  },
} as const
