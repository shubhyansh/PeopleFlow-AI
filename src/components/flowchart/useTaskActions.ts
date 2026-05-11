import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  acceptTask,
  acknowledgeRequirements,
  addRequirements,
  addStatusUpdate,
  completeTask,
  flagBlocker,
  markParallel,
  resolveBlocker,
  resumeFromHold,
  setOnHold,
} from '../../lib/taskLifecycle';
import type { Task, TaskAttachment } from '../../domain/types';

export type ModalKey =
  | 'accept'
  | 'complete'
  | 'parallel'
  | 'blocker'
  | 'resolve'
  | 'pause'
  | 'comment'
  | 'ack'
  | 'req';

const MODAL_DEFAULTS: Record<ModalKey, boolean> = {
  accept: false,
  complete: false,
  parallel: false,
  blocker: false,
  resolve: false,
  pause: false,
  comment: false,
  ack: false,
  req: false,
};

interface Options {
  refresh: () => Promise<void>;
  getTaskById: (id: string) => Task | undefined;
}

/**
 * Centralizes the lifecycle action plumbing used by the per-employee flowchart
 * view AND the org-wide admin flowchart. Returns:
 *  - selectedTask state
 *  - per-modal open/close state
 *  - typed handlers that call the lifecycle helpers and refresh on success
 */
export function useTaskActions({ refresh, getTaskById }: Options) {
  const { flowdeskUser } = useAuth();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [modals, setModals] = useState(MODAL_DEFAULTS);

  const selectedTask = useMemo(
    () => (selectedTaskId ? getTaskById(selectedTaskId) ?? null : null),
    [selectedTaskId, getTaskById],
  );

  const open = useCallback((key: ModalKey) => {
    setModals((m) => ({ ...m, [key]: true }));
  }, []);

  const close = useCallback((key: ModalKey) => {
    setModals((m) => ({ ...m, [key]: false }));
  }, []);

  const accept = useCallback(
    async (estimatedDays: number) => {
      if (!selectedTask || !flowdeskUser) return;
      await acceptTask(selectedTask, estimatedDays, flowdeskUser.id);
      await refresh();
    },
    [selectedTask, flowdeskUser, refresh],
  );

  const complete = useCallback(async () => {
    if (!selectedTask || !flowdeskUser) return;
    await completeTask(selectedTask, flowdeskUser.id);
    await refresh();
  }, [selectedTask, flowdeskUser, refresh]);

  const doMarkParallel = useCallback(
    async (otherId: string, days: number) => {
      if (!selectedTask || !flowdeskUser) return;
      const other = getTaskById(otherId);
      if (!other) return;
      await markParallel(selectedTask, other, days, flowdeskUser.id);
      await refresh();
    },
    [selectedTask, flowdeskUser, refresh, getTaskById],
  );

  const doFlagBlocker = useCallback(
    async (note: string) => {
      if (!selectedTask || !flowdeskUser) return;
      await flagBlocker(selectedTask, note, flowdeskUser.id);
      await refresh();
    },
    [selectedTask, flowdeskUser, refresh],
  );

  const doResolveBlocker = useCallback(
    async (note: string, atts: TaskAttachment[]) => {
      if (!selectedTask || !flowdeskUser) return;
      await resolveBlocker(selectedTask, note, atts, flowdeskUser.id);
      await refresh();
    },
    [selectedTask, flowdeskUser, refresh],
  );

  const doPause = useCallback(
    async (note: string) => {
      if (!selectedTask || !flowdeskUser) return;
      await setOnHold(selectedTask, flowdeskUser.id, note);
      await refresh();
    },
    [selectedTask, flowdeskUser, refresh],
  );

  const doResume = useCallback(async () => {
    if (!selectedTask || !flowdeskUser) return;
    await resumeFromHold(selectedTask, flowdeskUser.id);
    await refresh();
  }, [selectedTask, flowdeskUser, refresh]);

  const doAddComment = useCallback(
    async (note: string) => {
      if (!selectedTask || !flowdeskUser) return;
      await addStatusUpdate(selectedTask, note, flowdeskUser.id);
      await refresh();
    },
    [selectedTask, flowdeskUser, refresh],
  );

  const doAck = useCallback(
    async (extraDays: number, note: string) => {
      if (!selectedTask || !flowdeskUser) return;
      await acknowledgeRequirements(selectedTask, flowdeskUser.id, extraDays, note);
      await refresh();
    },
    [selectedTask, flowdeskUser, refresh],
  );

  const doAddRequirements = useCallback(
    async (note: string) => {
      if (!selectedTask || !flowdeskUser) return;
      await addRequirements(selectedTask, note, flowdeskUser.id);
      await refresh();
    },
    [selectedTask, flowdeskUser, refresh],
  );

  return {
    selectedTaskId,
    setSelectedTaskId,
    selectedTask,
    modals,
    open,
    close,
    handlers: {
      accept,
      complete,
      markParallel: doMarkParallel,
      flagBlocker: doFlagBlocker,
      resolveBlocker: doResolveBlocker,
      pause: doPause,
      resume: doResume,
      addComment: doAddComment,
      ack: doAck,
      addRequirements: doAddRequirements,
    },
  };
}

export type TaskActionsApi = ReturnType<typeof useTaskActions>;
