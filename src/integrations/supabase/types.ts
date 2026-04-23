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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      credit_note_items: {
        Row: {
          created_at: string
          credit_note_id: string
          id: string
          iva_amount: number
          iva_rate: number
          line_total: number
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          credit_note_id: string
          id?: string
          iva_amount?: number
          iva_rate?: number
          line_total?: number
          product_name: string
          quantity?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          credit_note_id?: string
          id?: string
          iva_amount?: number
          iva_rate?: number
          line_total?: number
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          created_at: string
          created_by: string | null
          credit_note_number: string
          farmer_code: string
          farmer_name: string
          id: string
          iva_total: number
          original_sale_id: string | null
          reason: string
          status: string
          subtotal: number
          supplier_id: string
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_note_number: string
          farmer_code: string
          farmer_name: string
          id?: string
          iva_total?: number
          original_sale_id?: string | null
          reason: string
          status?: string
          subtotal?: number
          supplier_id: string
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_note_number?: string
          farmer_code?: string
          farmer_name?: string
          id?: string
          iva_total?: number
          original_sale_id?: string | null
          reason?: string
          status?: string
          subtotal?: number
          supplier_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_original_sale_id_fkey"
            columns: ["original_sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
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
      farmer_documents: {
        Row: {
          created_at: string
          farmer_code: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          farmer_code: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          farmer_code?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farmer_documents_farmer_code_fkey"
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
      invoice_sequences: {
        Row: {
          created_at: string
          id: string
          last_number: number
          supplier_id: string | null
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_number?: number
          supplier_id?: string | null
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          last_number?: number
          supplier_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
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
      module_permissions: {
        Row: {
          has_access: boolean
          id: string
          module_name: string
          role: string
          updated_at: string
        }
        Insert: {
          has_access?: boolean
          id?: string
          module_name: string
          role: string
          updated_at?: string
        }
        Update: {
          has_access?: boolean
          id?: string
          module_name?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
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
      orphan_phones: {
        Row: {
          amount: number
          created_at: string
          id: string
          linked_at: string | null
          linked_by: string | null
          linked_farmer_code: string | null
          notes: string | null
          phone: string
          source_files: string[] | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          linked_at?: string | null
          linked_by?: string | null
          linked_farmer_code?: string | null
          notes?: string | null
          phone: string
          source_files?: string[] | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          linked_at?: string | null
          linked_by?: string | null
          linked_farmer_code?: string | null
          notes?: string | null
          phone?: string
          source_files?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      patec_items: {
        Row: {
          base_quantity: number | null
          category: string
          created_at: string
          id: string
          name: string
          patec_number: number
          unit: string | null
        }
        Insert: {
          base_quantity?: number | null
          category: string
          created_at?: string
          id?: string
          name: string
          patec_number: number
          unit?: string | null
        }
        Update: {
          base_quantity?: number | null
          category?: string
          created_at?: string
          id?: string
          name?: string
          patec_number?: number
          unit?: string | null
        }
        Relationships: []
      }
      pos_sale_items: {
        Row: {
          created_at: string
          id: string
          iva_amount: number
          iva_rate: number
          line_total: number
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          iva_amount?: number
          iva_rate?: number
          line_total?: number
          product_id: string
          product_name: string
          quantity?: number
          sale_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          iva_amount?: number
          iva_rate?: number
          line_total?: number
          product_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sales: {
        Row: {
          created_at: string
          created_by: string | null
          farmer_code: string
          farmer_name: string
          farmer_phone: string | null
          id: string
          invoice_number: string | null
          iva_total: number
          notes: string | null
          parcel_size: number | null
          parcel_size_label: string | null
          patec_number: number | null
          payment_method: string
          payment_reference: string | null
          payment_status: string
          pos_id: string | null
          sale_code: string
          season: string | null
          subtotal: number
          supplier_id: string
          total: number
          unitel_transaction_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          farmer_code: string
          farmer_name: string
          farmer_phone?: string | null
          id?: string
          invoice_number?: string | null
          iva_total?: number
          notes?: string | null
          parcel_size?: number | null
          parcel_size_label?: string | null
          patec_number?: number | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          pos_id?: string | null
          sale_code: string
          season?: string | null
          subtotal?: number
          supplier_id: string
          total?: number
          unitel_transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          farmer_code?: string
          farmer_name?: string
          farmer_phone?: string | null
          id?: string
          invoice_number?: string | null
          iva_total?: number
          notes?: string | null
          parcel_size?: number | null
          parcel_size_label?: string | null
          patec_number?: number | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          pos_id?: string | null
          sale_code?: string
          season?: string | null
          subtotal?: number
          supplier_id?: string
          total?: number
          unitel_transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sales_pos_id_fkey"
            columns: ["pos_id"]
            isOneToOne: false
            referencedRelation: "supplier_pos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
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
      season_limits: {
        Row: {
          active: boolean
          created_at: string
          end_date: string
          id: string
          max_items: number | null
          max_total_value: number | null
          patec_number: number
          product_category: string
          season_name: string
          start_date: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_date: string
          id?: string
          max_items?: number | null
          max_total_value?: number | null
          patec_number: number
          product_category?: string
          season_name: string
          start_date: string
        }
        Update: {
          active?: boolean
          created_at?: string
          end_date?: string
          id?: string
          max_items?: number | null
          max_total_value?: number | null
          patec_number?: number
          product_category?: string
          season_name?: string
          start_date?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          new_stock: number
          previous_stock: number
          product_id: string
          quantity: number
          reason: string | null
          reference_id: string | null
          supplier_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          new_stock?: number
          previous_stock?: number
          product_id: string
          quantity: number
          reason?: string | null
          reference_id?: string | null
          supplier_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          new_stock?: number
          previous_stock?: number
          product_id?: string
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_pos: {
        Row: {
          created_at: string
          id: string
          label: string | null
          location: string | null
          operator_name: string | null
          operator_phone: string | null
          pos_code: string
          status: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          location?: string | null
          operator_name?: string | null
          operator_phone?: string | null
          pos_code: string
          status?: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          location?: string | null
          operator_name?: string | null
          operator_phone?: string | null
          pos_code?: string
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_pos_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          iva_rate: number
          max_per_farmer_per_season: number | null
          min_stock: number
          name: string
          patec_category: string | null
          patec_number: number | null
          price: number
          status: string
          stock: number
          supplier_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          iva_rate?: number
          max_per_farmer_per_season?: number | null
          min_stock?: number
          name: string
          patec_category?: string | null
          patec_number?: number | null
          price?: number
          status?: string
          stock?: number
          supplier_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          iva_rate?: number
          max_per_farmer_per_season?: number | null
          min_stock?: number
          name?: string
          patec_category?: string | null
          patec_number?: number | null
          price?: number
          status?: string
          stock?: number
          supplier_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_provinces: {
        Row: {
          created_at: string
          id: string
          province_id: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          province_id: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          id?: string
          province_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_provinces_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_provinces_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_stores: {
        Row: {
          address: string | null
          created_at: string
          id: string
          manager_name: string | null
          manager_phone: string | null
          municipality: string | null
          name: string
          phone: string | null
          province: string | null
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          manager_name?: string | null
          manager_phone?: string | null
          municipality?: string | null
          name: string
          phone?: string | null
          province?: string | null
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          manager_name?: string | null
          manager_phone?: string | null
          municipality?: string | null
          name?: string
          phone?: string | null
          province?: string | null
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_stores_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          municipality: string | null
          name: string
          nif: string | null
          phone: string | null
          province: string | null
          shortcode: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          municipality?: string | null
          name: string
          nif?: string | null
          phone?: string | null
          province?: string | null
          shortcode?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          municipality?: string | null
          name?: string
          nif?: string | null
          phone?: string | null
          province?: string | null
          shortcode?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
      bulk_insert_orphan_phones: { Args: { _data: Json }; Returns: number }
      dashboard_charts: {
        Args: { p_ecas?: string[]; p_provinces?: string[]; p_scope: string }
        Returns: Json
      }
      dashboard_kpis: {
        Args: {
          p_ecas?: string[]
          p_from?: string
          p_provinces?: string[]
          p_scope: string
          p_to?: string
        }
        Returns: Json
      }
      dashboard_kpis_yoy: {
        Args: {
          p_ecas?: string[]
          p_from?: string
          p_provinces?: string[]
          p_scope: string
          p_to?: string
        }
        Returns: Json
      }
      has_any_backoffice_role: { Args: { _user_id: string }; Returns: boolean }
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
      next_credit_note_number: {
        Args: { _supplier_id: string; _year: number }
        Returns: string
      }
      next_invoice_number: {
        Args: { _supplier_id: string; _year: number }
        Returns: string
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
      parse_ptao_numeric: { Args: { _s: string }; Returns: number }
      recalc_all_farmer_totals: { Args: never; Returns: number }
      recalc_farmer_totals: {
        Args: { _farmer_code: string }
        Returns: undefined
      }
      test_parse_ptao_numeric: {
        Args: never
        Returns: {
          expected: number
          got: number
          input_text: string
          label: string
          ok: boolean
        }[]
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
        | "fornecedor"
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
        "fornecedor",
      ],
    },
  },
} as const
