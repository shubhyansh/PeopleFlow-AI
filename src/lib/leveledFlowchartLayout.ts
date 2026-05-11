import type { Edge, Node } from 'reactflow';
import type { Task } from '../domain/types';
import { buildFlowchart, hydrateNodeData } from './flowchartLayout';
import type { GroupHeaderData } from '../components/flowchart/GroupHeaderNode';

export type Level = 'client' | 'project' | 'assignee';

interface BuildOpts {
  tasks: Task[];
  /** Outermost first. Examples:
   *   ['assignee']                              — Person view
   *   ['project', 'assignee']                   — Project view (project → person)
   *   ['client', 'assignee']                    — Client view (client → person)
   *   ['client', 'project', 'assignee']         — Full hierarchy (client → project → person)
   */
  levels: Level[];
  clients: Map<string, string>;
  projects: Map<string, string>;
  users: Map<string, string>;
  collapsedGroupIds: Set<string>;
  expandedTaskIds: Set<string>;
  onToggleGroup: (id: string) => void;
  onToggleTaskExpand: (taskId: string) => void;
}

const ROW_HEIGHT = 70;
const ROW_GAP = 24;
const TASKS_BELOW_PADDING = 30;

/** Gap between sibling groups at each depth (top-level uses index 0). */
const X_GAPS = [140, 80, 40];
/** Min column width per depth — gives clear visual size differences between levels. */
const MIN_WIDTHS = [420, 380, 360];

const NONE_KEY: Record<Level, string> = {
  client: '__no_client__',
  project: '__no_project__',
  assignee: '__no_assignee__',
};
const NONE_LABEL: Record<Level, string> = {
  client: 'No client',
  project: 'No project',
  assignee: 'Unassigned',
};

function getKey(t: Task, level: Level): string {
  switch (level) {
    case 'client':
      return t.clientId ?? NONE_KEY.client;
    case 'project':
      return t.projectId ?? NONE_KEY.project;
    case 'assignee':
      return t.assigneeId;
  }
}

function getLabel(id: string, level: Level, opts: BuildOpts): string {
  if (id === NONE_KEY[level]) return NONE_LABEL[level];
  switch (level) {
    case 'client':
      return opts.clients.get(id) ?? '(unknown client)';
    case 'project':
      return opts.projects.get(id) ?? '(unknown project)';
    case 'assignee':
      if (id === 'admin') return 'Administrator';
      return opts.users.get(id) ?? '(unknown user)';
  }
}

interface MeasuredNode {
  level: Level;
  groupId: string;
  label: string;
  taskCount: number;
  collapsed: boolean;
  width: number;
  /** Set when this is an intermediate level (more nesting below). */
  children?: MeasuredNode[];
  /** Set when this is the leaf level — tasks render below. */
  taskSub?: ReturnType<typeof buildFlowchart>;
}

/**
 * Builds a 1-, 2-, or 3-level nested flowchart. Each level becomes a row of
 * group headers; the deepest level's headers are followed by the task chains.
 *
 * Visual:
 *   [outer headers row]
 *   [middle headers row, centered under their parent]
 *   [inner headers row, centered under their parent]
 *   [tasks row — each task chain under its assignee header]
 *
 * Within an assignee, `buildFlowchart` arranges parallel tasks side-by-side
 * and event chains vertically by date — so person separation is the deepest
 * granularity, and date-ordering applies INSIDE each person's column.
 */
export function buildLeveledFlowchart(opts: BuildOpts): {
  nodes: Node[];
  edges: Edge[];
} {
  if (opts.levels.length === 0) return { nodes: [], edges: [] };

  const tree = bucketize(opts.tasks, opts.levels, '', opts);
  const totalDepth = opts.levels.length;

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let xCursor = 0;
  for (const node of tree) {
    layoutAt(node, xCursor, 0, totalDepth, opts, nodes, edges);
    xCursor += node.width + X_GAPS[0];
  }

  return { nodes, edges };
}

function bucketize(
  tasks: Task[],
  remainingLevels: Level[],
  pathPrefix: string,
  opts: BuildOpts,
): MeasuredNode[] {
  const head = remainingLevels[0];
  const rest = remainingLevels.slice(1);

  const buckets = new Map<string, Task[]>();
  for (const t of tasks) {
    const k = getKey(t, head);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(t);
  }

  const sorted = Array.from(buckets.entries()).sort(([a], [b]) => {
    if (a === NONE_KEY[head]) return 1;
    if (b === NONE_KEY[head]) return -1;
    return getLabel(a, head, opts).localeCompare(getLabel(b, head, opts));
  });

  const depth = opts.levels.length - remainingLevels.length;
  const minWidth = MIN_WIDTHS[depth] ?? MIN_WIDTHS[MIN_WIDTHS.length - 1];
  const childGap = X_GAPS[depth + 1] ?? X_GAPS[X_GAPS.length - 1];

  return sorted.map(([id, ts]) => {
    const groupId = `${pathPrefix}|${head}:${id}`;
    const collapsed = opts.collapsedGroupIds.has(groupId);
    ts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const measured: MeasuredNode = {
      level: head,
      groupId,
      label: getLabel(id, head, opts),
      taskCount: ts.length,
      collapsed,
      width: minWidth,
    };

    if (collapsed) {
      // header-only; width stays at min
    } else if (rest.length === 0) {
      // Leaf: build task chain
      if (ts.length > 0) {
        const sub = buildFlowchart(ts, {
          expandedTaskIds: opts.expandedTaskIds,
          onToggleExpand: opts.onToggleTaskExpand,
        });
        measured.taskSub = {
          ...sub,
          nodes: hydrateNodeData(sub.nodes, opts.projects, opts.clients),
        };
        measured.width = Math.max(minWidth, sub.width);
      }
    } else {
      const children = bucketize(ts, rest, groupId, opts);
      measured.children = children;
      const childInner = children.reduce(
        (s, c, i) => s + c.width + (i === 0 ? 0 : childGap),
        0,
      );
      measured.width = Math.max(minWidth, childInner);
    }

    return measured;
  });
}

function layoutAt(
  node: MeasuredNode,
  x: number,
  depth: number,
  totalDepth: number,
  opts: BuildOpts,
  nodes: Node[],
  edges: Edge[],
): void {
  const yHeader = depth * (ROW_HEIGHT + ROW_GAP);
  const headerData: GroupHeaderData = {
    groupId: node.groupId,
    label: node.label,
    taskCount: node.taskCount,
    statusCounts: {},
    collapsed: node.collapsed,
    onToggle: opts.onToggleGroup,
    width: node.width,
  };
  nodes.push({
    id: node.groupId,
    type: 'groupHeader',
    position: { x, y: yHeader },
    data: headerData,
    draggable: false,
    selectable: false,
  });

  if (node.collapsed) return;

  if (node.taskSub) {
    const yTasks = totalDepth * (ROW_HEIGHT + ROW_GAP) + TASKS_BELOW_PADDING;
    const colCenterX = x + node.width / 2;
    // Find the minimum y in sub.nodes (the topmost row of the task chain) so we can
    // connect this assignee header to the FIRST visible event of each task.
    let minSubY = Infinity;
    for (const n of node.taskSub.nodes) {
      if (n.position.y < minSubY) minSubY = n.position.y;
    }
    node.taskSub.nodes.forEach((n) => {
      const placed = {
        ...n,
        position: { x: n.position.x + colCenterX, y: n.position.y + yTasks },
      };
      nodes.push(placed);
      if (n.position.y === minSubY) {
        edges.push(makeHierarchyEdge(node.groupId, n.id));
      }
    });
    node.taskSub.edges.forEach((e) => edges.push(e));
  } else if (node.children) {
    const childGap = X_GAPS[depth + 1] ?? X_GAPS[X_GAPS.length - 1];
    const childInner = node.children.reduce(
      (s, c, i) => s + c.width + (i === 0 ? 0 : childGap),
      0,
    );
    let childX = x + (node.width - childInner) / 2;
    for (const child of node.children) {
      layoutAt(child, childX, depth + 1, totalDepth, opts, nodes, edges);
      edges.push(makeHierarchyEdge(node.groupId, child.groupId));
      childX += child.width + childGap;
    }
  }
}

function makeHierarchyEdge(source: string, target: string): Edge {
  return {
    id: `hierarchy_${source}->${target}`,
    source,
    target,
    type: 'smoothstep',
    style: { stroke: 'rgba(45, 226, 212, 0.45)', strokeWidth: 1.5 },
  };
}
