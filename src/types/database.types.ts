export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'agent' | 'customer'
export type TicketStatus = 'new' | 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type DocumentCategory = 'user_manual' | 'service_manual' | 'technical_doc' | 'policy' | 'other'
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: UserRole
          avatar_url: string | null
          expertise_areas: string[] | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: UserRole
          avatar_url?: string | null
          expertise_areas?: string[] | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: UserRole
          avatar_url?: string | null
          expertise_areas?: string[] | null
          is_active?: boolean
          updated_at?: string
        }
      }
      tickets: {
        Row: {
          id: string
          ticket_number: string
          title: string
          description: string
          status: TicketStatus
          priority: TicketPriority
          category: string | null
          tags: string[] | null
          customer_id: string | null
          assigned_to: string | null
          sla_due_date: string | null
          sla_breached: boolean
          resolution_notes: string | null
          created_at: string
          updated_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          ticket_number?: string
          title: string
          description: string
          status?: TicketStatus
          priority?: TicketPriority
          category?: string | null
          tags?: string[] | null
          customer_id?: string | null
          assigned_to?: string | null
          sla_due_date?: string | null
          sla_breached?: boolean
          resolution_notes?: string | null
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
        }
        Update: {
          title?: string
          description?: string
          status?: TicketStatus
          priority?: TicketPriority
          category?: string | null
          tags?: string[] | null
          assigned_to?: string | null
          sla_due_date?: string | null
          sla_breached?: boolean
          resolution_notes?: string | null
          updated_at?: string
          resolved_at?: string | null
        }
      }
      ticket_messages: {
        Row: {
          id: string
          ticket_id: string
          user_id: string
          message: string
          is_internal_note: boolean
          is_ai_generated: boolean
          attachments: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          user_id: string
          message: string
          is_internal_note?: boolean
          is_ai_generated?: boolean
          attachments?: Json | null
          created_at?: string
        }
        Update: {
          message?: string
          is_internal_note?: boolean
          attachments?: Json | null
        }
      }
      knowledge_base_articles: {
        Row: {
          id: string
          title: string
          content: string
          category: string | null
          tags: string[] | null
          author_id: string | null
          view_count: number
          helpful_count: number
          published: boolean
          embedding: number[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          category?: string | null
          tags?: string[] | null
          author_id?: string | null
          view_count?: number
          helpful_count?: number
          published?: boolean
          embedding?: number[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          content?: string
          category?: string | null
          tags?: string[] | null
          view_count?: number
          helpful_count?: number
          published?: boolean
          embedding?: number[] | null
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          title: string
          description: string | null
          file_name: string
          file_path: string
          file_type: string
          file_size: number
          file_hash: string
          category: DocumentCategory
          product_name: string | null
          product_version: string | null
          manufacturer: string | null
          model_number: string | null
          tags: string[] | null
          uploaded_by: string | null
          processing_status: ProcessingStatus
          processing_error: string | null
          total_pages: number | null
          total_chunks: number
          metadata: Json | null
          is_active: boolean
          created_at: string
          updated_at: string
          processed_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          file_name: string
          file_path: string
          file_type: string
          file_size: number
          file_hash: string
          category: DocumentCategory
          product_name?: string | null
          product_version?: string | null
          manufacturer?: string | null
          model_number?: string | null
          tags?: string[] | null
          uploaded_by?: string | null
          processing_status?: ProcessingStatus
          total_chunks?: number
          metadata?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          category?: DocumentCategory
          product_name?: string | null
          product_version?: string | null
          manufacturer?: string | null
          model_number?: string | null
          tags?: string[] | null
          processing_status?: ProcessingStatus
          processing_error?: string | null
          total_pages?: number | null
          total_chunks?: number
          metadata?: Json | null
          is_active?: boolean
          updated_at?: string
          processed_at?: string | null
        }
      }
      document_chunks: {
        Row: {
          id: string
          document_id: string
          chunk_index: number
          content: string
          embedding: number[] | null
          page_number: number | null
          section_title: string | null
          chunk_metadata: Json | null
          token_count: number | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          chunk_index: number
          content: string
          embedding?: number[] | null
          page_number?: number | null
          section_title?: string | null
          chunk_metadata?: Json | null
          token_count?: number | null
          created_at?: string
        }
        Update: {
          content?: string
          embedding?: number[] | null
          page_number?: number | null
          section_title?: string | null
          chunk_metadata?: Json | null
          token_count?: number | null
        }
      }
      document_access_logs: {
        Row: {
          id: string
          document_id: string
          user_id: string | null
          access_type: string
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          user_id?: string | null
          access_type: string
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: never
      }
      ai_guardrails_config: {
        Row: {
          id: string
          rule_name: string
          rule_type: string
          rule_value: Json
          is_enabled: boolean
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rule_name: string
          rule_type: string
          rule_value: Json
          is_enabled?: boolean
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          rule_name?: string
          rule_type?: string
          rule_value?: Json
          is_enabled?: boolean
          description?: string | null
          updated_at?: string
        }
      }
      ai_guardrails_logs: {
        Row: {
          id: string
          session_id: string
          user_id: string | null
          user_query: string
          ai_response: string | null
          guardrail_checks: Json
          sources_used: Json | null
          confidence_score: number | null
          hallucination_detected: boolean
          inappropriate_content: boolean
          blocked_response: boolean
          fallback_message: string | null
          processing_time_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id?: string | null
          user_query: string
          ai_response?: string | null
          guardrail_checks: Json
          sources_used?: Json | null
          confidence_score?: number | null
          hallucination_detected?: boolean
          inappropriate_content?: boolean
          blocked_response?: boolean
          fallback_message?: string | null
          processing_time_ms?: number | null
          created_at?: string
        }
        Update: never
      }
      ai_chat_sessions: {
        Row: {
          id: string
          ticket_id: string | null
          user_id: string
          messages: Json
          context_used: Json | null
          total_tokens_used: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ticket_id?: string | null
          user_id: string
          messages?: Json
          context_used?: Json | null
          total_tokens_used?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          messages?: Json
          context_used?: Json | null
          total_tokens_used?: number
          updated_at?: string
        }
      }
      ticket_embeddings: {
        Row: {
          id: string
          ticket_id: string
          content_hash: string
          embedding: number[] | null
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          content_hash: string
          embedding?: number[] | null
          created_at?: string
        }
        Update: {
          embedding?: number[] | null
        }
      }
      automation_logs: {
        Row: {
          id: string
          ticket_id: string | null
          automation_type: string
          input_data: Json | null
          output_data: Json | null
          success: boolean
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id?: string | null
          automation_type: string
          input_data?: Json | null
          output_data?: Json | null
          success?: boolean
          error_message?: string | null
          created_at?: string
        }
        Update: never
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_document_chunks: {
        Args: {
          query_embedding: number[]
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          document_id: string
          document_title: string
          content: string
          page_number: number | null
          section_title: string | null
          similarity: number
        }[]
      }
      search_kb_articles: {
        Args: {
          query_embedding: number[]
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          title: string
          content: string
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenient type aliases
export type User = Database['public']['Tables']['users']['Row']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type Ticket = Database['public']['Tables']['tickets']['Row']
export type TicketInsert = Database['public']['Tables']['tickets']['Insert']
export type TicketUpdate = Database['public']['Tables']['tickets']['Update']

export type TicketMessage = Database['public']['Tables']['ticket_messages']['Row']
export type TicketMessageInsert = Database['public']['Tables']['ticket_messages']['Insert']

export type KBArticle = Database['public']['Tables']['knowledge_base_articles']['Row']
export type KBArticleInsert = Database['public']['Tables']['knowledge_base_articles']['Insert']
export type KBArticleUpdate = Database['public']['Tables']['knowledge_base_articles']['Update']

export type Document = Database['public']['Tables']['documents']['Row']
export type DocumentInsert = Database['public']['Tables']['documents']['Insert']
export type DocumentUpdate = Database['public']['Tables']['documents']['Update']

export type DocumentChunk = Database['public']['Tables']['document_chunks']['Row']

export type AIGuardrailConfig = Database['public']['Tables']['ai_guardrails_config']['Row']
export type AIGuardrailLog = Database['public']['Tables']['ai_guardrails_logs']['Row']
export type AIChatSession = Database['public']['Tables']['ai_chat_sessions']['Row']

export type AutomationLog = Database['public']['Tables']['automation_logs']['Row']
