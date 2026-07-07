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
      addresses: {
        Row: {
          address_line: string
          city: string
          created_at: string
          id: string
          is_default: boolean | null
          label: string
          latitude: number | null
          longitude: number | null
          user_id: string
        }
        Insert: {
          address_line: string
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string
          latitude?: number | null
          longitude?: number | null
          user_id: string
        }
        Update: {
          address_line?: string
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string
          latitude?: number | null
          longitude?: number | null
          user_id?: string
        }
        Relationships: []
      }
      favorite_restaurants: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          name: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          name: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          name?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string | null
          created_at: string
          deal_label: string | null
          description: string | null
          discount_price: number | null
          id: string
          image_url: string | null
          is_available: boolean | null
          is_deal: boolean
          is_featured: boolean | null
          name: string
          price: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          deal_label?: string | null
          description?: string | null
          discount_price?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_deal?: boolean
          is_featured?: boolean | null
          name: string
          price: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          deal_label?: string | null
          description?: string | null
          discount_price?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_deal?: boolean
          is_featured?: boolean | null
          name?: string
          price?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          event_awaiting_confirmation: boolean
          event_cancelled: boolean
          event_confirmed: boolean
          event_delivered: boolean
          event_on_the_way: boolean
          event_order_placed: boolean
          event_picked_up: boolean
          event_preparing: boolean
          event_ready_for_pickup: boolean
          push_enabled: boolean
          sound_enabled: boolean
          toast_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_awaiting_confirmation?: boolean
          event_cancelled?: boolean
          event_confirmed?: boolean
          event_delivered?: boolean
          event_on_the_way?: boolean
          event_order_placed?: boolean
          event_picked_up?: boolean
          event_preparing?: boolean
          event_ready_for_pickup?: boolean
          push_enabled?: boolean
          sound_enabled?: boolean
          toast_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_awaiting_confirmation?: boolean
          event_cancelled?: boolean
          event_confirmed?: boolean
          event_delivered?: boolean
          event_on_the_way?: boolean
          event_order_placed?: boolean
          event_picked_up?: boolean
          event_preparing?: boolean
          event_ready_for_pickup?: boolean
          push_enabled?: boolean
          sound_enabled?: boolean
          toast_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          item_name: string
          item_price: number
          menu_item_id: string | null
          order_id: string
          quantity: number
          special_instructions: string | null
          subtotal: number
        }
        Insert: {
          id?: string
          item_name: string
          item_price: number
          menu_item_id?: string | null
          order_id: string
          quantity?: number
          special_instructions?: string | null
          subtotal: number
        }
        Update: {
          id?: string
          item_name?: string
          item_price?: number
          menu_item_id?: string | null
          order_id?: string
          quantity?: number
          special_instructions?: string | null
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          actual_delivery_time: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_id: string
          delivery_address: string
          delivery_fee: number | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          estimated_delivery_time: string | null
          id: string
          order_number: string
          restaurant_id: string | null
          rider_id: string | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          actual_delivery_time?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id: string
          delivery_address: string
          delivery_fee?: number | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          estimated_delivery_time?: string | null
          id?: string
          order_number?: string
          restaurant_id?: string | null
          rider_id?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          actual_delivery_time?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id?: string
          delivery_address?: string
          delivery_fee?: number | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          estimated_delivery_time?: string | null
          id?: string
          order_number?: string
          restaurant_id?: string | null
          rider_id?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          gateway_response: Json | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          status: Database["public"]["Enums"]["payment_status"] | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          gateway_response?: Json | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          gateway_response?: Json | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          base_distance_km: number
          base_fare: number
          closing_time: string
          cod_enabled: boolean
          created_at: string
          easypaisa_enabled: boolean
          id: string
          jazzcash_enabled: boolean
          max_delivery_radius_km: number
          notifications_push_enabled: boolean
          notifications_sound_enabled: boolean
          notifications_toast_enabled: boolean
          opening_time: string
          operating_city: string
          per_km_rate: number
          platform_name: string
          rider_tier1_amount: number
          rider_tier1_max_km: number
          rider_tier2_amount: number
          singleton: boolean
          stripe_enabled: boolean
          support_email: string | null
          support_phone: string | null
          updated_at: string
        }
        Insert: {
          base_distance_km?: number
          base_fare?: number
          closing_time?: string
          cod_enabled?: boolean
          created_at?: string
          easypaisa_enabled?: boolean
          id?: string
          jazzcash_enabled?: boolean
          max_delivery_radius_km?: number
          notifications_push_enabled?: boolean
          notifications_sound_enabled?: boolean
          notifications_toast_enabled?: boolean
          opening_time?: string
          operating_city?: string
          per_km_rate?: number
          platform_name?: string
          rider_tier1_amount?: number
          rider_tier1_max_km?: number
          rider_tier2_amount?: number
          singleton?: boolean
          stripe_enabled?: boolean
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
        }
        Update: {
          base_distance_km?: number
          base_fare?: number
          closing_time?: string
          cod_enabled?: boolean
          created_at?: string
          easypaisa_enabled?: boolean
          id?: string
          jazzcash_enabled?: boolean
          max_delivery_radius_km?: number
          notifications_push_enabled?: boolean
          notifications_sound_enabled?: boolean
          notifications_toast_enabled?: boolean
          opening_time?: string
          operating_city?: string
          per_km_rate?: number
          platform_name?: string
          rider_tier1_amount?: number
          rider_tier1_max_km?: number
          rider_tier2_amount?: number
          singleton?: boolean
          stripe_enabled?: boolean
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_at: string | null
          banned_reason: string | null
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_banned: boolean
          permanent_address: string | null
          permanent_latitude: number | null
          permanent_longitude: number | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_banned?: boolean
          permanent_address?: string | null
          permanent_latitude?: number | null
          permanent_longitude?: number | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_banned?: boolean
          permanent_address?: string | null
          permanent_latitude?: number | null
          permanent_longitude?: number | null
          phone?: string | null
          updated_at?: string
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
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          customer_id: string
          food_rating: number | null
          id: string
          order_id: string
          restaurant_id: string | null
          restaurant_rating: number | null
          review_text: string | null
          rider_id: string | null
          rider_rating: number | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          food_rating?: number | null
          id?: string
          order_id: string
          restaurant_id?: string | null
          restaurant_rating?: number | null
          review_text?: string | null
          rider_id?: string | null
          rider_rating?: number | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          food_rating?: number | null
          id?: string
          order_id?: string
          restaurant_id?: string | null
          restaurant_rating?: number | null
          review_text?: string | null
          rider_id?: string | null
          rider_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_location_change_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          reason: string | null
          requested_address: string
          requested_by: string
          requested_latitude: number | null
          requested_longitude: number | null
          restaurant_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          requested_address: string
          requested_by: string
          requested_latitude?: number | null
          requested_longitude?: number | null
          restaurant_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          requested_address?: string
          requested_by?: string
          requested_latitude?: number | null
          requested_longitude?: number | null
          restaurant_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_location_change_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          approval_status: string
          city: string | null
          closing_time: string | null
          created_at: string
          cuisine_type: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          opening_time: string | null
          owner_id: string | null
          rejection_reason: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          approval_status?: string
          city?: string | null
          closing_time?: string | null
          created_at?: string
          cuisine_type?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          opening_time?: string | null
          owner_id?: string | null
          rejection_reason?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          approval_status?: string
          city?: string | null
          closing_time?: string | null
          created_at?: string
          cuisine_type?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          opening_time?: string | null
          owner_id?: string | null
          rejection_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rider_earnings: {
        Row: {
          amount: number
          bonus_amount: number | null
          created_at: string
          description: string | null
          distance_km: number | null
          id: string
          order_id: string | null
          rider_id: string
        }
        Insert: {
          amount: number
          bonus_amount?: number | null
          created_at?: string
          description?: string | null
          distance_km?: number | null
          id?: string
          order_id?: string | null
          rider_id: string
        }
        Update: {
          amount?: number
          bonus_amount?: number | null
          created_at?: string
          description?: string | null
          distance_km?: number | null
          id?: string
          order_id?: string | null
          rider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_earnings_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_wallets: {
        Row: {
          account_number: string | null
          account_title: string | null
          balance: number | null
          bank_name: string | null
          bonus_points: number | null
          created_at: string
          easypaisa_number: string | null
          id: string
          jazzcash_number: string | null
          rider_id: string
          total_earned: number | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_title?: string | null
          balance?: number | null
          bank_name?: string | null
          bonus_points?: number | null
          created_at?: string
          easypaisa_number?: string | null
          id?: string
          jazzcash_number?: string | null
          rider_id: string
          total_earned?: number | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_title?: string | null
          balance?: number | null
          bank_name?: string | null
          bonus_points?: number | null
          created_at?: string
          easypaisa_number?: string | null
          id?: string
          jazzcash_number?: string | null
          rider_id?: string
          total_earned?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_wallets_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: true
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_withdrawals: {
        Row: {
          account_details: string | null
          amount: number
          created_at: string
          id: string
          method: string
          processed_at: string | null
          rider_id: string
          status: string | null
        }
        Insert: {
          account_details?: string | null
          amount: number
          created_at?: string
          id?: string
          method: string
          processed_at?: string | null
          rider_id: string
          status?: string | null
        }
        Update: {
          account_details?: string | null
          amount?: number
          created_at?: string
          id?: string
          method?: string
          processed_at?: string | null
          rider_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rider_withdrawals_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      riders: {
        Row: {
          address: string | null
          average_rating: number | null
          cnic: string | null
          cnic_image_url: string | null
          created_at: string
          current_latitude: number | null
          current_longitude: number | null
          id: string
          is_online: boolean | null
          is_verified: boolean | null
          license_image_url: string | null
          license_number: string | null
          total_deliveries: number | null
          updated_at: string
          user_id: string
          vehicle_doc_url: string | null
          vehicle_number: string | null
          vehicle_type: string | null
        }
        Insert: {
          address?: string | null
          average_rating?: number | null
          cnic?: string | null
          cnic_image_url?: string | null
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          id?: string
          is_online?: boolean | null
          is_verified?: boolean | null
          license_image_url?: string | null
          license_number?: string | null
          total_deliveries?: number | null
          updated_at?: string
          user_id: string
          vehicle_doc_url?: string | null
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Update: {
          address?: string | null
          average_rating?: number | null
          cnic?: string | null
          cnic_image_url?: string | null
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          id?: string
          is_online?: boolean | null
          is_verified?: boolean | null
          license_image_url?: string | null
          license_number?: string | null
          total_deliveries?: number | null
          updated_at?: string
          user_id?: string
          vehicle_doc_url?: string | null
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      admin_set_user_ban: {
        Args: { _banned: boolean; _reason?: string; _user_id: string }
        Returns: boolean
      }
      admin_set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      apply_restaurant_location_change: {
        Args: { _approve: boolean; _notes?: string; _request_id: string }
        Returns: boolean
      }
      approve_restaurant: {
        Args: { _approve: boolean; _reason?: string; _restaurant_id: string }
        Returns: boolean
      }
      cancel_order: {
        Args: { _order_id: string; _reason: string }
        Returns: boolean
      }
      claim_order: { Args: { _order_id: string }; Returns: boolean }
      confirm_delivery: { Args: { _order_id: string }; Returns: boolean }
      create_system_notification: {
        Args: {
          p_data?: Json
          p_message: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: string
      }
      get_current_rider_city: { Args: never; Returns: string }
      get_customer_ids_for_restaurant_owner: {
        Args: { _owner_id: string }
        Returns: string[]
      }
      get_customer_ids_for_rider: {
        Args: { _rider_user_id: string }
        Returns: string[]
      }
      get_owned_restaurant_id: { Args: { _user_id: string }; Returns: string[] }
      get_rider_id_for_user: { Args: { _user_id: string }; Returns: string[] }
      get_rider_ids_for_customer_orders: {
        Args: { _customer_id: string }
        Returns: string[]
      }
      get_rider_ids_for_restaurant_owner: {
        Args: { _owner_id: string }
        Returns: string[]
      }
      get_rider_user_ids_for_customer: {
        Args: { _customer_id: string }
        Returns: string[]
      }
      get_rider_user_ids_for_restaurant_owner: {
        Args: { _owner_id: string }
        Returns: string[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_order_eta: {
        Args: { _new_eta: string; _order_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "rider" | "customer" | "restaurant"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "ready_for_pickup"
        | "picked_up"
        | "on_the_way"
        | "awaiting_confirmation"
        | "delivered"
        | "cancelled"
      payment_method: "easypaisa" | "jazzcash" | "card" | "cod"
      payment_status: "pending" | "completed" | "failed" | "refunded"
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
      app_role: ["admin", "rider", "customer", "restaurant"],
      order_status: [
        "pending",
        "confirmed",
        "preparing",
        "ready_for_pickup",
        "picked_up",
        "on_the_way",
        "awaiting_confirmation",
        "delivered",
        "cancelled",
      ],
      payment_method: ["easypaisa", "jazzcash", "card", "cod"],
      payment_status: ["pending", "completed", "failed", "refunded"],
    },
  },
} as const
