import type { Task, TaskStatus, TimelineEntry, TimelineKind } from '../domain/types';

/**
 * One visual "box" in the flowchart. A task becomes a vertical chain of these
 * — one per timeline event plus a synthetic creation event.
 */
export interface EventBox {
  id: string;
  taskId: string;
  task: Task;
  /** 0 = creation; 1+ = timeline entry index + 1. */
  index: number;
  /** True for the most recent event of this task (rendered in full color). */
  isCurrent: boolean;
  /** Status the task held AT this event point (used for the box's color/pill). */
  status: TaskStatus;
  /** Event kind. 'created' is synthetic. */
  kind: TimelineKind | 'created';
  at: string;
  byUserId: string;
  /** Main display text — the note, or a synthesized description of the event. */
  primaryText: string;
  /** IDs of attachments referenced by this event (e.g. files attached to a resolution). */
  attachmentIds: string[];
  /** Optional pause duration in ms (set for blocker-resolved / on-hold-resume). */
  pauseDurationMs?: number;
  /** Original timeline payload, if any. */
  payload?: Record<string, unknown>;
}

/** Walk the timeline forward, computing the status the task held at each event. */
export function buildEventChain(task: Task): EventBox[] {
  const events: EventBox[] = [];
  let status: TaskStatus = 'pending';

  // Synthetic creation event
  events.push({
    id: `${task.id}__evt_0`,
    taskId: task.id,
    task,
    index: 0,
    isCurrent: false,
    status,
    kind: 'created',
    at: task.createdAt,
    byUserId: task.assignerId,
    primaryText: task.brief
      ? `Created: ${truncate(task.brief, 220)}`
      : 'Task created',
    attachmentIds: [],
  });

  task.timeline.forEach((entry, i) => {
    const newStatus = applyStatusChange(status, entry);
    const pauseDurationMs = (entry.payload as { pauseDurationMs?: number } | undefined)
      ?.pauseDurationMs;
    const attachmentIds =
      (entry.payload as { attachmentIds?: string[] } | undefined)?.attachmentIds ?? [];

    events.push({
      id: `${task.id}__evt_${i + 1}`,
      taskId: task.id,
      task,
      index: i + 1,
      isCurrent: false,
      status: newStatus,
      kind: entry.kind,
      at: entry.at,
      byUserId: entry.byUserId,
      primaryText: synthesizeText(entry),
      attachmentIds,
      ...(pauseDurationMs ? { pauseDurationMs } : {}),
      ...(entry.payload ? { payload: entry.payload } : {}),
    });
    status = newStatus;
  });

  if (events.length > 0) events[events.length - 1].isCurrent = true;
  return events;
}

function applyStatusChange(current: TaskStatus, entry: TimelineEntry): TaskStatus {
  switch (entry.kind) {
    case 'accepted':
      return 'active';
    case 'completed':
      return 'completed';
    case 'blocker':
      return 'blocked';
    case 'blocker-resolved': {
      const restoredTo = (entry.payload as { restoredTo?: TaskStatus } | undefined)?.restoredTo;
      return restoredTo ?? 'active';
    }
    case 'status-change': {
      const to = (entry.payload as { to?: TaskStatus } | undefined)?.to;
      return to ?? current;
    }
    case 'requirement-edit':
      return 'requirements-addition';
    case 'comment':
      return current;
    default:
      return current;
  }
}

function synthesizeText(entry: TimelineEntry): string {
  if (entry.note?.trim()) return entry.note.trim();
  switch (entry.kind) {
    case 'accepted': {
      const days = (entry.payload as { estimatedDays?: number } | undefined)?.estimatedDays;
      return days ? `Accepted with a ${days}-day estimate.` : 'Accepted and started.';
    }
    case 'completed':
      return 'Marked complete.';
    case 'status-change': {
      const to = (entry.payload as { to?: string } | undefined)?.to;
      const from = (entry.payload as { from?: string } | undefined)?.from;
      const extra = (entry.payload as { extraDays?: number } | undefined)?.extraDays;
      if (from === 'requirements-addition') {
        return extra
          ? `Acknowledged new requirements; added ${extra} extra day${extra === 1 ? '' : 's'}.`
          : 'Acknowledged new requirements.';
      }
      if (to === 'on-hold') return 'Paused.';
      if (from === 'on-hold') return 'Resumed.';
      if (to === 'parallel') return 'Switched to parallel with another task.';
      return from ? `Status: ${from} → ${to}` : `Status changed to ${to}`;
    }
    case 'blocker-resolved':
      return 'Blocker resolved.';
    case 'requirement-edit':
      return 'New requirements were added by the admin.';
    case 'blocker':
      return 'Blocker flagged.';
    case 'comment':
      return 'Status note added.';
    default:
      return entry.kind;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;
}
