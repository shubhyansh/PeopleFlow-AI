import type { Edge, Node } from 'reactflow';
import type { Task } from '../domain/types';
import { buildEventChain, type EventBox } from './eventChain';

export interface EventNodeData {
  event: EventBox;
  /** True if this event's task is locked behind an earlier active task (pending only). */
  locked: boolean;
  /** True if this is the next-up task and the event is its current state. */
  isNextUp: boolean;
  projectName: string;
  clientName: string;
  /** True if this task's chain is fully expanded (all events visible). */
  expanded: boolean;
  /**
   * For the current-event node only:
   *   - when collapsed: number of older events hidden behind this one (renders "↓ Show N earlier")
   *   - when expanded with a chain length > 1: 0, but `expanded === true` so we render "↑ Hide history"
   */
  hiddenCount: number;
  /** True if the underlying task was assigned directly by the admin. Used by
   *  the lead's project view to mark "admin-owned" tasks. */
  adminAssigned: boolean;
  /** Toggle handler — clicking the affordance flips the task's expansion state. */
  onToggleExpand?: (taskId: string) => void;
}

export const EVENT_WIDTH = 320;
const EVENT_VERTICAL_GAP = 160;
const COL_GAP = 40;
const ROW_GAP = 110;

interface BuildOpts {
  /** Set of task ids whose history is expanded (full event chain rendered). */
  expandedTaskIds?: Set<string>;
  /** Toggle handler passed to nodes so users can expand/collapse from the chart. */
  onToggleExpand?: (taskId: string) => void;
}

/**
 * Builds a flowchart where each task is, by default, a single event box
 * (its current state). When a task's id is in `expandedTaskIds`, the full
 * event chain renders vertically — older events dimmed, newest in full color.
 *
 * Cross-task edges connect the bottom of task N to the top of task N+1 so
 * the sequence is always visible regardless of expansion state.
 */
export function buildFlowchart(
  tasks: Task[],
  opts: BuildOpts = {},
): {
  nodes: Node<EventNodeData>[];
  edges: Edge[];
  height: number;
  /** Total width of the laid-out flowchart (max parallel row × event width + gaps). */
  width: number;
} {
  if (tasks.length === 0) return { nodes: [], edges: [], height: 0, width: 0 };

  const expandedTaskIds = opts.expandedTaskIds ?? new Set<string>();
  const onToggleExpand = opts.onToggleExpand;

  // ---- Group tasks into rows by parallel relationships ----
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const parent = new Map<string, string>();
  function find(x: string): string {
    let cur = x;
    while (parent.get(cur) !== cur) {
      const next = parent.get(cur)!;
      parent.set(cur, parent.get(next)!);
      cur = parent.get(cur)!;
    }
    return cur;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  tasks.forEach((t) => parent.set(t.id, t.id));
  tasks.forEach((t) => {
    t.parallelWith.forEach((other) => {
      if (byId.has(other)) union(t.id, other);
    });
  });

  const groups = new Map<string, Task[]>();
  tasks.forEach((t) => {
    const root = find(t.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(t);
  });

  // Within a parallel group, sort tasks by assignment date (older on the left).
  // Rows are then sorted by their earliest createdAt so the queue reads top→bottom by date.
  const rows = Array.from(groups.values())
    .map((row) => row.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
    .sort((a, b) => {
      const minA = a.reduce((m, t) => (t.createdAt < m ? t.createdAt : m), a[0].createdAt);
      const minB = b.reduce((m, t) => (t.createdAt < m ? t.createdAt : m), b[0].createdAt);
      if (minA !== minB) return minA.localeCompare(minB);
      // Fallback: sequence_index for stability
      return (
        Math.min(...a.map((t) => t.sequenceIndex)) -
        Math.min(...b.map((t) => t.sequenceIndex))
      );
    });

  // ---- Locking + next-up ----
  let firstUnfinishedRow = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some((t) => t.status !== 'completed')) {
      firstUnfinishedRow = i;
      break;
    }
  }

  let nextUpId: string | null = null;
  if (firstUnfinishedRow !== -1) {
    const row = rows[firstUnfinishedRow];
    const pending = row.find((t) => t.status === 'pending');
    if (pending) nextUpId = pending.id;
    else {
      const active = row.find((t) => t.status !== 'completed');
      if (active) nextUpId = active.id;
    }
  }

  // ---- Lay out nodes + intra-task edges; track row anchors for cross-task edges ----
  const nodes: Node<EventNodeData>[] = [];
  const edges: Edge[] = [];
  let currentY = 0;
  let maxRowSize = 1;

  // For each row: the FIRST visible node id per task (top of column) and LAST (bottom of column)
  const rowFirstIds: string[][] = [];
  const rowLastIds: string[][] = [];

  rows.forEach((row, rowIdx) => {
    const fullChains = row.map((t) => buildEventChain(t));
    // Decide which subset of each chain to render
    const visibleChains = fullChains.map((chain, colIdx) =>
      expandedTaskIds.has(row[colIdx].id) ? chain : [chain[chain.length - 1]],
    );

    const maxEvents = Math.max(...visibleChains.map((c) => c.length));
    const rowHeight = maxEvents * EVENT_VERTICAL_GAP;

    const totalWidth = row.length * EVENT_WIDTH + (row.length - 1) * COL_GAP;
    const startX = -totalWidth / 2;
    if (row.length > maxRowSize) maxRowSize = row.length;

    const firstIds: string[] = [];
    const lastIds: string[] = [];

    visibleChains.forEach((visible, colIdx) => {
      const task = row[colIdx];
      const fullChain = fullChains[colIdx];
      const expanded = expandedTaskIds.has(task.id);
      const taskLocked =
        firstUnfinishedRow !== -1 && rowIdx > firstUnfinishedRow && task.status === 'pending';
      const colX = startX + colIdx * (EVENT_WIDTH + COL_GAP);

      visible.forEach((event, vIdx) => {
        // hiddenCount applies to the current-event node only (it owns the toggle).
        // When collapsed, hiddenCount = fullChain.length - 1 (everything older is hidden).
        // When expanded, hiddenCount = 0 BUT `expanded` is true so the toggle still renders
        // (as "Hide history") iff fullChain.length > 1.
        const isCurrent = event.isCurrent;
        nodes.push({
          id: event.id,
          type: 'event',
          position: { x: colX, y: currentY + vIdx * EVENT_VERTICAL_GAP },
          data: {
            event,
            locked: taskLocked,
            isNextUp: task.id === nextUpId,
            projectName: '',
            clientName: '',
            expanded,
            hiddenCount: isCurrent && !expanded ? Math.max(0, fullChain.length - 1) : 0,
            adminAssigned: task.assignerId === 'admin',
            ...(onToggleExpand ? { onToggleExpand } : {}),
          },
          draggable: false,
          selectable: true,
        });

        if (vIdx > 0) {
          edges.push({
            id: `${visible[vIdx - 1].id}->${event.id}`,
            source: visible[vIdx - 1].id,
            target: event.id,
            type: 'smoothstep',
            style: {
              stroke: 'rgba(45, 226, 212, 0.32)',
              strokeWidth: 1.25,
              strokeDasharray: '4 4',
            },
          });
        }
      });

      firstIds.push(visible[0].id);
      lastIds.push(visible[visible.length - 1].id);
    });

    rowFirstIds.push(firstIds);
    rowLastIds.push(lastIds);

    currentY += rowHeight + ROW_GAP;
  });

  // ---- Cross-task edges: bottom of each task in row N → top of each task in row N+1 ----
  for (let i = 0; i < rows.length - 1; i++) {
    rowLastIds[i].forEach((from) => {
      rowFirstIds[i + 1].forEach((to) => {
        edges.push({
          id: `cross_${from}->${to}`,
          source: from,
          target: to,
          type: 'smoothstep',
          style: { stroke: 'rgba(45, 226, 212, 0.55)', strokeWidth: 1.75 },
        });
      });
    });
  }

  const height = Math.max(0, currentY - ROW_GAP);
  const width = maxRowSize * EVENT_WIDTH + (maxRowSize - 1) * COL_GAP;
  return { nodes, edges, height, width };
}

export function hydrateNodeData(
  nodes: Node<EventNodeData>[],
  projects: Map<string, string>,
  clients: Map<string, string>,
): Node<EventNodeData>[] {
  return nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      projectName: n.data.event.task.projectId
        ? projects.get(n.data.event.task.projectId) ?? ''
        : '',
      clientName: n.data.event.task.clientId
        ? clients.get(n.data.event.task.clientId) ?? ''
        : '',
    },
  }));
}
