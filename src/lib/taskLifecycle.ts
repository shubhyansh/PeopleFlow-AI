import type { Task, TaskAttachment, TaskStatus, TimelineEntry } from '../domain/types';
import { newId } from './id';
import { updateTask } from '../services/supabase/tasks';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function timelineEntry(
  byUserId: string,
  kind: TimelineEntry['kind'],
  payload?: Record<string, unknown>,
  note?: string,
): TimelineEntry {
  return {
    id: newId('tl'),
    at: new Date().toISOString(),
    byUserId,
    kind,
    ...(payload ? { payload } : {}),
    ...(note ? { note } : {}),
  };
}

function deadlineFrom(estimatedDays: number): string {
  return new Date(Date.now() + estimatedDays * MS_PER_DAY).toISOString();
}

function extendDeadline(currentISO: string | undefined, byMs: number): string | undefined {
  if (!currentISO || byMs <= 0) return currentISO;
  return new Date(new Date(currentISO).getTime() + byMs).toISOString();
}

export class LifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LifecycleError';
  }
}

/**
 * Employee accepts a pending task. Sets status to 'active' and computes the
 * deadline from estimated days.
 */
export async function acceptTask(
  task: Task,
  estimatedDays: number,
  byUserId: string,
): Promise<Task> {
  if (task.status !== 'pending') {
    throw new LifecycleError(`Task is already ${task.status}`);
  }
  if (estimatedDays < 1) {
    throw new LifecycleError('Estimated days must be at least 1');
  }
  const acceptedAt = new Date().toISOString();
  const deadline = deadlineFrom(estimatedDays);
  const updated: Task = {
    ...task,
    status: 'active',
    acceptedAt,
    estimatedDays,
    deadline,
    timeline: [
      ...task.timeline,
      timelineEntry(byUserId, 'accepted', { estimatedDays }),
    ],
  };
  await updateTask(task.id, {
    status: updated.status,
    acceptedAt: updated.acceptedAt,
    estimatedDays: updated.estimatedDays,
    deadline: updated.deadline,
    timeline: updated.timeline,
  });
  return updated;
}

/**
 * Mark an active or parallel task as completed.
 */
export async function completeTask(task: Task, byUserId: string): Promise<Task> {
  if (task.status !== 'active' && task.status !== 'parallel') {
    throw new LifecycleError(`Only active or parallel tasks can be completed (was ${task.status})`);
  }
  const completedAt = new Date().toISOString();
  const updated: Task = {
    ...task,
    status: 'completed',
    completedAt,
    timeline: [...task.timeline, timelineEntry(byUserId, 'completed')],
  };
  await updateTask(task.id, {
    status: updated.status,
    completedAt: updated.completedAt,
    timeline: updated.timeline,
  });
  return updated;
}

/**
 * Mark two tasks as parallel — both become 'parallel' status and run side by
 * side. The active task must already be active. The pending task must be
 * later in sequence; it gets accepted at the same time with the supplied
 * estimated days.
 */
export async function markParallel(
  active: Task,
  other: Task,
  estimatedDaysForOther: number,
  byUserId: string,
): Promise<{ active: Task; other: Task }> {
  if (active.status !== 'active' && active.status !== 'parallel') {
    throw new LifecycleError(`The active task must be in progress (was ${active.status})`);
  }
  if (other.status !== 'pending') {
    throw new LifecycleError(`The other task must still be pending (was ${other.status})`);
  }
  if (other.assigneeId !== active.assigneeId) {
    throw new LifecycleError('Tasks must be assigned to the same employee');
  }
  if (estimatedDaysForOther < 1) {
    throw new LifecycleError('Estimated days must be at least 1');
  }

  const now = new Date().toISOString();
  const otherDeadline = deadlineFrom(estimatedDaysForOther);

  const newParallelOnActive = uniq([...active.parallelWith, other.id]);
  const newParallelOnOther = uniq([...other.parallelWith, active.id]);

  const activeUpdated: Task = {
    ...active,
    status: 'parallel',
    parallelWith: newParallelOnActive,
    timeline: [
      ...active.timeline,
      timelineEntry(byUserId, 'status-change', {
        from: active.status,
        to: 'parallel',
        pairedWith: other.id,
      }),
    ],
  };

  const otherUpdated: Task = {
    ...other,
    status: 'parallel',
    acceptedAt: now,
    estimatedDays: estimatedDaysForOther,
    deadline: otherDeadline,
    parallelWith: newParallelOnOther,
    sequenceIndex: active.sequenceIndex,
    timeline: [
      ...other.timeline,
      timelineEntry(byUserId, 'accepted', { estimatedDays: estimatedDaysForOther }),
      timelineEntry(byUserId, 'status-change', {
        from: 'pending',
        to: 'parallel',
        pairedWith: active.id,
      }),
    ],
  };

  await Promise.all([
    updateTask(active.id, {
      status: activeUpdated.status,
      parallelWith: activeUpdated.parallelWith,
      timeline: activeUpdated.timeline,
    }),
    updateTask(other.id, {
      status: otherUpdated.status,
      acceptedAt: otherUpdated.acceptedAt,
      estimatedDays: otherUpdated.estimatedDays,
      deadline: otherUpdated.deadline,
      parallelWith: otherUpdated.parallelWith,
      sequenceIndex: otherUpdated.sequenceIndex,
      timeline: otherUpdated.timeline,
    }),
  ]);

  return { active: activeUpdated, other: otherUpdated };
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// ---------- Blocker / hold / comment / requirements ----------

/**
 * Employee or admin flags a blocker on an active or parallel task. Status
 * flips to 'blocked'. The deadline timer pauses until the blocker is resolved
 * (resolution extends the deadline by the pause duration).
 */
export async function flagBlocker(task: Task, note: string, byUserId: string): Promise<Task> {
  if (task.status !== 'active' && task.status !== 'parallel') {
    throw new LifecycleError(`Only active or parallel tasks can be blocked (was ${task.status})`);
  }
  if (!note.trim()) throw new LifecycleError('A blocker description is required');

  const updated: Task = {
    ...task,
    status: 'blocked',
    timeline: [
      ...task.timeline,
      timelineEntry(byUserId, 'blocker', { previousStatus: task.status }, note.trim()),
    ],
  };
  await updateTask(task.id, { status: updated.status, timeline: updated.timeline });
  return updated;
}

/**
 * Resolve a blocker. Restores the previous status, extends the deadline by
 * the time spent blocked, and optionally appends attachments (files / notes)
 * tied to the resolution. Either employee or admin can resolve.
 */
export async function resolveBlocker(
  task: Task,
  resolution: string,
  resolutionAttachments: TaskAttachment[],
  byUserId: string,
): Promise<Task> {
  if (task.status !== 'blocked') {
    throw new LifecycleError(`Task is not blocked (was ${task.status})`);
  }
  if (!resolution.trim()) throw new LifecycleError('A resolution note is required');

  const lastBlocker = [...task.timeline]
    .reverse()
    .find((e) => e.kind === 'blocker') as TimelineEntry | undefined;
  const restoreTo =
    (lastBlocker?.payload as { previousStatus?: 'active' | 'parallel' } | undefined)
      ?.previousStatus ?? 'active';

  const now = Date.now();
  const pauseDurationMs = lastBlocker ? now - new Date(lastBlocker.at).getTime() : 0;
  const newDeadline = extendDeadline(task.deadline, pauseDurationMs);

  const newAttachments = [...task.attachments, ...resolutionAttachments];
  const attachmentIds = resolutionAttachments.map((a) => a.id);

  const updated: Task = {
    ...task,
    status: restoreTo,
    deadline: newDeadline,
    attachments: newAttachments,
    timeline: [
      ...task.timeline,
      timelineEntry(
        byUserId,
        'blocker-resolved',
        {
          restoredTo: restoreTo,
          pauseDurationMs,
          ...(newDeadline ? { newDeadline } : {}),
          ...(attachmentIds.length ? { attachmentIds } : {}),
        },
        resolution.trim(),
      ),
    ],
  };
  await updateTask(task.id, {
    status: updated.status,
    deadline: updated.deadline,
    attachments: updated.attachments,
    timeline: updated.timeline,
  });
  return updated;
}

/** Manually pause an active or parallel task. Deadline timer pauses. */
export async function setOnHold(task: Task, byUserId: string, note?: string): Promise<Task> {
  if (task.status !== 'active' && task.status !== 'parallel') {
    throw new LifecycleError(`Only active or parallel tasks can be put on hold (was ${task.status})`);
  }
  const updated: Task = {
    ...task,
    status: 'on-hold',
    timeline: [
      ...task.timeline,
      timelineEntry(
        byUserId,
        'status-change',
        { from: task.status, to: 'on-hold' },
        note?.trim() || undefined,
      ),
    ],
  };
  await updateTask(task.id, { status: updated.status, timeline: updated.timeline });
  return updated;
}

/** Resume from manual hold. Extends the deadline by the time on hold. */
export async function resumeFromHold(task: Task, byUserId: string): Promise<Task> {
  if (task.status !== 'on-hold') {
    throw new LifecycleError(`Task is not on hold (was ${task.status})`);
  }

  const lastHold = [...task.timeline]
    .reverse()
    .find(
      (e) =>
        e.kind === 'status-change' &&
        (e.payload as { to?: string } | undefined)?.to === 'on-hold',
    ) as TimelineEntry | undefined;
  const restoreTo =
    ((lastHold?.payload as { from?: 'active' | 'parallel' } | undefined)?.from ?? 'active') as
      | 'active'
      | 'parallel';

  const now = Date.now();
  const pauseDurationMs = lastHold ? now - new Date(lastHold.at).getTime() : 0;
  const newDeadline = extendDeadline(task.deadline, pauseDurationMs);

  const updated: Task = {
    ...task,
    status: restoreTo,
    deadline: newDeadline,
    timeline: [
      ...task.timeline,
      timelineEntry(byUserId, 'status-change', {
        from: 'on-hold',
        to: restoreTo,
        pauseDurationMs,
        ...(newDeadline ? { newDeadline } : {}),
      }),
    ],
  };
  await updateTask(task.id, {
    status: updated.status,
    deadline: updated.deadline,
    timeline: updated.timeline,
  });
  return updated;
}

/** Append a free-form comment / status update to the timeline. */
export async function addStatusUpdate(
  task: Task,
  note: string,
  byUserId: string,
): Promise<Task> {
  if (!note.trim()) throw new LifecycleError('A note is required');
  const updated: Task = {
    ...task,
    timeline: [...task.timeline, timelineEntry(byUserId, 'comment', undefined, note.trim())],
  };
  await updateTask(task.id, { timeline: updated.timeline });
  return updated;
}

/**
 * Admin appends new requirements to a task post-assignment. The brief is
 * extended (not replaced), the status flips to 'requirements-addition' so the
 * employee sees something changed, and a timeline entry records the diff.
 */
export async function addRequirements(
  task: Task,
  additions: string,
  byUserId: string,
): Promise<Task> {
  if (task.status === 'completed') {
    throw new LifecycleError('Cannot add requirements to a completed task');
  }
  if (!additions.trim()) throw new LifecycleError('Requirements text is required');

  const newBrief = `${task.brief}\n\n--- Added requirements (${new Date().toLocaleDateString()}) ---\n${additions.trim()}`;
  const updated: Task = {
    ...task,
    brief: newBrief,
    status: 'requirements-addition',
    timeline: [
      ...task.timeline,
      timelineEntry(
        byUserId,
        'requirement-edit',
        { previousStatus: task.status },
        additions.trim(),
      ),
    ],
  };
  await updateTask(task.id, {
    brief: updated.brief,
    status: updated.status,
    timeline: updated.timeline,
  });
  return updated;
}

/**
 * Employee acknowledges newly-added requirements. Optionally extends the
 * deadline by `extraDays` and records a reason in the timeline.
 */
export async function acknowledgeRequirements(
  task: Task,
  byUserId: string,
  extraDays = 0,
  note?: string,
): Promise<Task> {
  if (task.status !== 'requirements-addition') {
    throw new LifecycleError(`No requirements to acknowledge (status: ${task.status})`);
  }
  if (extraDays < 0) throw new LifecycleError('Extra days cannot be negative');

  const lastReqEdit = [...task.timeline]
    .reverse()
    .find((e) => e.kind === 'requirement-edit') as TimelineEntry | undefined;
  const restoreTo =
    (lastReqEdit?.payload as { previousStatus?: TaskStatus } | undefined)?.previousStatus ??
    'active';

  const newDeadline = extraDays > 0 ? extendDeadline(task.deadline, extraDays * MS_PER_DAY) : task.deadline;

  const updated: Task = {
    ...task,
    status: restoreTo,
    deadline: newDeadline,
    timeline: [
      ...task.timeline,
      timelineEntry(
        byUserId,
        'status-change',
        {
          from: 'requirements-addition',
          to: restoreTo,
          ...(extraDays > 0 ? { extraDays, newDeadline } : {}),
        },
        note?.trim() || undefined,
      ),
    ],
  };
  await updateTask(task.id, {
    status: updated.status,
    deadline: updated.deadline,
    timeline: updated.timeline,
  });
  return updated;
}

// ---------- Helpers used by UI to know if a task is currently paused ----------

/** Returns true while the task's deadline timer is paused (blocked or on-hold). */
export function isPaused(status: TaskStatus): boolean {
  return status === 'blocked' || status === 'on-hold';
}

/** When the current pause started (for UI to show pause duration so far). */
export function pauseStartedAt(task: Task): string | null {
  if (!isPaused(task.status)) return null;
  const lookForKind = task.status === 'blocked' ? 'blocker' : 'status-change';
  const matched = [...task.timeline].reverse().find((e) => {
    if (e.kind !== lookForKind) return false;
    if (e.kind === 'status-change') {
      return (e.payload as { to?: string } | undefined)?.to === 'on-hold';
    }
    return true;
  });
  return matched?.at ?? null;
}
