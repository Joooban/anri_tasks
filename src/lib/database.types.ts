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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      allowed_emails: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
        }
        Relationships: [
          {
            foreignKeyName: "allowed_emails_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string
          body: string
          created_at: string
          department_id: string | null
          expires_at: string | null
          id: string
          pinned: boolean
          publish_at: string
          title: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          department_id?: string | null
          expires_at?: string | null
          id?: string
          pinned?: boolean
          publish_at?: string
          title: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          department_id?: string | null
          expires_at?: string | null
          id?: string
          pinned?: boolean
          publish_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          task_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          task_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      boss_dashboard_prefs: {
        Row: {
          enabled_widgets: string[]
          profile_id: string
          widget_order: string[]
        }
        Insert: {
          enabled_widgets?: string[]
          profile_id: string
          widget_order?: string[]
        }
        Update: {
          enabled_widgets?: string[]
          profile_id?: string
          widget_order?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "boss_dashboard_prefs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          created_at: string
          created_by: string
          department_id: string | null
          description: string | null
          end_at: string | null
          id: string
          meeting_link: string | null
          start_at: string
          title: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          created_by: string
          department_id?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          meeting_link?: string | null
          start_at: string
          title: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          meeting_link?: string | null
          start_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          has_account: boolean
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          has_account?: boolean
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          has_account?: boolean
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department_id: string | null
          email: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          assignee_type: string
          completed_at: string | null
          completed_by: string | null
          department_id: string | null
          id: string
          notes: string | null
          profile_id: string | null
          requires_confirmation: boolean
          started_at: string | null
          status: string
          step_order: number
          task_id: string
        }
        Insert: {
          assignee_type: string
          completed_at?: string | null
          completed_by?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          profile_id?: string | null
          requires_confirmation?: boolean
          started_at?: string | null
          status?: string
          step_order: number
          task_id: string
        }
        Update: {
          assignee_type?: string
          completed_at?: string | null
          completed_by?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          profile_id?: string | null
          requires_confirmation?: boolean
          started_at?: string | null
          status?: string
          step_order?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          storage_path: string
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path: string
          task_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_types: {
        Row: {
          color: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      task_visibility: {
        Row: {
          department_id: string | null
          id: string
          profile_id: string | null
          task_id: string
        }
        Insert: {
          department_id?: string | null
          id?: string
          profile_id?: string | null
          task_id: string
        }
        Update: {
          department_id?: string | null
          id?: string
          profile_id?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_visibility_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_visibility_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_visibility_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          created_by: string
          creator_department_id: string | null
          deadline: string | null
          description: string | null
          id: string
          is_personal: boolean
          status: string
          task_type_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          creator_department_id?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          is_personal?: boolean
          status?: string
          task_type_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          creator_department_id?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          is_personal?: boolean
          status?: string
          task_type_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_creator_department_id_fkey"
            columns: ["creator_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_task_type_id_fkey"
            columns: ["task_type_id"]
            isOneToOne: false
            referencedRelation: "task_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      task_departments: {
        Row: {
          department_id: string | null
          task_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_allowed_email_rpc: { Args: { p_email: string }; Returns: undefined }
      add_task_comment_rpc: {
        Args: { p_body: string; p_task_id: string }
        Returns: string
      }
      block_step_rpc: {
        Args: { p_assignee_id: string; p_notes: string }
        Returns: undefined
      }
      can_act_on_step: {
        Args: { p_department_id: string; p_profile_id: string }
        Returns: boolean
      }
      can_create_task: { Args: never; Returns: boolean }
      can_view_task: { Args: { p_task_id: string }; Returns: boolean }
      cancel_task_rpc: { Args: { p_task_id: string }; Returns: undefined }
      complete_step_rpc: { Args: { p_assignee_id: string }; Returns: undefined }
      confirm_step_rpc: { Args: { p_assignee_id: string }; Returns: undefined }
      create_announcement_rpc: {
        Args: {
          p_body: string
          p_company_wide: boolean
          p_expires_at: string
          p_pinned: boolean
          p_publish_at: string
          p_title: string
        }
        Returns: string
      }
      create_meeting_rpc: {
        Args: {
          p_company_wide: boolean
          p_description: string
          p_end_at: string
          p_meeting_link: string
          p_start_at: string
          p_title: string
        }
        Returns: string
      }
      create_task_rpc: {
        Args: {
          p_chain: Json
          p_deadline: string
          p_description: string
          p_is_personal: boolean
          p_task_type_id: string
          p_title: string
          p_visibility: Json
        }
        Returns: string
      }
      delete_announcement_rpc: { Args: { p_id: string }; Returns: undefined }
      delete_cancelled_task_rpc: {
        Args: { p_task_id: string }
        Returns: undefined
      }
      finish_unconfirmable_step_rpc: {
        Args: { p_assignee_id: string }
        Returns: undefined
      }
      is_assignee: {
        Args: { p_department_id: string; p_profile_id: string }
        Returns: boolean
      }
      is_boss_or_supervisor: { Args: never; Returns: boolean }
      is_email_allowed: { Args: { p_email: string }; Returns: boolean }
      list_allowed_emails_rpc: {
        Args: never
        Returns: {
          created_at: string
          email: string
        }[]
      }
      log_audit: {
        Args: {
          p_action: string
          p_actor_id: string
          p_details?: Json
          p_task_id: string
        }
        Returns: undefined
      }
      my_department_id: { Args: never; Returns: string }
      my_role: { Args: never; Returns: string }
      remove_allowed_email_rpc: {
        Args: { p_email: string }
        Returns: undefined
      }
      unblock_step_rpc: { Args: { p_assignee_id: string }; Returns: undefined }
      update_announcement_rpc: {
        Args: {
          p_body: string
          p_expires_at: string
          p_id: string
          p_pinned: boolean
          p_publish_at: string
          p_title: string
        }
        Returns: undefined
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
