import { composeBrief, type InterviewBrief } from './taskInterview';
import type { Task, TaskAttachment } from '../domain/types';

export interface TaskDraftInput {
  brief: InterviewBrief;
  assigneeId: string;
  /** Admin or lead creating the task. */
  assignerId: string;
  attachments: TaskAttachment[];
  /** Position in the assignee's queue, from `nextSequenceIndex`. */
  sequenceIndex: number;
  /** Injected so the result is deterministic and testable. */
  id: string;
  createdAt: string;
}

/**
 * Builds the `Task` record that gets written to Supabase from a completed
 * interview brief. Pure: every non-deterministic input (id, timestamp,
 * sequence index) is passed in, so the same arguments always produce the same
 * task.
 *
 * Optional columns are omitted rather than set to null — Supabase treats an
 * absent key and an explicit null differently on upsert.
 */
export function buildTaskDraft(input: TaskDraftInput): Task {
  const { brief, assigneeId, assignerId, attachments, sequenceIndex, id, createdAt } = input;

  return {
    id,
    title: brief.title.trim(),
    type: brief.type ?? 'development',
    ...(brief.devKind ? { devKind: brief.devKind } : {}),
    ...(brief.projectId ? { projectId: brief.projectId } : {}),
    ...(brief.clientId ? { clientId: brief.clientId } : {}),
    assigneeId,
    assignerId,
    status: 'pending',
    brief: composeBrief(brief),
    expectedOutput: brief.expectedOutput.trim(),
    attachments,
    techStack: brief.techStack,
    createdAt,
    parallelWith: [],
    sequenceIndex,
    timeline: [],
  };
}

/**
 * A leadership task also rewrites project membership. Callers use this to
 * decide whether to hit `setProjectLeadAndMembers` before saving.
 */
export function leadershipAssignment(
  brief: InterviewBrief,
): { projectId: string; leadId: string; memberIds: string[] } | null {
  if (brief.type !== 'leadership') return null;
  if (!brief.projectId || !brief.leadId) return null;
  return { projectId: brief.projectId, leadId: brief.leadId, memberIds: brief.memberIds };
}
