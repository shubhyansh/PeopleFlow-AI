import { supabase } from './client';
import { asError } from '../../lib/errors';
import type { Task, TaskStatus, TaskType, DevTaskKind } from '../../domain/types';
import type { TaskRow } from './schema';

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    type: row.type as TaskType,
    ...(row.dev_kind ? { devKind: row.dev_kind as DevTaskKind } : {}),
    ...(row.project_id ? { projectId: row.project_id } : {}),
    ...(row.client_id ? { clientId: row.client_id } : {}),
    assigneeId: row.assignee_id,
    assignerId: row.assigner_id,
    status: row.status as TaskStatus,
    brief: row.brief,
    expectedOutput: row.expected_output,
    attachments: row.attachments,
    techStack: row.tech_stack ?? [],
    ...(row.estimated_days !== null ? { estimatedDays: row.estimated_days } : {}),
    ...(row.deadline ? { deadline: row.deadline } : {}),
    createdAt: row.created_at,
    ...(row.accepted_at ? { acceptedAt: row.accepted_at } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    parallelWith: row.parallel_with,
    sequenceIndex: row.sequence_index,
    timeline: row.timeline,
  };
}

export async function loadTask(taskId: string): Promise<Task | null> {
  const { data, error } = await supabase()
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();
  if (error) throw asError(error);
  return data ? rowToTask(data as TaskRow) : null;
}

/**
 * Returns the next sequence_index to use for a new task assigned to this
 * employee. Sequence is per-assignee — admin queues tasks one after another;
 * only the employee can later mark them parallel.
 */
export async function nextSequenceIndex(assigneeId: string): Promise<number> {
  const { data, error } = await supabase()
    .from('tasks')
    .select('sequence_index')
    .eq('assignee_id', assigneeId)
    .order('sequence_index', { ascending: false })
    .limit(1);
  if (error) throw asError(error);
  const rows = (data ?? []) as { sequence_index: number }[];
  if (rows.length === 0) return 0;
  return rows[0].sequence_index + 1;
}

export async function listAllTasks(): Promise<Task[]> {
  const { data, error } = await supabase()
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw asError(error);
  return ((data ?? []) as TaskRow[]).map(rowToTask);
}

export async function listTasksByProject(projectId: string): Promise<Task[]> {
  const { data, error } = await supabase()
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('sequence_index', { ascending: true });
  if (error) throw asError(error);
  return ((data ?? []) as TaskRow[]).map(rowToTask);
}

export async function listTasksByAssignee(assigneeId: string): Promise<Task[]> {
  const { data, error } = await supabase()
    .from('tasks')
    .select('*')
    .eq('assignee_id', assigneeId)
    .order('sequence_index', { ascending: true });
  if (error) throw asError(error);
  return ((data ?? []) as TaskRow[]).map(rowToTask);
}

/** Patch arbitrary fields on a task. JSON columns (timeline, parallel_with, attachments) are replaced wholesale. */
export async function updateTask(
  id: string,
  patch: Partial<Task>,
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.estimatedDays !== undefined) update.estimated_days = patch.estimatedDays ?? null;
  if (patch.deadline !== undefined) update.deadline = patch.deadline ?? null;
  if (patch.acceptedAt !== undefined) update.accepted_at = patch.acceptedAt ?? null;
  if (patch.completedAt !== undefined) update.completed_at = patch.completedAt ?? null;
  if (patch.parallelWith !== undefined) update.parallel_with = patch.parallelWith;
  if (patch.sequenceIndex !== undefined) update.sequence_index = patch.sequenceIndex;
  if (patch.timeline !== undefined) update.timeline = patch.timeline;
  if (patch.brief !== undefined) update.brief = patch.brief;
  if (patch.expectedOutput !== undefined) update.expected_output = patch.expectedOutput;
  if (patch.attachments !== undefined) update.attachments = patch.attachments;
  if (patch.techStack !== undefined) update.tech_stack = patch.techStack;

  const { error } = await supabase().from('tasks').update(update).eq('id', id);
  if (error) throw asError(error);
}

export async function saveTask(task: Task): Promise<void> {
  const { error } = await supabase()
    .from('tasks')
    .upsert({
      id: task.id,
      title: task.title,
      type: task.type,
      dev_kind: task.devKind ?? null,
      project_id: task.projectId ?? null,
      client_id: task.clientId ?? null,
      assignee_id: task.assigneeId,
      assigner_id: task.assignerId,
      status: task.status,
      brief: task.brief,
      expected_output: task.expectedOutput,
      attachments: task.attachments,
      tech_stack: task.techStack,
      estimated_days: task.estimatedDays ?? null,
      deadline: task.deadline ?? null,
      accepted_at: task.acceptedAt ?? null,
      completed_at: task.completedAt ?? null,
      parallel_with: task.parallelWith,
      sequence_index: task.sequenceIndex,
      timeline: task.timeline,
    });
  if (error) throw asError(error);
}
