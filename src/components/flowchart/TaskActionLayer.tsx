import { useMemo } from 'react';
import type { Task } from '../../domain/types';
import { TaskDrawer, type DrawerMode } from './TaskDrawer';
import { AcceptModal } from './AcceptModal';
import { CompleteModal } from './CompleteModal';
import { ParallelPicker } from './ParallelPicker';
import { NoteModal } from './NoteModal';
import { ResolveBlockerModal } from './ResolveBlockerModal';
import { AckRequirementsModal } from './AckRequirementsModal';
import type { TaskActionsApi } from './useTaskActions';

interface Props {
  actions: TaskActionsApi;
  /** All tasks in scope — used to compute parallel candidates. */
  allTasks: Task[];
  projects: Map<string, string>;
  clients: Map<string, string>;
  userNames: Map<string, string>;
  mode: DrawerMode;
}

/**
 * Renders the drawer + all 7 lifecycle modals, wired to a TaskActionsApi.
 * Page-level components compose this together with their own canvas / list.
 */
export function TaskActionLayer({
  actions,
  allTasks,
  projects,
  clients,
  userNames,
  mode,
}: Props) {
  const { selectedTask, modals, close, handlers, open } = actions;

  const parallelCandidates = useMemo(() => {
    if (!selectedTask) return [];
    return allTasks.filter(
      (t) =>
        t.id !== selectedTask.id &&
        t.assigneeId === selectedTask.assigneeId &&
        t.status === 'pending' &&
        t.sequenceIndex > selectedTask.sequenceIndex,
    );
  }, [selectedTask, allTasks]);

  return (
    <>
      <TaskDrawer
        open={selectedTask !== null}
        task={selectedTask}
        projectName={
          selectedTask?.projectId ? projects.get(selectedTask.projectId) ?? '' : ''
        }
        clientName={selectedTask?.clientId ? clients.get(selectedTask.clientId) ?? '' : ''}
        locked={false}
        mode={mode}
        userNames={userNames}
        onClose={() => actions.setSelectedTaskId(null)}
        onAccept={() => open('accept')}
        onComplete={() => open('complete')}
        onMarkParallel={() => open('parallel')}
        onFlagBlocker={() => open('blocker')}
        onResolveBlocker={() => open('resolve')}
        onPause={() => open('pause')}
        onResume={() => void handlers.resume()}
        onAddComment={() => open('comment')}
        onAcknowledgeRequirements={() => open('ack')}
        onAddRequirements={() => open('req')}
      />

      <AcceptModal
        open={modals.accept}
        task={selectedTask}
        onClose={() => close('accept')}
        onAccept={handlers.accept}
      />
      <CompleteModal
        open={modals.complete}
        task={selectedTask}
        onClose={() => close('complete')}
        onComplete={handlers.complete}
      />
      <ParallelPicker
        open={modals.parallel}
        active={selectedTask}
        candidates={parallelCandidates}
        onClose={() => close('parallel')}
        onConfirm={handlers.markParallel}
      />
      <NoteModal
        open={modals.blocker}
        title="Flag a blocker"
        description="What's blocking? The task pauses; the deadline timer stops until resolved."
        placeholder="Describe what's blocking progress…"
        confirmLabel="Flag blocker"
        confirmClass="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 bg-red-500/90 text-white font-semibold transition-colors hover:bg-red-500 active:scale-[0.98] disabled:opacity-50"
        onClose={() => close('blocker')}
        onSubmit={handlers.flagBlocker}
      />
      <ResolveBlockerModal
        open={modals.resolve}
        task={selectedTask}
        onClose={() => close('resolve')}
        onResolve={handlers.resolveBlocker}
      />
      <NoteModal
        open={modals.pause}
        title="Pause this task"
        description="Optional note for context. Deadline timer pauses; resumes on un-pause and extends accordingly."
        placeholder="Why pausing? (optional)"
        confirmLabel="Pause"
        required={false}
        onClose={() => close('pause')}
        onSubmit={handlers.pause}
      />
      <NoteModal
        open={modals.comment}
        title="Add a status note"
        placeholder="Status update, blocker context, or any note worth keeping…"
        confirmLabel="Post note"
        onClose={() => close('comment')}
        onSubmit={handlers.addComment}
      />
      <AckRequirementsModal
        open={modals.ack}
        task={selectedTask}
        onClose={() => close('ack')}
        onAcknowledge={handlers.ack}
      />
      <NoteModal
        open={modals.req}
        title="Add new requirements"
        description="The brief will be extended (not replaced). The assignee's task is flagged purple until they acknowledge."
        placeholder="What's changed or been added to the scope?"
        confirmLabel="Add requirements"
        confirmClass="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 bg-purple-500/90 text-white font-semibold transition-colors hover:bg-purple-500 active:scale-[0.98] disabled:opacity-50"
        onClose={() => close('req')}
        onSubmit={handlers.addRequirements}
      />
    </>
  );
}
