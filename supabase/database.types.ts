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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      agent_suggestions: {
        Row: {
          applied_at: string | null
          base_version: number
          changes: Json
          confirmed_by: string | null
          created_at: string
          decided_at: string | null
          expires_at: string
          id: string
          intent: string
          reason: string
          requested_by: string | null
          result_version: number | null
          risks: Json
          status: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          base_version: number
          changes: Json
          confirmed_by?: string | null
          created_at?: string
          decided_at?: string | null
          expires_at: string
          id?: string
          intent: string
          reason: string
          requested_by?: string | null
          result_version?: number | null
          risks?: Json
          status?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          base_version?: number
          changes?: Json
          confirmed_by?: string | null
          created_at?: string
          decided_at?: string | null
          expires_at?: string
          id?: string
          intent?: string
          reason?: string
          requested_by?: string | null
          result_version?: number | null
          risks?: Json
          status?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_suggestions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_segments: {
        Row: {
          audience: string
          content: string
          content_version: number
          created_at: string
          id: number
          locale: string
          place_id: string
          review_status: string
          segment_type: string
          sequence: number
          title: string | null
          updated_at: string
        }
        Insert: {
          audience?: string
          content: string
          content_version?: number
          created_at?: string
          id?: never
          locale: string
          place_id: string
          review_status?: string
          segment_type: string
          sequence: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string
          content?: string
          content_version?: number
          created_at?: string
          id?: never
          locale?: string
          place_id?: string
          review_status?: string
          segment_type?: string
          sequence?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_segments_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_library_items: {
        Row: {
          collection_name: string | null
          created_at: string
          custom_name: string | null
          id: string
          labels: string[]
          latitude: number | null
          longitude: number | null
          note: string
          place_id: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          collection_name?: string | null
          created_at?: string
          custom_name?: string | null
          id?: string
          labels?: string[]
          latitude?: number | null
          longitude?: number | null
          note?: string
          place_id?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          collection_name?: string | null
          created_at?: string
          custom_name?: string | null
          id?: string
          labels?: string[]
          latitude?: number | null
          longitude?: number | null
          note?: string
          place_id?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_library_items_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_localizations: {
        Row: {
          aliases: string[]
          content_version: number
          created_at: string
          highlights: string[]
          history: string
          locale: string
          name: string
          photo_spot_notes: string
          place_id: string
          practical_notes: string
          review_status: string
          reviewed_at: string | null
          short_intro: string
          tags: string[]
          updated_at: string
          visitor_tips: string
        }
        Insert: {
          aliases?: string[]
          content_version?: number
          created_at?: string
          highlights?: string[]
          history: string
          locale: string
          name: string
          photo_spot_notes: string
          place_id: string
          practical_notes: string
          review_status?: string
          reviewed_at?: string | null
          short_intro: string
          tags?: string[]
          updated_at?: string
          visitor_tips: string
        }
        Update: {
          aliases?: string[]
          content_version?: number
          created_at?: string
          highlights?: string[]
          history?: string
          locale?: string
          name?: string
          photo_spot_notes?: string
          place_id?: string
          practical_notes?: string
          review_status?: string
          reviewed_at?: string | null
          short_intro?: string
          tags?: string[]
          updated_at?: string
          visitor_tips?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_localizations_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_media: {
        Row: {
          alt_text: string | null
          created_at: string
          credit: string | null
          id: string
          license: string | null
          locale: string | null
          media_type: string
          place_id: string
          sort_order: number
          status: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          credit?: string | null
          id?: string
          license?: string | null
          locale?: string | null
          media_type: string
          place_id: string
          sort_order?: number
          status?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          credit?: string | null
          id?: string
          license?: string | null
          locale?: string | null
          media_type?: string
          place_id?: string
          sort_order?: number
          status?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_media_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_search_documents: {
        Row: {
          content: string
          content_version: number
          created_at: string
          embedding: string | null
          embedding_model: string | null
          id: number
          locale: string
          place_id: string
          section: string
          source_ids: number[]
          status: string
          updated_at: string
        }
        Insert: {
          content: string
          content_version?: number
          created_at?: string
          embedding?: string | null
          embedding_model?: string | null
          id?: never
          locale: string
          place_id: string
          section: string
          source_ids?: number[]
          status?: string
          updated_at?: string
        }
        Update: {
          content?: string
          content_version?: number
          created_at?: string
          embedding?: string | null
          embedding_model?: string | null
          id?: never
          locale?: string
          place_id?: string
          section?: string
          source_ids?: number[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_search_documents_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_sources: {
        Row: {
          checked_at: string | null
          created_at: string
          fact_scope: string[]
          id: number
          place_id: string
          published_at: string | null
          review_due_at: string | null
          source_name: string
          source_type: string
          source_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          checked_at?: string | null
          created_at?: string
          fact_scope?: string[]
          id?: never
          place_id: string
          published_at?: string | null
          review_due_at?: string | null
          source_name: string
          source_type: string
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          checked_at?: string | null
          created_at?: string
          fact_scope?: string[]
          id?: never
          place_id?: string
          published_at?: string | null
          review_due_at?: string | null
          source_name?: string
          source_type?: string
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_sources_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_visit_information: {
        Row: {
          address: string
          booking_required: boolean | null
          booking_url: string | null
          checked_at: string | null
          created_at: string
          entrance_notes: string
          locale: string
          opening_hours: Json
          opening_hours_text: string
          place_id: string
          reservation_notes: string
          review_due_at: string | null
          status: string
          ticket_notes: string
          updated_at: string
        }
        Insert: {
          address: string
          booking_required?: boolean | null
          booking_url?: string | null
          checked_at?: string | null
          created_at?: string
          entrance_notes?: string
          locale: string
          opening_hours?: Json
          opening_hours_text: string
          place_id: string
          reservation_notes?: string
          review_due_at?: string | null
          status?: string
          ticket_notes?: string
          updated_at?: string
        }
        Update: {
          address?: string
          booking_required?: boolean | null
          booking_url?: string | null
          checked_at?: string | null
          created_at?: string
          entrance_notes?: string
          locale?: string
          opening_hours?: Json
          opening_hours_text?: string
          place_id?: string
          reservation_notes?: string
          review_due_at?: string | null
          status?: string
          ticket_notes?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_visit_information_place_id_locale_fkey"
            columns: ["place_id", "locale"]
            isOneToOne: true
            referencedRelation: "place_localizations"
            referencedColumns: ["place_id", "locale"]
          },
        ]
      }
      place_visit_information_sources: {
        Row: {
          created_at: string
          locale: string
          place_id: string
          source_id: number
        }
        Insert: {
          created_at?: string
          locale: string
          place_id: string
          source_id: number
        }
        Update: {
          created_at?: string
          locale?: string
          place_id?: string
          source_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "place_visit_information_sources_place_id_locale_fkey"
            columns: ["place_id", "locale"]
            isOneToOne: false
            referencedRelation: "place_visit_information"
            referencedColumns: ["place_id", "locale"]
          },
          {
            foreignKeyName: "place_visit_information_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "place_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          category_code: string
          coordinate_system: string | null
          coordinates_checked_at: string | null
          created_at: string
          external_ids: Json
          id: string
          latitude: number | null
          longitude: number | null
          recommended_duration_minutes: number
          status: string
          updated_at: string
        }
        Insert: {
          category_code: string
          coordinate_system?: string | null
          coordinates_checked_at?: string | null
          created_at?: string
          external_ids?: Json
          id: string
          latitude?: number | null
          longitude?: number | null
          recommended_duration_minutes: number
          status?: string
          updated_at?: string
        }
        Update: {
          category_code?: string
          coordinate_system?: string | null
          coordinates_checked_at?: string | null
          created_at?: string
          external_ids?: Json
          id?: string
          latitude?: number | null
          longitude?: number | null
          recommended_duration_minutes?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          attachment_path: string | null
          category: string
          confirmation_code: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          notes: string
          place_id: string | null
          provider: string | null
          starts_at: string | null
          status: string
          title: string
          trip_day_id: number | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          attachment_path?: string | null
          category: string
          confirmation_code?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          notes?: string
          place_id?: string | null
          provider?: string | null
          starts_at?: string | null
          status?: string
          title: string
          trip_day_id?: number | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          attachment_path?: string | null
          category?: string
          confirmation_code?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          notes?: string
          place_id?: string | null
          provider?: string | null
          starts_at?: string | null
          status?: string
          title?: string
          trip_day_id?: number | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_trip_day_id_trip_id_fkey"
            columns: ["trip_day_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trip_days"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "reservations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_change_log: {
        Row: {
          actor_user_id: string | null
          change_type: string
          command_id: string
          created_at: string
          id: number
          summary: Json
          trip_id: string
          version: number
        }
        Insert: {
          actor_user_id?: string | null
          change_type: string
          command_id: string
          created_at?: string
          id?: never
          summary?: Json
          trip_id: string
          version: number
        }
        Update: {
          actor_user_id?: string | null
          change_type?: string
          command_id?: string
          created_at?: string
          id?: never
          summary?: Json
          trip_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "trip_change_log_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_days: {
        Row: {
          created_at: string
          day_date: string | null
          day_number: number
          id: number
          notes: string
          title: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_date?: string | null
          day_number: number
          id?: never
          notes?: string
          title?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_date?: string | null
          day_number?: number
          id?: never
          notes?: string
          title?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_invitations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invited_by: string
          max_uses: number
          revoked_at: string | null
          role: string
          token_hash: string
          trip_id: string
          use_count: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          invited_by: string
          max_uses?: number
          revoked_at?: string | null
          role: string
          token_hash: string
          trip_id: string
          use_count?: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string
          max_uses?: number
          revoked_at?: string | null
          role?: string
          token_hash?: string
          trip_id?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "trip_invitations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_location_sharing_preferences: {
        Row: {
          enabled: boolean
          enabled_at: string | null
          expires_at: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          enabled?: boolean
          enabled_at?: string | null
          expires_at: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          enabled_at?: string | null
          expires_at?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_location_sharing_preferences_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_member_locations: {
        Row: {
          expires_at: string
          latitude: number
          longitude: number
          sharing_enabled: boolean
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          expires_at: string
          latitude: number
          longitude: number
          sharing_enabled?: boolean
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string
          latitude?: number
          longitude?: number
          sharing_enabled?: boolean
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_member_locations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          created_at: string
          invited_by: string | null
          joined_at: string | null
          role: string
          status: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          joined_at?: string | null
          role: string
          status?: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: string
          status?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_stops: {
        Row: {
          category_code: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          id: string
          notes: string
          place_id: string | null
          snapshot_latitude: number | null
          snapshot_longitude: number | null
          snapshot_name: string
          sort_order: number
          source: string
          start_time: string | null
          transport_mode: string | null
          trip_day_id: number | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          category_code?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string
          place_id?: string | null
          snapshot_latitude?: number | null
          snapshot_longitude?: number | null
          snapshot_name: string
          sort_order?: number
          source?: string
          start_time?: string | null
          transport_mode?: string | null
          trip_day_id?: number | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          category_code?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string
          place_id?: string | null
          snapshot_latitude?: number | null
          snapshot_longitude?: number | null
          snapshot_name?: string
          sort_order?: number
          source?: string
          start_time?: string | null
          transport_mode?: string | null
          trip_day_id?: number | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_stops_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_stops_trip_day_id_trip_id_fkey"
            columns: ["trip_day_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trip_days"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "trip_stops_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          destination_code: string
          end_date: string | null
          id: string
          locale: string
          name: string
          owner_id: string
          preferences: Json
          start_date: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          destination_code?: string
          end_date?: string | null
          id?: string
          locale?: string
          name: string
          owner_id: string
          preferences?: Json
          start_date?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          destination_code?: string
          end_date?: string | null
          id?: string
          locale?: string
          name?: string
          owner_id?: string
          preferences?: Json
          start_date?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          content_locale: string
          country_code: string | null
          created_at: string
          display_name: string | null
          interface_locale: string
          travel_preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          content_locale?: string
          country_code?: string | null
          created_at?: string
          display_name?: string | null
          interface_locale?: string
          travel_preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          content_locale?: string
          country_code?: string | null
          created_at?: string
          display_name?: string | null
          interface_locale?: string
          travel_preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_mvp_trip_day: {
        Args: {
          p_actor_id: string
          p_command_id: string
          p_day_date?: string
          p_expected_version: number
          p_title?: string
          p_trip_id: string
        }
        Returns: Json
      }
      apply_mvp_trip_changes: {
        Args: {
          p_actor_id: string
          p_change_type?: string
          p_changes: Json
          p_command_id: string
          p_expected_version: number
          p_trip_id: string
        }
        Returns: Json
      }
      apply_mvp_reservation_command: {
        Args: {
          p_actor_id: string
          p_command_id: string
          p_expected_version: number
          p_input?: Json
          p_operation: string
          p_reservation_id?: string
          p_trip_id: string
        }
        Returns: Json
      }
      confirm_mvp_agent_suggestion: {
        Args: {
          p_actor_id: string
          p_command_id: string
          p_expected_version: number
          p_suggestion_id: string
          p_trip_id: string
        }
        Returns: Json
      }
      create_mvp_trip: {
        Args: {
          p_actor_id: string
          p_command_id: string
          p_locale?: string
          p_name: string
          p_start_date?: string
        }
        Returns: Json
      }
      create_mvp_trip_invitation: {
        Args: {
          p_actor_id: string
          p_command_id: string
          p_expires_in_hours: number
          p_role: string
          p_token_hash: string
          p_trip_id: string
        }
        Returns: Json
      }
      preview_mvp_trip_invitation: {
        Args: {
          p_actor_id: string
          p_token_hash: string
        }
        Returns: Json
      }
      accept_mvp_trip_invitation: {
        Args: {
          p_actor_id: string
          p_command_id: string
          p_token_hash: string
        }
        Returns: Json
      }
      revoke_mvp_trip_invitation: {
        Args: {
          p_actor_id: string
          p_command_id: string
          p_invitation_id: string
          p_trip_id: string
        }
        Returns: Json
      }
      remove_mvp_trip_member: {
        Args: {
          p_actor_id: string
          p_command_id: string
          p_member_user_id: string
          p_trip_id: string
        }
        Returns: Json
      }
      set_mvp_location_sharing: {
        Args: {
          p_actor_id: string
          p_enabled: boolean
          p_trip_id: string
        }
        Returns: Json
      }
      upsert_mvp_current_location: {
        Args: {
          p_actor_id: string
          p_latitude: number
          p_longitude: number
          p_trip_id: string
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
    Enums: {},
  },
} as const
