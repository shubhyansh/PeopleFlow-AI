/**
 * Supabase schema types — used by the typed createClient<Database>().
 * Mirrors `supabase/migrations/0001_init.sql`. Update both together when
 * the schema changes.
 */

import type { TaskAttachment, TimelineEntry } from '../../domain/types';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: UserInsert;
        Update: Partial<UserInsert>;
        Relationships: [];
      };
      clients: {
        Row: ClientRow;
        Insert: ClientInsert;
        Update: Partial<ClientInsert>;
        Relationships: [];
      };
      projects: {
        Row: ProjectRow;
        Insert: ProjectInsert;
        Update: Partial<ProjectInsert>;
        Relationships: [];
      };
      tasks: {
        Row: TaskRow;
        Insert: TaskInsert;
        Update: Partial<TaskInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export interface UserRow {
  id: string;
  username: string;
  /** Null until the employee sets a password on first login. */
  password_hash: string | null;
  name: string;
  role: 'admin' | 'employee';
  designation: string;
  description: string;
  created_at: string;
}
export type UserInsert = Omit<UserRow, 'created_at'> & { created_at?: string };

export interface ClientRow {
  id: string;
  name: string;
  created_at: string;
}
export type ClientInsert = Omit<ClientRow, 'created_at'> & { created_at?: string };

export interface ProjectRow {
  id: string;
  name: string;
  client_id: string | null;
  lead_id: string | null;
  member_ids: string[];
  created_at: string;
}
export type ProjectInsert = Omit<ProjectRow, 'created_at'> & { created_at?: string };

export interface TaskRow {
  id: string;
  title: string;
  type: 'leadership' | 'development';
  dev_kind: string | null;
  project_id: string | null;
  client_id: string | null;
  assignee_id: string;
  assigner_id: string;
  status: string;
  brief: string;
  expected_output: string;
  attachments: TaskAttachment[];
  tech_stack: string[];
  estimated_days: number | null;
  deadline: string | null;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  parallel_with: string[];
  sequence_index: number;
  timeline: TimelineEntry[];
}
export type TaskInsert = Omit<TaskRow, 'created_at'> & { created_at?: string };
