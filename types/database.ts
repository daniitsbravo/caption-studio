export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          created_at?: string
        }
        Relationships: []
      }
      captions: {
        Row: {
          id: string
          user_id: string
          image_url: string
          image_name: string | null
          caption: string
          hashtags: string[]
          is_carousel: boolean
          carousel_image_urls: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          image_url: string
          image_name?: string | null
          caption: string
          hashtags?: string[]
          is_carousel?: boolean
          carousel_image_urls?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          image_url?: string
          image_name?: string | null
          caption?: string
          hashtags?: string[]
          is_carousel?: boolean
          carousel_image_urls?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type CaptionRow = Database['public']['Tables']['captions']['Row']
export type CaptionUpdate = Database['public']['Tables']['captions']['Update']
export type ProfileRow = Database['public']['Tables']['profiles']['Row']
