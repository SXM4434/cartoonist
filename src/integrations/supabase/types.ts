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
      ai_calls: {
        Row: {
          cost_usd: number
          created_at: string
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          room_id: string
          stage: string
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
          room_id: string
          stage?: string
        }
        Update: {
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          room_id?: string
          stage?: string
        }
        Relationships: []
      }
      audio_clips: {
        Row: {
          created_at: string
          duration_ms: number | null
          id: string
          room_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          room_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          room_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_clips_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_events: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          op: Json
          room_id: string
          source: string | null
          t_offset_ms: number
          thread_id: string | null
          transcript_span: Json | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          op: Json
          room_id: string
          source?: string | null
          t_offset_ms?: number
          thread_id?: string | null
          transcript_span?: Json | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          op?: Json
          room_id?: string
          source?: string | null
          t_offset_ms?: number
          thread_id?: string | null
          transcript_span?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "canvas_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_relations: {
        Row: {
          confidence: number
          created_at: string
          from_room_id: string
          from_thread_id: string
          id: string
          reason: string | null
          relation: string
          to_room_id: string
          to_thread_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          from_room_id: string
          from_thread_id: string
          id?: string
          reason?: string | null
          relation?: string
          to_room_id: string
          to_thread_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          from_room_id?: string
          from_thread_id?: string
          id?: string
          reason?: string | null
          relation?: string
          to_room_id?: string
          to_thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canvas_relations_from_room_id_fkey"
            columns: ["from_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_relations_to_room_id_fkey"
            columns: ["to_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_feedback: {
        Row: {
          action_id: string
          created_at: string
          id: string
          original_op: Json
          original_span: Json
          original_thread_id: string
          outcome: string
          participant_id: string
          result_record: Json | null
          room_id: string
          shape_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          id?: string
          original_op: Json
          original_span: Json
          original_thread_id: string
          outcome: string
          participant_id: string
          result_record?: Json | null
          room_id: string
          shape_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          id?: string
          original_op?: Json
          original_span?: Json
          original_thread_id?: string
          outcome?: string
          participant_id?: string
          result_record?: Json | null
          room_id?: string
          shape_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawing_feedback_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_feedback_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agent_events: {
        Row: {
          agent: string
          claim_token: string
          created_at: string
          error: string | null
          event_key: string
          finished_at: string | null
          id: string
          result: Json | null
          room_id: string
          status: string
        }
        Insert: {
          agent: string
          claim_token?: string
          created_at?: string
          error?: string | null
          event_key: string
          finished_at?: string | null
          id?: string
          result?: Json | null
          room_id: string
          status?: string
        }
        Update: {
          agent?: string
          claim_token?: string
          created_at?: string
          error?: string | null
          event_key?: string
          finished_at?: string | null
          id?: string
          result?: Json | null
          room_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agent_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_insights: {
        Row: {
          confidence: number
          created_at: string
          dismissed: boolean
          id: string
          kind: string
          participant_id: string | null
          room_id: string
          source_quote: string
          subject_name: string
          text: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          dismissed?: boolean
          id?: string
          kind?: string
          participant_id?: string | null
          room_id: string
          source_quote: string
          subject_name: string
          text: string
        }
        Update: {
          confidence?: number
          created_at?: string
          dismissed?: boolean
          id?: string
          kind?: string
          participant_id?: string | null
          room_id?: string
          source_quote?: string
          subject_name?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_insights_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          allow_voice_mention: boolean
          blockers: string | null
          can_help_with: string | null
          color: string | null
          contribution_modes: string[] | null
          display_name: string
          feedback_style: string | null
          human_layer_complete: boolean
          id: string
          input_mode: string
          joined_at: string
          linked_participant_id: string | null
          needs_today: string | null
          personality: string | null
          role: string | null
          role_today: string | null
          room_id: string
          share_blockers: boolean
          share_needs: boolean
          strengths: string[] | null
          user_id: string | null
          voice_sample_path: string | null
          voice_sample_transcript: string | null
        }
        Insert: {
          allow_voice_mention?: boolean
          blockers?: string | null
          can_help_with?: string | null
          color?: string | null
          contribution_modes?: string[] | null
          display_name: string
          feedback_style?: string | null
          human_layer_complete?: boolean
          id?: string
          input_mode?: string
          joined_at?: string
          linked_participant_id?: string | null
          needs_today?: string | null
          personality?: string | null
          role?: string | null
          role_today?: string | null
          room_id: string
          share_blockers?: boolean
          share_needs?: boolean
          strengths?: string[] | null
          user_id?: string | null
          voice_sample_path?: string | null
          voice_sample_transcript?: string | null
        }
        Update: {
          allow_voice_mention?: boolean
          blockers?: string | null
          can_help_with?: string | null
          color?: string | null
          contribution_modes?: string[] | null
          display_name?: string
          feedback_style?: string | null
          human_layer_complete?: boolean
          id?: string
          input_mode?: string
          joined_at?: string
          linked_participant_id?: string | null
          needs_today?: string | null
          personality?: string | null
          role?: string | null
          role_today?: string | null
          room_id?: string
          share_blockers?: boolean
          share_needs?: boolean
          strengths?: string[] | null
          user_id?: string | null
          voice_sample_path?: string | null
          voice_sample_transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_linked_participant_id_fkey"
            columns: ["linked_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_recall: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          quotes: Json
          room_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          quotes?: Json
          room_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          quotes?: Json
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_recall_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_references: {
        Row: {
          created_at: string
          id: string
          query: string
          room_id: string
          shape_id: string | null
          snippet: string
          source: string
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          room_id: string
          shape_id?: string | null
          snippet?: string
          source?: string
          title: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          room_id?: string
          shape_id?: string | null
          snippet?: string
          source?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_references_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          ended_at: string | null
          facilitation: string | null
          goal: string | null
          host_id: string | null
          host_role: string | null
          id: string
          join_code: string | null
          mode: string | null
          name: string
          outputs: string[] | null
          session_type: string | null
          started_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          facilitation?: string | null
          goal?: string | null
          host_id?: string | null
          host_role?: string | null
          id?: string
          join_code?: string | null
          mode?: string | null
          name?: string
          outputs?: string[] | null
          session_type?: string | null
          started_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          facilitation?: string | null
          goal?: string | null
          host_id?: string | null
          host_role?: string | null
          id?: string
          join_code?: string | null
          mode?: string | null
          name?: string
          outputs?: string[] | null
          session_type?: string | null
          started_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      session_summaries: {
        Row: {
          chars_covered: number
          decisions: string[]
          entities: string[]
          open_questions: string[]
          room_id: string
          summary: string
          topics: string[]
          updated_at: string
        }
        Insert: {
          chars_covered?: number
          decisions?: string[]
          entities?: string[]
          open_questions?: string[]
          room_id: string
          summary?: string
          topics?: string[]
          updated_at?: string
        }
        Update: {
          chars_covered?: number
          decisions?: string[]
          entities?: string[]
          open_questions?: string[]
          room_id?: string
          summary?: string
          topics?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_summaries_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      speaker_map: {
        Row: {
          cluster_label: string
          created_at: string
          id: string
          participant_id: string
          room_id: string
        }
        Insert: {
          cluster_label: string
          created_at?: string
          id?: string
          participant_id: string
          room_id: string
        }
        Update: {
          cluster_label?: string
          created_at?: string
          id?: string
          participant_id?: string
          room_id?: string
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          created_by: string
          expires_at: string
          id: string
          team_id: string
          token: string
        }
        Insert: {
          created_by: string
          expires_at?: string
          id?: string
          team_id: string
          token?: string
        }
        Update: {
          created_by?: string
          expires_at?: string
          id?: string
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      transcript_chunks: {
        Row: {
          created_at: string
          id: string
          participant_id: string | null
          room_id: string
          source: string
          t_offset_ms: number
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_id?: string | null
          room_id: string
          source?: string
          t_offset_ms?: number
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_id?: string | null
          room_id?: string
          source?: string
          t_offset_ms?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_chunks_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcript_chunks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          id: string
          name: string
          team_id: string
        }
        Insert: {
          id?: string
          name: string
          team_id: string
        }
        Update: {
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      agent_event_claim: {
        Args: { p_agent: string; p_key: string; p_room: string }
        Returns: Json
      }
      agent_event_finish: {
        Args: {
          p_error?: string
          p_key: string
          p_result?: Json
          p_room: string
          p_status: string
          p_token: string
        }
        Returns: boolean
      }
      agent_events_list: {
        Args: { p_room: string }
        Returns: {
          agent: string
          created_at: string
          error: string
          event_key: string
          result: Json
          status: string
        }[]
      }
      canvas_events_append: {
        Args: {
          p_expected_clear: string
          p_room: string
          p_rows: Json
          p_seed?: boolean
        }
        Returns: boolean
      }
      canvas_events_clear: {
        Args: { p_room: string; p_row: Json }
        Returns: Json
      }
      canvas_events_for_room: {
        Args: { p_limit?: number; p_room: string }
        Returns: {
          created_at: string
          op: Json
          source: string
          t_offset_ms: number
          thread_id: string
          transcript_span: Json
        }[]
      }
      canvas_events_page: {
        Args: {
          p_after_at?: string
          p_after_id?: string
          p_limit?: number
          p_room: string
        }
        Returns: {
          created_at: string
          id: string
          op: Json
          source: string
          t_offset_ms: number
          thread_id: string
          transcript_span: Json
        }[]
      }
      gen_join_code: { Args: never; Returns: string }
      insights_add: {
        Args: { p_room: string; p_rows: Json }
        Returns: undefined
      }
      insights_dismiss: {
        Args: { p_id: string; p_room: string }
        Returns: undefined
      }
      insights_list: {
        Args: { p_room: string }
        Returns: {
          confidence: number
          id: string
          kind: string
          source_quote: string
          subject_name: string
          text: string
        }[]
      }
      is_live_room: { Args: { p_room: string }; Returns: boolean }
      memory_index: {
        Args: { p_exclude: string; p_room_ids: string[] }
        Returns: {
          created_at: string
          room_id: string
          room_name: string
          thread_id: string
          transcript_span: Json
        }[]
      }
      recall_list: {
        Args: { p_room: string }
        Returns: {
          answer: string
          created_at: string
          id: string
          question: string
          quotes: Json
          room_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "room_recall"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reference_list: {
        Args: { p_room: string }
        Returns: {
          created_at: string
          id: string
          query: string
          room_id: string
          shape_id: string | null
          snippet: string
          source: string
          title: string
          url: string
        }[]
        SetofOptions: {
          from: "*"
          to: "room_references"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reference_save: {
        Args: {
          p_query: string
          p_room: string
          p_shape_id: string
          p_snippet: string
          p_source: string
          p_title: string
          p_url: string
        }
        Returns: {
          created_at: string
          id: string
          query: string
          room_id: string
          shape_id: string | null
          snippet: string
          source: string
          title: string
          url: string
        }[]
        SetofOptions: {
          from: "*"
          to: "room_references"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      relation_add: {
        Args: {
          p_confidence: number
          p_from_room: string
          p_from_thread: string
          p_reason: string
          p_relation: string
          p_to_room: string
          p_to_thread: string
        }
        Returns: undefined
      }
      relations_list: {
        Args: { p_room: string }
        Returns: {
          confidence: number
          created_at: string
          reason: string
          relation: string
          to_room_id: string
          to_thread_id: string
        }[]
      }
      room_by_code: { Args: { p_code: string }; Returns: string }
      room_can_read: { Args: { p_room: string }; Returns: boolean }
      room_create: {
        Args: {
          p_facilitation: string
          p_goal: string
          p_host_role: string
          p_mode: string
          p_name: string
          p_outputs: string[]
          p_session_type: string
        }
        Returns: {
          id: string
          join_code: string
          name: string
        }[]
      }
      room_get: {
        Args: { p_id: string }
        Returns: {
          ended_at: string
          facilitation: string
          goal: string
          host_role: string
          id: string
          join_code: string
          name: string
          outputs: string[]
        }[]
      }
      room_member_access: { Args: { p_room: string }; Returns: boolean }
      rooms_by_ids: {
        Args: { p_ids: string[] }
        Returns: {
          ended_at: string
          goal: string
          id: string
          join_code: string
          name: string
        }[]
      }
      session_stats: {
        Args: { p_ids: string[] }
        Returns: {
          last_activity: string
          messages: number
          participants: number
          room_id: string
          shapes: number
        }[]
      }
      team_create: { Args: { p_name: string }; Returns: string }
      team_has_access: {
        Args: { p_owner?: boolean; p_team: string }
        Returns: boolean
      }
      team_invite_accept: { Args: { p_token: string }; Returns: string }
      team_invite_create: { Args: { p_team: string }; Returns: string }
      team_member_remove: {
        Args: { p_team: string; p_user: string }
        Returns: undefined
      }
      workspace_attach_room: {
        Args: { p_room: string; p_workspace: string }
        Returns: undefined
      }
      workspace_create_room: {
        Args: {
          p_facilitation: string
          p_goal: string
          p_host_role: string
          p_mode: string
          p_name: string
          p_outputs: string[]
          p_session_type: string
          p_workspace: string
        }
        Returns: {
          id: string
          join_code: string
          name: string
        }[]
      }
      workspace_rooms: {
        Args: never
        Returns: {
          created_at: string
          ended_at: string | null
          facilitation: string | null
          goal: string | null
          host_id: string | null
          host_role: string | null
          id: string
          join_code: string | null
          mode: string | null
          name: string
          outputs: string[] | null
          session_type: string | null
          started_at: string
          workspace_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "rooms"
          isOneToOne: false
          isSetofReturn: true
        }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
