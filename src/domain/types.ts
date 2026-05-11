/**
 * Roles in FlowDesk are intentionally minimal.
 *
 * - 'admin'   — the single hardcoded administrator (not stored in the users table)
 * - 'employee' — every other user
 *
 * "Lead" is NOT a separate role. Lead-ness is decided per-project / per-task
 * when the admin assigns work — see Project.leadId and the per-task lead in
 * the lifecycle engine. Any employee can be a lead on one project and a
 * regular member on another.
 */
export type Role = 'admin' | 'employee';

export type TaskStatus =
  | 'pending'
  | 'active'
  | 'parallel'
  | 'blocked'
  | 'requirements-addition'
  | 'on-hold'
  | 'completed';

export type TaskType = 'leadership' | 'development';

export type DevTaskKind =
  | 'bug'
  | 'frontend'
  | 'backend'
  | 'api'
  | 'database'
  | 'devops'
  | 'testing'
  | 'docs'
  | 'other';

export interface User {
  id: string;
  username: string;
  /** Null until the employee sets it on first login. */
  passwordHash: string | null;
  name: string;
  role: Role;
  designation: string;
  description: string;
  createdAt: string;
}

export interface UsersFile {
  users: User[];
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  leadId?: string;
  memberIds: string[];
  createdAt: string;
}

export interface ProjectsFile {
  projects: Project[];
}

export interface Client {
  id: string;
  name: string;
}

export interface ClientsFile {
  clients: Client[];
}

export type TimelineKind =
  | 'status-change'
  | 'blocker'
  | 'blocker-resolved'
  | 'comment'
  | 'requirement-edit'
  | 'accepted'
  | 'completed';

export interface TimelineEntry {
  id: string;
  at: string;
  byUserId: string;
  kind: TimelineKind;
  note?: string;
  payload?: Record<string, unknown>;
}

export type AttachmentKind = 'file' | 'note';

export interface TaskAttachment {
  id: string;
  kind: AttachmentKind;
  /** Short label — file name or note title */
  name: string;
  /** Caption / description supplied by the admin */
  description: string;
  /** Files: public URL in Supabase Storage */
  url?: string;
  /** Files: object path in the bucket (so we can delete later) */
  storagePath?: string;
  /** Files: MIME type */
  mimeType?: string;
  /** Files: bytes */
  size?: number;
  /** Notes: free-form text or pasted link */
  body?: string;
}

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  devKind?: DevTaskKind;
  projectId?: string;
  clientId?: string;
  assigneeId: string;
  assignerId: string;
  status: TaskStatus;
  /** Markdown-formatted brief with section headers (## Overview, ## Scope, etc). */
  brief: string;
  expectedOutput: string;
  attachments: TaskAttachment[];
  /** Languages / frameworks / infra captured during the requirements interview. */
  techStack: string[];
  estimatedDays?: number;
  deadline?: string;
  createdAt: string;
  acceptedAt?: string;
  completedAt?: string;
  parallelWith: string[];
  sequenceIndex: number;
  timeline: TimelineEntry[];
}

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: Role;
}
